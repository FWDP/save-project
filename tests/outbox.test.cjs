const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-typescript.cjs');
function fixture() {
  let owner = 'alice', sequence = 0, fail = false;
  const disk = new Map();
  const legacy = { transactions: [{ id: 'old', userId: 'alice', type: 'expense', amount: 5, date: '2026-11-01', category: 'Food', description: 'Old' }], budgets: [], categories: [] };
  const pending = [{ ...legacy.transactions[0], id: 'queued', syncState: 'pending', receiptUri: 'file:///documents/receipts/photo.jpg' }];
  const storage = {
    getItem: async key => disk.get(key) ?? null,
    setItem: async (key, value) => { if (fail) throw new Error('disk full'); disk.set(key, value); },
  };
  const overrides = {
    './finance-reset': { resetDeviceFinancesOnce: async () => {} },
    '@react-native-async-storage/async-storage': storage,
    'expo-crypto': { randomUUID: () => `uuid-${++sequence}` },
    './auth': { getAuthUser: async () => owner ? { id: owner } : null, accessToken: async expected => { if (owner !== expected) throw new Error('Account changed'); return 'test-token'; } },
    './api': { getApiBaseUrl: () => 'https://sync.example.test' },
    './sqlite': { initializeDatabase() {}, loadAccountCache: id => id === 'alice' ? legacy : null, pendingTransactions: id => id === 'alice' ? pending : [] },
  };
  const local = load('src/lib/local-finance.ts', overrides);
  return { ...local, disk, overrides, storage, switchAccount: id => owner = id, failWrites: value => fail = value };
}
const row = { userId: 'alice', type: 'expense', amount: 10.5, date: '2026-11-04', category: 'Food', description: 'Lunch' };
test('device migration retains cached and queued receipts without pending upload state', async () => {
  const f = fixture();
  const data = await f.loadLocalFinances('alice');
  assert.deepEqual(data.transactions.map(row => row.id), ['old', 'queued']);
  assert.equal(data.transactions[1].receiptUri, 'file:///documents/receipts/photo.jpg');
  assert.equal(data.transactions[1].syncState, undefined);
  assert.ok(data.categories.length > 0);
  await f.deleteLocal('transactions', 'queued');
  assert.equal((await f.loadLocalFinances('alice')).transactions.some(row => row.id === 'queued'), false);
});
test('concurrent local writes persist across reload, update and delete without lost rows', async () => {
  const f = fixture();
  const created = await Promise.all(Array.from({ length: 12 }, () => f.addLocal('transactions', row)));
  assert.equal((await f.localRecords('transactions')).length, 14);
  await f.updateLocal('transactions', created[0].id, { amount: 14.25 });
  const reloaded = load('src/lib/local-finance.ts', f.overrides);
  assert.equal((await reloaded.localRecords('transactions')).find(row => row.id === created[0].id).amount, 14.25);
  await reloaded.deleteLocal('transactions', created[0].id);
  assert.equal((await reloaded.localRecords('transactions')).length, 13);
});
test('accounts remain isolated, and signing out does not delete durable records', async () => {
  const f = fixture();
  await f.addLocal('transactions', row);
  f.switchAccount('bob');
  assert.deepEqual(await f.localRecords('transactions'), []);
  await assert.rejects(f.updateLocal('transactions', 'old', { amount: 1 }), /not found/);
  f.switchAccount(null);
  await assert.rejects(f.localRecords('transactions'), /Sign in/);
  f.switchAccount('alice');
  assert.equal((await f.localRecords('transactions')).length, 3);
});
test('storage failures reject writes and do not report saved records', async () => {
  const f = fixture();
  await f.loadLocalFinances('alice');
  f.failWrites(true);
  await assert.rejects(f.addLocal('transactions', row), /disk full/);
  f.failWrites(false);
  assert.equal((await f.localRecords('transactions')).length, 2);
});
test('imports remain idempotent and reject invalid money before persistence', async () => {
  const f = fixture();
  const a = await f.addLocal('transactions', { ...row, clientMutationId: 'import-1' });
  const b = await f.addLocal('transactions', { ...row, clientMutationId: 'import-1' });
  assert.equal(a.id, b.id);
  await assert.rejects(f.addLocal('transactions', { ...row, amount: 1.001 }), /positive amount/);
});
test('financial persistence and disabled PDF and blockchain paths never call the network', async () => {
  const f = fixture();
  const original = global.fetch;
  global.fetch = () => { throw new Error('Unexpected financial network request'); };
  try {
    const api = load('src/lib/api.ts', {
      './local-finance': f,
      './auth': { accessToken: () => { throw new Error('Unexpected auth request'); } },
      'expo-constants': { default: {} },
      'react-native': { Platform: { OS: 'web' } },
    });
    const transaction = await api.createTransaction(row);
    assert.equal((await api.fetchTransactions()).length, 3);
    await api.updateTransaction(transaction.id, { description: 'Updated locally' });
    await api.deleteTransaction(transaction.id);
    const budget = await api.createBudget({ userId: 'alice', category: 'Food', limit: 100, period: 'monthly' });
    assert.equal((await api.fetchBudgets())[0].id, budget.id);
    await api.updateBudget(budget.id, { limit: 200 });
    const category = await api.createCategory({ name: 'Custom', type: 'expense', color: '#ffffff' });
    await api.updateCategory(category.id, { name: 'Edited' });
    const goal = await api.createSavingsGoal({ name: 'Trip', targetAmount: 1000 });
    await api.updateSavingsGoal(goal.id, { fundedAmount: 100 });
    assert.equal((await api.fetchSavingsGoal(goal.id)).fundedAmount, 100);
    await api.deleteSavingsGoal(goal.id);
    await assert.rejects(api.scanReceiptWithAi('file:///receipt.pdf', 'application/pdf'), /Convert PDFs/);
    await assert.rejects(api.readStatementPdf('file:///statement.pdf'), /disabled/);
    await assert.rejects(api.prepareStellarPayment({}), /disabled/);
  } finally { global.fetch = original; }
});

