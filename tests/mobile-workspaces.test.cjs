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

test('receipt scans upload native files as authenticated multipart and surface API errors', async () => {
  const previousFetch = global.fetch;
  const previousFormData = global.FormData;
  class NativeFormData {
    fields = new Map();
    append(name, value) { this.fields.set(name, value); }
  }
  global.FormData = NativeFormData;
  const parsed = { merchant: 'Shop', amount: 125.5, date: '2026-10-03', category: 'Food' };
  global.fetch = async (url, options) => {
    assert.ok(url.endsWith('/receipts/scan'));
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.equal(options.headers['Content-Type'], undefined);
    assert.deepEqual(options.body.fields.get('file'), { uri: 'file:///receipt.jpg', type: 'image/jpeg', name: 'receipt.jpeg' });
    assert.deepEqual(JSON.parse(options.body.fields.get('categories')), ['Food']);
    return new Response(JSON.stringify(parsed), { status: 200 });
  };
  try {
    const api = load(path.join(root, 'api.ts'), {
      './auth': { accessToken: async () => 'test-token' },
      'expo-constants': { default: {} }, 'react-native': { Platform: { OS: 'android' } },
    });
    assert.deepEqual(await api.scanReceiptWithAi('file:///receipt.jpg', 'image/jpeg', ['Food']), parsed);
    await assert.rejects(api.scanReceiptWithAi('file:///receipt.pdf', 'application/pdf'), /Convert PDFs/);
    global.fetch = async () => new Response(JSON.stringify({ message: 'Gemini Live could not complete the scan.' }), { status: 503 });
    await assert.rejects(api.scanReceiptWithAi('file:///receipt.jpg'), /Gemini Live could not complete/);
  } finally { global.fetch = previousFetch; global.FormData = previousFormData; }
});

test('receipt results fill editable fields with Web limits and retain transaction type and personal details', () => {
  const { receiptDraftFields } = load(path.join(root, 'receipt-draft.ts'));
  const receipt = { merchant: '  Shop  ', amount: 125.5, date: '2026-10-02', currency: 'PHP', category: 'food / lunch', notes: 'Lunch items' };
  const fields = receiptDraftFields(receipt, [{ name: 'Food / Lunch' }]);
  assert.deepEqual(fields, { merchant: 'Shop', amount: '125.5', date: '2026-10-02', category: 'Food / Lunch', description: 'Lunch items' });
  const draft = { type: 'income', tags: 'work', customFields: [{ label: 'Project', value: 'SAVE' }], receiptUri: 'file:///receipt.jpg', amount: '', date: '2026-10-03' };
  const filled = { ...draft, ...fields };
  assert.equal(filled.type, 'income');
  assert.equal(filled.tags, 'work');
  assert.equal(filled.customFields, draft.customFields);
  assert.equal(filled.receiptUri, draft.receiptUri);
  assert.equal(filled.date, '2026-10-02');
  assert.equal(receiptDraftFields({ ...receipt, notes: undefined }, []).description, 'Purchase at Shop');
  assert.equal(receiptDraftFields({ ...receipt, notes: 'x'.repeat(2000) }, []).description.length, 160);
  assert.throws(() => receiptDraftFields({ ...receipt, currency: 'USD' }, []), /converted amount/);
  assert.throws(() => receiptDraftFields({ ...receipt, date: '2026-02-30' }, []), /amount or date/);
  assert.throws(() => receiptDraftFields({ ...receipt, amount: 0 }, []), /amount or date/);
});

test('Transactions shows both types across all dates and pending uploads unless explicitly filtered', () => {
  const { filterTransactions } = load(path.join(root, 'transaction-filters.ts'));
  const rows = [
    { id: 'old-income', type: 'income', date: '2025-01-10', description: 'Salary', category: 'Work' },
    { id: 'expense', type: 'expense', date: '2026-09-01', description: 'Lunch', merchant: 'Cafe', category: 'Food' },
    { id: 'pending', type: 'expense', date: '2026-10-03', description: 'Train', tags: ['Travel'], syncState: 'pending' },
  ];
  const options = { type: 'all', search: '', ascending: false };
  assert.deepEqual(filterTransactions(rows, options).map(row => row.id), ['pending', 'expense', 'old-income']);
  assert.deepEqual(filterTransactions(rows, { ...options, type: 'income' }).map(row => row.id), ['old-income']);
  assert.deepEqual(filterTransactions(rows, { ...options, month: '2026-09' }).map(row => row.id), ['expense']);
  assert.deepEqual(filterTransactions(rows, { ...options, search: ' TRAVEL ' }).map(row => row.id), ['pending']);
  assert.deepEqual(filterTransactions(rows, { ...options, search: 'cafe' }).map(row => row.id), ['expense']);
  assert.deepEqual(filterTransactions(rows, { ...options, ascending: true }).map(row => row.id), ['old-income', 'expense', 'pending']);
  assert.equal(rows[0].id, 'old-income');
});
