const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-typescript.cjs');
const sync = load('shared/finance-sync.ts');
const empty = sync.emptySyncSnapshot;
const row = (id, description = id) => ({ id, type: 'expense', amount: 10, description, category: 'Food', date: '2026-11-05' });
const snapshot = transactions => ({ ...empty(), transactions });

test('sync is off by default and makes no network requests', async () => {
  const fail = () => { throw new Error('Unexpected network request'); };
  assert.equal(await sync.exchangeFinances({ local: empty(), settings: { enabled: false }, fetchRemote: fail, pushRemote: fail, assertActive: fail }), null);
});
test('sync projection excludes receipt photos, device paths, owner identity and built-in categories', () => {
  const projected = sync.projectSnapshot({ ...empty(), transactions: [{ ...row('a'), receiptUri: 'data:image/jpeg;base64,private', userId: 'alice', syncState: 'pending', revision: 2 }], categories: [{ id: 'builtin:Food', builtIn: true }, { id: 'custom', name: 'School' }] });
  assert.deepEqual(projected.transactions, [row('a')]);
  assert.deepEqual(projected.categories.map(row => row.id), ['custom']);
  assert.ok(!JSON.stringify(projected).includes('private'));
});
test('independent device additions, edits and database changes merge without discarding records', () => {
  const base = snapshot([row('a'), row('b')]);
  const device = snapshot([row('a', 'local edit'), row('b'), row('c')]);
  const database = snapshot([row('a'), row('b', 'remote edit'), row('d')]);
  assert.deepEqual(sync.mergeSnapshots(base, device, database).transactions, [row('a', 'local edit'), row('b', 'remote edit'), row('c'), row('d')]);
});
test('deletions propagate without resurrecting unchanged records from other devices', () => {
  const base = snapshot([row('a'), row('b')]);
  assert.deepEqual(sync.mergeSnapshots(base, snapshot([row('b')]), snapshot([row('a')])).transactions, []);
});
test('conflicting edits and edit/delete require an explicit choice; unrelated changes still merge', () => {
  const base = snapshot([row('a')]);
  const device = snapshot([row('a', 'local'), row('b')]);
  const database = empty();
  assert.throws(() => sync.mergeSnapshots(base, device, database), sync.FinanceSyncConflict);
  assert.deepEqual(sync.mergeSnapshots(base, device, database, 'device').transactions, [row('a', 'local'), row('b')]);
  assert.deepEqual(sync.mergeSnapshots(base, device, database, 'database').transactions, [row('b')]);
});
test('restoring database records preserves local photos and regenerates non-replaced defaults', () => {
  const local = snapshot([{ ...row('a'), receiptUri: 'file:///receipts/photo.jpg' }]);
  const remote = { ...snapshot([row('a', 'remote'), row('b')]), categories: [{ id: 'custom', name: 'School', type: 'expense', replacesBuiltInId: 'builtin:Food' }] };
  const restored = sync.restoreSnapshot(remote, local, 'alice', [{ id: 'builtin:Food', name: 'Food', type: 'expense' }, { id: 'builtin:Rent', name: 'Rent', type: 'expense' }]);
  assert.equal(restored.transactions[0].receiptUri, 'file:///receipts/photo.jpg');
  assert.equal(restored.transactions[1].receiptUri, undefined);
  assert.equal(restored.transactions[0].userId, 'alice');
  assert.deepEqual(restored.categories.map(row => row.id), ['builtin:Rent', 'custom']);
});
test('two-way exchange downloads records, uploads local changes and retries revision races', async () => {
  let reads = 0, puts = 0;
  const original = snapshot([row('local')]);
  const result = await sync.exchangeFinances({
    local: original, settings: { enabled: true }, assertActive: async () => {},
    fetchRemote: async () => ({ revision: ++reads, snapshot: snapshot([row('remote')]) }),
    pushRemote: async payload => { assert.equal(payload.consent, true); assert.equal(payload.revision, reads); if (++puts === 1) return null; return { revision: reads + 1, snapshot: payload.snapshot }; },
  });
  assert.equal(puts, 2);
  assert.deepEqual(result.snapshot.transactions.map(row => row.id), ['local', 'remote']);
  assert.ok(result.settings.lastSyncedAt);
  assert.deepEqual(original.transactions, [row('local')]);
});
test('offline, conflict and account-change failures never produce an acknowledged sync', async () => {
  let puts = 0;
  const options = { local: snapshot([row('a', 'local')]), settings: { enabled: true, base: snapshot([row('a')]) }, assertActive: async () => {}, fetchRemote: async () => { throw new Error('offline'); }, pushRemote: async () => { puts++; } };
  await assert.rejects(sync.exchangeFinances(options), /offline/);
  await assert.rejects(sync.exchangeFinances({ ...options, fetchRemote: async () => ({ revision: 1, snapshot: snapshot([row('a', 'remote')]) }) }), sync.FinanceSyncConflict);
  await assert.rejects(sync.exchangeFinances({ ...options, assertActive: async () => { throw new Error('Account changed'); } }), /Account changed/);
  assert.equal(puts, 0);
});
test('lost upload response is safe to retry with the same stable record IDs', async () => {
  let remote = { revision: 0, snapshot: empty() };
  const options = { local: snapshot([row('a')]), settings: { enabled: true }, assertActive: async () => {}, fetchRemote: async () => remote,
    pushRemote: async payload => { remote = { revision: payload.revision + 1, snapshot: payload.snapshot }; throw new Error('Response lost'); } };
  await assert.rejects(sync.exchangeFinances(options), /Response lost/);
  const result = await sync.exchangeFinances({ ...options, pushRemote: async payload => ({ revision: payload.revision + 1, snapshot: payload.snapshot }) });
  assert.equal(result.snapshot.transactions.length, 1);
  assert.equal(result.snapshot.transactions[0].id, 'a');
});