test('mobile opt-in exchanges snapshots, retains photos, and turning off stops requests', async () => {
  const f = fixture();
  const original = global.fetch;
  let requests = 0;
  let remote = { revision: 0, snapshot: { transactions: [{ ...row, id: 'remote' }], categories: [], budgets: [], goals: [] } };
  delete remote.snapshot.transactions[0].userId;
  global.fetch = async (url, options) => {
    requests++;
    assert.equal(url, 'https://sync.example.test/finance-sync');
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body);
      assert.equal(body.consent, true);
      assert.ok(!options.body.includes('receiptUri'));
      remote = { revision: remote.revision + 1, snapshot: body.snapshot };
    }
    return { ok: true, status: 200, json: async () => remote };
  };
  try {
    assert.equal((await f.getDatabaseSyncSettings()).enabled, false);
    await f.syncLocalFinances();
    assert.equal(requests, 0);
    await f.setDatabaseSyncEnabled(true);
    await f.syncLocalFinances();
    const records = await f.localRecords('transactions');
    assert.equal(records.length, 3);
    assert.equal(records.find(row => row.id === 'queued').receiptUri, 'file:///documents/receipts/photo.jpg');
    assert.equal((await f.getDatabaseSyncSettings()).enabled, true);
    assert.ok((await f.getDatabaseSyncSettings()).lastSyncedAt);
    const before = requests;
    await f.setDatabaseSyncEnabled(false);
    await f.syncLocalFinances();
    assert.equal(requests, before);
    f.switchAccount('bob');
    assert.equal((await f.getDatabaseSyncSettings()).enabled, false);
  } finally { global.fetch = original; }
});
test('mobile sync failures and sign-out during requests preserve device records and success timestamp', async () => {
  const f = fixture();
  const original = global.fetch;
  await f.setDatabaseSyncEnabled(true);
  const before = await f.localRecords('transactions');
  try {
    global.fetch = async () => { throw new Error('offline'); };
    await assert.rejects(f.syncLocalFinances(), /offline/);
    assert.deepEqual(await f.localRecords('transactions'), before);
    assert.equal((await f.getDatabaseSyncSettings()).lastSyncedAt, undefined);
    global.fetch = async () => { f.switchAccount('bob'); return { ok: true, status: 200, json: async () => ({ revision: 1, snapshot: { transactions: [], categories: [], budgets: [], goals: [] } }) }; };
    await assert.rejects(f.syncLocalFinances(), /Account changed/);
    assert.deepEqual(await f.localRecords('transactions'), []);
    f.switchAccount('alice');
    assert.deepEqual(await f.localRecords('transactions'), before);
  } finally { global.fetch = original; }
});
