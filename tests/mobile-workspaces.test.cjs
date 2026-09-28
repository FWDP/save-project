const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./load-typescript.cjs');
const root = path.join(__dirname, '../src/lib');

test('receipt persistence waits for the copy and propagates copy failures', async () => {
  let complete;
  let copied = false;
  class File {
    constructor(...parts) { this.uri = parts.map(x => x.uri ?? x).join('/'); }
    async copy() { await new Promise(resolve => { complete = resolve; }); copied = true; }
    async base64() { assert.equal(copied, true); return 'aW1hZ2U='; }
  }
  class Directory { constructor() { this.uri = 'file:///documents/receipts'; } create() {} }
  const receipt = load(path.join(root, 'receipt-file.ts'), {
    'expo-file-system': { File, Directory, Paths: { document: 'file:///documents' } },
    'expo-crypto': { randomUUID: () => 'unique' }, 'react-native': { Platform: { OS: 'android' } },
  });
  let returned = false;
  const pending = receipt.persistReceipt('content://provider/image.jpg').then(uri => { returned = true; return uri; });
  await Promise.resolve();
  assert.equal(returned, false);
  complete();
  const uri = await pending;
  assert.equal(uri, 'file:///documents/receipts/unique.jpg');
  assert.equal(await receipt.readReceiptAsBase64(uri), 'aW1hZ2U=');
  File.prototype.copy = async () => { throw new Error('storage unavailable'); };
  await assert.rejects(receipt.persistReceipt('file:///image.jpg'), /storage unavailable/);
});

test('workspace amounts preserve currency precision and reject rounding', () => {
  const { workspaceAmount } = load(path.join(root, 'workspace-money.ts'));
  assert.equal(workspaceAmount('12.34', 'PHP'), 1234);
  assert.equal(workspaceAmount('123', 'JPY'), 123);
  assert.equal(workspaceAmount('12.345', 'KWD'), 12345);
  for (const [amount, currency] of [['1.001', 'PHP'], ['1.5', 'JPY'], ['0', 'PHP'], ['-1', 'USD'], ['1e3', 'USD']])
    assert.throws(() => workspaceAmount(amount, currency));
});

test('workspace requests stay scoped and preserve optimistic concurrency', async () => {
  const previous = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, ...options });
    return new Response(JSON.stringify({ items: [] }), { status: 200 });
  };
  try {
    const api = load(path.join(root, 'api.ts'), {
      './auth': { accessToken: async () => 'test-token' },
      'expo-constants': { default: {} }, 'react-native': { Platform: { OS: 'web' } },
    });
    await api.fetchWorkspaces();
    await api.fetchWorkspaceTransactions('business/id', 2);
    const payload = { clientMutationId: 'unique-key', type: 'expense', amountMinor: 123, description: 'Purchase', category: 'Office', merchant: '', date: '2026-09-28' };
    await api.saveWorkspaceTransaction('business/id', payload);
    await api.saveWorkspaceTransaction('business/id', payload, { id: 'record/id', revision: 3 });
    await api.deleteWorkspaceTransaction('business/id', { id: 'record/id', revision: 4 });
    assert.ok(requests[0].url.endsWith('/workspaces'));
    assert.ok(requests[1].url.endsWith('/workspaces/business%2Fid/transactions?page=2'));
    assert.equal(requests[2].method, 'POST');
    assert.equal(requests[3].method, 'PATCH');
    assert.equal(JSON.parse(requests[3].body).revision, 3);
    assert.ok(requests[4].url.endsWith('/workspaces/business%2Fid/transactions/record%2Fid'));
    assert.equal(requests[4].method, 'DELETE');
    assert.deepEqual(JSON.parse(requests[4].body), { revision: 4 });
    assert.ok(requests.every(r => r.headers.Authorization === 'Bearer test-token'));
    global.fetch = async () => new Response(JSON.stringify({ message: 'This record changed. Reload before editing.' }), { status: 409 });
    await assert.rejects(api.saveWorkspaceTransaction('business', payload, { id: 'record', revision: 1 }), /Reload before editing/);
  } finally { global.fetch = previous; }
});

test('dashboard loads every monthly page from the selected workspace, preserving currency precision', async () => {
  const requests = [];
  let budgetCalls = 0;
  const rows = [
    { id: 'one', createdBy: 'alice', type: 'expense', amountMinor: 1234, description: 'First', category: 'Office', merchant: 'Shop', date: '2026-09-01' },
    { id: 'two', createdBy: 'alice', type: 'income', amountMinor: 2345, description: 'Second', category: 'Sales', merchant: '', date: '2026-09-02' },
  ];
  const dashboard = load(path.join(root, 'workspace-dashboard.ts'), {
    './api': {
      fetchWorkspaceTransactions: async (id, page, month) => {
        requests.push({ id, page, month });
        return { items: [rows[page - 1]], page, pageSize: 1, total: 2, summary: { incomeMinor: 2345, expenseMinor: 1234, balanceMinor: 1111 } };
      },
      fetchBudgets: async () => { budgetCalls++; return [{ id: 'monthly', period: 'monthly' }, { id: 'weekly', period: 'weekly' }]; },
    },
  });
  const business = await dashboard.loadWorkspaceDashboard({ id: 'business', kind: 'business', currency: 'KWD' }, '2026-09');
  assert.deepEqual(requests, [{ id: 'business', page: 1, month: '2026-09' }, { id: 'business', page: 2, month: '2026-09' }]);
  assert.equal(business.transactions.length, 2);
  assert.equal(business.transactions[0].amount, 1.234);
  assert.deepEqual(business.totals, { income: 2.345, expenses: 1.234, balance: 1.111 });
  assert.deepEqual(business.budgets, []);
  assert.equal(budgetCalls, 0);
  const personal = await dashboard.loadWorkspaceDashboard({ id: 'personal', kind: 'personal', currency: 'PHP' }, '2026-08');
  assert.equal(personal.workspaceId, 'personal');
  assert.equal(personal.month, '2026-08');
  assert.equal(personal.transactions[0].amount, 12.34);
  assert.deepEqual(personal.budgets, [{ id: 'monthly', period: 'monthly' }]);
  assert.equal(budgetCalls, 1);
  const { merchantTotals } = load(path.join(root, 'finance.ts'));
  assert.equal(merchantTotals(business.transactions, 3)[0].amount, 1.234);
});

