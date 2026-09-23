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
  const model = {
    find: (filter) => {
      assert.deepEqual(filter, { userId: 'alice' });
      return { sort: () => ({ lean: async () => [] }) };
    },
  };
  await authContext.run({ userId: 'alice' }, async () =>
    assert.deepEqual(await new TransactionsService(model).findAll(), []),
  );
});
test('cross-account mutation cannot update another owner and ownership cannot be reassigned', async () => {
  const model = {
    findOneAndUpdate: (filter, update) => {
      assert.deepEqual(filter, {
        _id: '507f1f77bcf86cd799439011',
        userId: 'alice',
      });
      assert.equal(update.$set.userId, 'alice');
      return { lean: async () => null };
    },
  };
  await authContext.run({ userId: 'alice' }, async () =>
    assert.rejects(
      new TransactionsService(model).update('507f1f77bcf86cd799439011', {
        userId: 'bob',
        amount: 1,
      }),
      { status: 404 },
    ),
  );
});
test('database failure is an error, never volatile success or demo data', async () => {
  const model = {
    find: () => ({
      sort: () => ({
        lean: async () => {
          throw new Error('offline');
        },
      }),
    }),
  };
  await authContext.run({ userId: 'alice' }, async () =>
    assert.rejects(new TransactionsService(model).findAll(), { status: 503 }),
  );
});
test('retried creates use the same owner-scoped idempotent upsert', async () => {
  let stored;
  const model = {
    findOneAndUpdate: (filter, update, options) => {
      assert.deepEqual(filter, {
        userId: 'alice',
        clientMutationId: 'retry-1',
      });
      assert.equal(options.upsert, true);
      stored ??= { ...update.$setOnInsert, _id: 'same-id' };
      return { lean: async () => stored };
    },
  };
  await authContext.run({ userId: 'alice' }, async () => {
    const service = new TransactionsService(model);
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
