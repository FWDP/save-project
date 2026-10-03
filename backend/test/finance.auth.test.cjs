const test = require('node:test');
const assert = require('node:assert/strict');
const { authContext } = require('../dist/auth/auth-context');
const { AuthGuard } = require('../dist/auth/auth.guard');
const {
  TransactionsService,
} = require('../dist/transactions/transactions.service');
const context = (path, authorization) => ({
  switchToHttp: () => ({
    getRequest: () => ({ path, headers: { authorization } }),
  }),
});

test('private finance routes require authentication', async () => {
  for (const route of [
    '/transactions',
    '/budgets',
    '/categories',
    '/savings-goals',
    '/users',
    '/receipts',
    '/stellar/vault/prepare',
  ])
    await assert.rejects(new AuthGuard().canActivate(context(route)), {
      status: 401,
    });
  assert.equal(await new AuthGuard().canActivate(context('/health')), true);
});
test('identity comes from verified provider response, never caller body', async () => {
  const original = global.fetch;
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  process.env.SUPABASE_URL = 'https://auth.example.test';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'public';
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      id: 'verified-owner',
      app_metadata: { role: 'user' },
    }),
  });
  try {
    await authContext.run({}, async () => {
      assert.equal(
        await new AuthGuard().canActivate(
          context('/transactions', 'Bearer test'),
        ),
        true,
      );
      assert.equal(authContext.getStore().userId, 'verified-owner');
      await assert.rejects(
        new AuthGuard().canActivate(context('/users', 'Bearer test')),
        { status: 403 },
      );
    });
  } finally {
    global.fetch = original;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = oldKey;
  }
});
test('list reads are owner scoped and empty database stays empty', async () => {
  const database = {
    query: async (sql, values) => {
      assert.match(sql, /from public\.transactions where user_id = \$1/);
      assert.deepEqual(values, ['alice']);
      return { rows: [] };
    },
  };
  await authContext.run({ userId: 'alice' }, async () =>
    assert.deepEqual(await new TransactionsService(database).findAll(), []),
  );
});
test('cross-account mutation cannot update another owner and ownership cannot be reassigned', async () => {
  const database = {
    query: async (sql, values) => {
      assert.match(sql, /^update public\.transactions/);
      assert.match(sql, /where id = \$1 and user_id = \$2/);
      assert.equal(values[0], '507f1f77bcf86cd799439011');
      assert.equal(values[1], 'alice');
      assert.equal(values.includes('bob'), false);
      return { rows: [] };
    },
  };
  await authContext.run({ userId: 'alice' }, async () =>
    assert.rejects(
      new TransactionsService(database).update('507f1f77bcf86cd799439011', {
        userId: 'bob',
        amount: 1,
      }),
      { status: 404 },
    ),
  );
});
test('database failure is an error, never volatile success or demo data', async () => {
  const database = {
    query: async () => {
      throw new Error('offline');
    },
  };
  await authContext.run({ userId: 'alice' }, async () =>
    assert.rejects(new TransactionsService(database).findAll(), { status: 503 }),
  );
});
test('retried creates use the same owner-scoped idempotent upsert', async () => {
  const stored = {
    id: '507f1f77bcf86cd799439011',
    user_id: 'alice',
    client_mutation_id: 'retry-1',
    type: 'expense',
    amount: '1.00',
    category: 'Food',
    description: 'Lunch',
    date: '2026-09-12',
    status: 'pending',
    revision: 1,
  };
  const database = {
    query: async (sql, values) => {
      assert.match(sql, /on conflict \(user_id, client_mutation_id\)/);
      assert.equal(values[1], 'alice');
      assert.equal(values[2], 'retry-1');
      return { rows: [stored] };
    },
  };
  await authContext.run({ userId: 'alice' }, async () => {
    const service = new TransactionsService(database);
    const a = await service.create({
      userId: 'forged',
      clientMutationId: 'retry-1',
      amount: 1,
    });
    const b = await service.create({
      userId: 'forged',
      clientMutationId: 'retry-1',
      amount: 1,
    });
    assert.equal(a.id, b.id);
    assert.equal(a.userId, 'alice');
  });
});
test('Web revision checks reject stale writes without breaking legacy updates', async () => {
  const id = '507f1f77bcf86cd799439011';
  const database = {
    query: async (sql, values) => {
      assert.equal(values[0], id);
      assert.equal(values[1], 'alice');
      if (sql.startsWith('update')) {
        assert.match(sql, /revision = revision \+ 1/);
        assert.match(sql, /revision = \$3/);
        assert.equal(values[2], 1);
        return { rows: [] };
      }
      assert.match(sql, /select id from public\.transactions/);
      return { rows: [{ id, revision: 2 }] };
    },
  };
  await authContext.run({ userId: 'alice' }, async () => {
    await assert.rejects(
      new TransactionsService(database).update(id, {
        revision: 1,
        amount: 25,
      }),
      { status: 409 },
    );
  });
});
test('web transaction creation does not require a client-supplied owner ID', async () => {
  const { validate } = require('class-validator');
  const { CreateTransactionDto } = require('../dist/transactions/transactions.dto');
  const errors = await validate(
    Object.assign(new CreateTransactionDto(), {
      clientMutationId: 'web-create-1',
      type: 'expense',
      amount: 12.34,
      category: 'Food',
      description: 'Lunch',
      date: '2026-09-12',
    }),
  );
  assert.deepEqual(errors, []);
});