test('dashboard rejects incomplete or changing pagination instead of displaying partial totals', async () => {
  for (const changed of ['total', 'duplicate']) {
    const dashboard = load(path.join(root, 'workspace-dashboard.ts'), {
      './api': {
        fetchWorkspaceTransactions: async (_id, page) => ({
          items: [{ id: 'same' }], page, pageSize: 1, total: changed === 'total' && page === 2 ? 3 : 2,
          summary: { incomeMinor: 0, expenseMinor: 100, balanceMinor: -100 },
        }),
        fetchBudgets: async () => { throw new Error('must not load personal budgets'); },
      },
    });
    await assert.rejects(dashboard.loadWorkspaceDashboard({ id: 'business', kind: 'business', currency: 'PHP' }, '2026-09'), /changed while syncing/);
  }
});

test('all-page workspace snapshots keep personal data and stale workspace responses isolated', () => {
  const { selectedWorkspaceTransactions, supportsPersonalFinance } = load(path.join(root, 'workspace-scope.ts'));
  const personalRows = [{ id: 'personal-record' }];
  const businessRows = [{ id: 'business-record' }];
  const personal = { id: 'personal', kind: 'personal', currency: 'PHP' };
  const business = { id: 'business', kind: 'business', currency: 'KWD' };
  const other = { id: 'other', kind: 'business', currency: 'PHP' };
  assert.deepEqual(selectedWorkspaceTransactions(business, personalRows, { id: 'business', transactions: businessRows }), businessRows);
  assert.deepEqual(selectedWorkspaceTransactions(other, personalRows, { id: 'business', transactions: businessRows }), []);
  assert.deepEqual(selectedWorkspaceTransactions(undefined, personalRows, { id: 'business', transactions: businessRows }), []);
  assert.deepEqual(selectedWorkspaceTransactions(personal, personalRows, { id: 'business', transactions: businessRows }), personalRows);
  assert.equal(supportsPersonalFinance(business), false);
  assert.equal(supportsPersonalFinance(personal), true);
});

test('transactions and reports load all history and exports identify workspace and currency', async () => {
  const calls = [];
  const row = { id: 'old', workspaceId: 'business', revision: 4, createdBy: 'alice', type: 'expense', amountMinor: 1234, date: '2025-01-01', category: 'Office', description: '=unsafe', merchant: 'Shop' };
  const records = load(path.join(root, 'workspace-records.ts'), {
    './api': { fetchWorkspaceTransactions: async (id, page = 1) => {
      calls.push({ id, page });
      return { items: [{ ...row, id: page === 1 ? 'new' : 'old' }], total: 2, pageSize: 1, summary: { incomeMinor: 0, expenseMinor: 2468 } };
    } },
  });
  const history = await records.fetchAllWorkspaceTransactions('business');
  assert.deepEqual(calls, [{ id: 'business', page: 1 }, { id: 'business', page: 2 }]);
  assert.equal(history.length, 2);
  const mapped = records.workspaceTransaction(row, 'KWD');
  assert.equal(mapped.amount, 1.234);
  assert.equal(mapped.revision, 4);
  assert.equal(mapped.workspaceId, 'business');
  const csv = records.workspaceTransactionsCsv([mapped], { id: 'business', currency: 'KWD' });
  assert.match(csv, /workspace_id,currency/);
  assert.match(csv, /"business","KWD"/);
  assert.match(csv, /"1\.234"/);
  assert.match(csv, /"'=unsafe"/);
});

test('budget spending matches current-month categories case-insensitively', () => {
  const { budgetSpent } = load(path.join(root, 'finance.ts'));
  assert.equal(budgetSpent(
    { category: ' Food ', limit: 1000, period: 'monthly' },
    [
      { id: '1', type: 'expense', category: 'food', amount: 125, date: '2026-09-01' },
      { id: '2', type: 'expense', category: 'Transport', amount: 500, date: '2026-09-02' },
      { id: '3', type: 'income', category: 'Food', amount: 900, date: '2026-09-03' },
      { id: '4', type: 'expense', category: 'Food', amount: 75, date: '2026-08-31' },
    ],
    '2026-09',
  ), 125);
});

test('personal workspace import runs before the account refresh, and refresh still runs on import failure', async () => {
  const calls = [];
  const records = load(path.join(root, 'workspace-records.ts'), {
    './api': {
      fetchWorkspaceTransactions: async id => {
        calls.push(`workspace:${id}`);
        if (id === 'broken') throw new Error('workspace unavailable');
        return { items: [], total: 0, pageSize: 25 };
      },
    },
  });
  await records.refreshPersonalWorkspace('personal', async () => calls.push('account'));
  assert.deepEqual(calls, ['workspace:personal', 'account']);
  calls.length = 0;
  await assert.rejects(
    records.refreshPersonalWorkspace('broken', async () => calls.push('account')),
    /workspace unavailable/,
  );
  assert.deepEqual(calls, ['workspace:broken', 'account']);
});
