const test = require('node:test');
const assert = require('node:assert/strict');
const { authContext } = require('../dist/auth/auth-context');
const { FinanceSyncService } = require('../dist/finance-sync/finance-sync.service');
const { FinanceSyncController } = require('../dist/finance-sync/finance-sync.controller');
const { syncRequestSchema } = require('../dist/finance-sync/finance-sync.schema');
const empty = () => ({ transactions: [], budgets: [], categories: [], goals: [] });
const request = () => ({ consent: true, revision: 0, snapshot: empty() });

test('sync validation requires consent and rejects photos, arbitrary ownership and duplicate IDs', () => {
  const valid = request();
  assert.equal(syncRequestSchema.safeParse(valid).success, true);
  for (const altered of [{ ...valid, consent: false }, { ...valid, userId: 'bob' }, { ...valid, revision: -1 }]) assert.equal(syncRequestSchema.safeParse(altered).success, false);
  const row = { id: 'local-a', amount: 10, type: 'expense', category: 'Food', description: 'Lunch', date: '2026-11-05' };
  for (const fields of [{ receiptUri: 'data:image/jpeg;base64,private' }, { userId: 'bob' }, { date: '2026-02-30' }, { amount: 1.001 }]) {
    assert.equal(syncRequestSchema.safeParse({ ...valid, snapshot: { ...empty(), transactions: [{ ...row, ...fields }] } }).success, false);
  }
  assert.equal(syncRequestSchema.safeParse({ ...valid, snapshot: { ...empty(), transactions: [row, row] } }).success, false);
});
test('sync reads and writes are scoped exclusively to the verified owner', async () => {
  const database = { query: async (sql, params) => {
    assert.equal(params[0], 'alice');
    assert.match(sql, /user_id/);
    return { rows: sql.startsWith('select') ? [] : [{ revision: 1, snapshot: empty() }] };
  } };
  const service = new FinanceSyncService(database);
  await authContext.run({ userId: 'alice' }, async () => {
    assert.deepEqual(await service.read(), { revision: 0, snapshot: empty() });
    assert.deepEqual(await service.write(request()), { revision: 1, snapshot: empty() });
  });
  await assert.rejects(service.read(), { status: 401 });
});
test('concurrent initial uploads and stale revisions produce conflicts instead of overwrites', async () => {
  const service = new FinanceSyncService({ query: async (sql, params) => {
    assert.equal(params[0], 'alice');
    if (sql.startsWith('update')) { assert.match(sql, /where user_id = \$1 and revision = \$2/); assert.equal(params[1], 3); }
    else assert.match(sql, /on conflict \(user_id\) do nothing/);
    return { rows: [] };
  } });
  await authContext.run({ userId: 'alice' }, async () => {
    await assert.rejects(service.write(request()), { status: 409 });
    await assert.rejects(service.write({ ...request(), revision: 3 }), { status: 409 });
  });
});
test('invalid consent is rejected before any service or database call', () => {
  const controller = new FinanceSyncController({ write: () => { throw new Error('Unexpected database call'); } });
  assert.throws(() => controller.write({ ...request(), consent: false }), { status: 400 });
});
test('database outages fail without pretending financial records were synced', async () => {
  const service = new FinanceSyncService({ query: async () => { throw new Error('Connection refused'); } });
  await authContext.run({ userId: 'alice' }, async () => {
    await assert.rejects(service.read(), { status: 503 });
    await assert.rejects(service.write(request()), { status: 503 });
  });
});

test('HTTP sync authenticates both accounts, rejects photos, enforces revisions and accepts larger metadata snapshots', async () => {
  const { Module, ValidationPipe } = require('@nestjs/common');
  const { NestFactory } = require('@nestjs/core');
  const { AuthGuard } = require('../dist/auth/auth.guard');
  const records = new Map();
  const service = new FinanceSyncService({ query: async (sql, params) => {
    const owner = params[0];
    if (sql.startsWith('select')) return { rows: records.has(owner) ? [records.get(owner)] : [] };
    if (sql.startsWith('insert')) {
      if (records.has(owner)) return { rows: [] };
      records.set(owner, { revision: 1, snapshot: JSON.parse(params[1]) });
    } else {
      if (records.get(owner)?.revision !== params[1]) return { rows: [] };
      records.set(owner, { revision: params[1] + 1, snapshot: JSON.parse(params[2]) });
    }
    return { rows: [records.get(owner)] };
  } });
  class TestModule {}
  Module({ controllers: [FinanceSyncController], providers: [{ provide: FinanceSyncService, useValue: service }] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.useBodyParser('json', { limit: '5mb' });
  app.use((_request, _response, next) => authContext.run({}, next));
  app.useGlobalGuards(new AuthGuard());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const originalFetch = global.fetch;
  const oldUrl = process.env.SUPABASE_URL, oldKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_URL = 'https://sync-auth.example.test';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'public-test';
  global.fetch = async (url, options) => String(url).startsWith('https://sync-auth.example.test/')
    ? new Response(JSON.stringify({ id: options.headers.Authorization.slice(7) }), { status: 200 })
    : originalFetch(url, options);
  try {
    await app.listen(0, '127.0.0.1');
    const url = `${await app.getUrl()}/finance-sync`;
    const send = (owner, payload) => originalFetch(url, { method: payload ? 'PUT' : 'GET', headers: { Authorization: `Bearer ${owner}`, 'Content-Type': 'application/json' }, body: payload ? JSON.stringify(payload) : undefined });
    assert.equal((await originalFetch(url)).status, 401);
    const local = request();
    local.snapshot.transactions = Array.from({ length: 100 }, (_, i) => ({ id: `a-${i}`, amount: 10, type: 'expense', date: '2026-11-05', category: 'Food', description: 'x'.repeat(1500) }));
    assert.equal((await send('alice', local)).status, 200);
    const alice = await (await send('alice')).json();
    assert.equal(alice.revision, 1);
    assert.equal(alice.snapshot.transactions.length, 100);
    assert.deepEqual((await (await send('bob')).json()).snapshot, empty());
    assert.equal((await send('alice', local)).status, 409);
    const invalid = request();
    invalid.snapshot.transactions = [{ ...local.snapshot.transactions[0], receiptUri: 'data:image/jpeg;base64,private' }];
    assert.equal((await send('bob', invalid)).status, 400);
    assert.equal((await send('bob', { ...request(), userId: 'alice' })).status, 400);
    assert.equal(records.has('bob'), false);
    assert.equal((await send('bob', request())).status, 200);
    assert.equal((await (await send('alice')).json()).snapshot.transactions.length, 100);
  } finally {
    global.fetch = originalFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = oldKey;
    await app.close();
  }
});
