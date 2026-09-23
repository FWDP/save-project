const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-typescript.cjs');
function fixture(send) {
  let owner = 'alice';
  let sequence = 0;
  const queued = new Map();
  const state = {
    transactions: [],
    setTransactions(rows) {
      this.transactions = rows;
    },
  };
  const writes = load('src/lib/transaction-writes.ts', {
    '@/store/finance-store': { useFinanceStore: { getState: () => state } },
    'expo-crypto': { randomUUID: () => `mutation-${++sequence}` },
    './auth': { getAuthUser: async () => (owner ? { id: owner } : null) },
    './api': { createTransaction: send },
    './sqlite': {
      enqueueTransaction: (user, row) => queued.set(row.id, row),
      pendingTransactions: (user) =>
        [...queued.values()].filter((row) => row.userId === user),
      acknowledgeTransaction: (id, user) => {
        if (queued.get(id)?.userId === user) queued.delete(id);
      },
    },
  });
  return {
    ...writes,
    queued,
    state,
    switchAccount: (id) => {
      owner = id;
      state.transactions = [];
    },
  };
}
const row = {
  userId: 'alice',
  date: '2026-09-01',
  amount: 10.5,
  type: 'expense',
  category: 'Food',
  description: 'Lunch',
};
test('interrupted response keeps a durable pending row and retry preserves mutation identity', async () => {
  let first = true;
  const server = new Map();
  const f = fixture(async (payload) => {
    if (!server.has(payload.clientMutationId))
      server.set(payload.clientMutationId, { ...payload, id: 'server-1' });
    if (first) {
      first = false;
      throw new Error('response lost');
    }
    return server.get(payload.clientMutationId);
  });
  await f.saveTransactionDraft(row);
  await assert.rejects(f.flushTransactions('alice'));
  assert.equal(f.queued.size, 1);
  await f.flushTransactions('alice');
  assert.equal(server.size, 1);
  assert.equal(f.queued.size, 0);
  assert.equal(f.state.transactions[0].id, 'server-1');
});
test('account change during upload never populates the new account state', async () => {
  let f;
  f = fixture(async (payload) => {
    f.switchAccount('bob');
    return { ...payload, id: 'alice-server-record' };
  });
  await f.saveTransactionDraft(row);
  await f.flushTransactions('alice');
  assert.deepEqual(f.state.transactions, []);
});
test('invalid currency precision is rejected before persisting a pending write', async () => {
  const f = fixture(async () => {
    throw new Error('should not send');
  });
  await assert.rejects(f.saveTransactionDraft({ ...row, amount: 1.234 }));
  assert.equal(f.queued.size, 0);
});
test('partial upload failure preserves acknowledged transactions and remaining queue', async () => {
  let count = 0;
  const f = fixture(async (payload) => {
    if (++count === 2) throw new Error('offline');
    return { ...payload, id: 'first' };
  });
  await f.saveTransactionDraft(row);
  await f.saveTransactionDraft({ ...row, description: 'Dinner' });
  await assert.rejects(f.flushTransactions('alice'));
  assert.equal(f.queued.size, 1);
  assert.equal(f.state.transactions.length, 1);
});
