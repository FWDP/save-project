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
  const { installFormDataPatch } = load(path.join(__dirname, '../node_modules/expo/src/winter/FormData.ts'));
  class RNFormData { constructor() { this._parts = []; } }
  global.FormData = installFormDataPatch(RNFormData);
  const { convertFormDataAsync } = load(path.join(__dirname, '../node_modules/expo/src/winter/fetch/convertFormData.ts'), {
    '../../utils/blobUtils': { blobToArrayBufferAsync: blob => blob.arrayBuffer() },
  });
  let mime = 'image/jpeg';
  let fileSize = 13;
  let exists = true;
  class ReceiptFile {
    constructor(uri) { assert.equal(uri, 'file:///receipt.jpg'); }
    size = fileSize;
    exists = exists;
    name = 'receipt.jpg';
    type = mime;
    async bytes() { return new TextEncoder().encode('receipt-bytes'); }
    slice() { throw new Error('Creating blobs from ArrayBufferView is not supported'); }
  }
  const parsed = { merchant: 'Shop', amount: 125.5, date: '2026-10-03', category: 'Food' };
  global.fetch = async (url, options) => {
    assert.ok(url.endsWith('/receipts/scan'));
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.equal(options.headers['Content-Type'], undefined);
    const file = options.body.get('file');
    assert.ok(file instanceof ReceiptFile);
    assert.equal(file.type, mime);
    assert.equal(file.name, 'receipt.jpg');
    assert.equal(new TextDecoder().decode(await file.bytes()), 'receipt-bytes');
    assert.deepEqual(JSON.parse(options.body.get('categories')), ['Food']);
    const multipart = await convertFormDataAsync(options.body, 'test-boundary');
    assert.match(new TextDecoder().decode(multipart.body), /receipt-bytes/);
    assert.ok(new TextDecoder().decode(multipart.body).includes(`content-type: ${mime}`));
    return new Response(JSON.stringify(parsed), { status: 200 });
  };
  try {
    const api = load(path.join(root, 'api.ts'), {
      './auth': { accessToken: async () => 'test-token' },
      'expo-file-system': { File: ReceiptFile },
      'expo/fetch': { fetch: (...args) => global.fetch(...args) },
      'expo-constants': { default: {} }, 'react-native': { Platform: { OS: 'android' } },
    });
    assert.deepEqual(await api.scanReceiptWithAi('file:///receipt.jpg', 'image/jpeg', ['Food']), parsed);
    for (mime of ['image/png', 'image/webp']) {
      assert.deepEqual(await api.scanReceiptWithAi('file:///receipt.jpg', mime, ['Food']), parsed);
    }
    fileSize = 10 * 1024 * 1024 + 1;
    await assert.rejects(api.scanReceiptWithAi('file:///receipt.jpg'), /10 MB/);
    fileSize = 0;
    await assert.rejects(api.scanReceiptWithAi('file:///receipt.jpg'), /non-empty/);
    fileSize = 13; exists = false;
    await assert.rejects(api.scanReceiptWithAi('file:///receipt.jpg'), /existing/);
    exists = true;
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

test('dashboard derives live monthly totals from shared records, including pending changes', () => {
  const { dashboardFromTransactions } = load(path.join(root, 'workspace-dashboard.ts'), { './api': {} });
  const workspace = { id: 'personal', kind: 'personal', currency: 'PHP' };
  const budgets = [{ id: 'monthly', period: 'monthly', limit: 100 }, { id: 'yearly', period: 'yearly', limit: 1200 }];
  const rows = [
    { id: 'salary', type: 'income', amount: 1000, date: '2026-10-01' },
    { id: 'purchase', type: 'expense', amount: 25.75, date: '2026-10-02' },
    { id: 'pending', type: 'expense', amount: 10.1, date: '2026-10-03', syncState: 'pending' },
    { id: 'old', type: 'expense', amount: 500, date: '2026-09-30' },
    { id: 'rejected', type: 'expense', amount: 500, date: '2026-10-03', status: 'rejected' },
  ];
  const data = dashboardFromTransactions(workspace, '2026-10', rows, budgets);
  assert.deepEqual(data.totals, { income: 1000, expenses: 35.85, balance: 964.15 });
  assert.deepEqual(data.transactions.map(row => row.id), ['pending', 'purchase', 'salary']);
  assert.equal(data.transactions[0].syncState, 'pending');
  assert.deepEqual(data.budgets, [budgets[0]]);
  const updated = dashboardFromTransactions(workspace, '2026-10', rows.filter(row => row.id !== 'purchase'), budgets);
  assert.equal(updated.totals.expenses, 10.1);
  const business = dashboardFromTransactions({ id: 'business', kind: 'business', currency: 'KWD' }, '2026-10', [
    { id: 'income', type: 'income', amount: 1.234, date: '2026-10-01' },
    { id: 'expense', type: 'expense', amount: 0.111, date: '2026-10-02' },
  ], budgets);
  assert.deepEqual(business.totals, { income: 1.234, expenses: 0.111, balance: 1.123 });
  assert.deepEqual(business.budgets, []);
});

test('dashboard expense history includes every date, preserves details and counts, and searches without changing totals', () => {
  const { expenseHistory } = load(path.join(root, 'workspace-dashboard.ts'), { './api': {} });
  const rows = [
    { id: 'old', type: 'expense', amount: 10.25, date: '2025-01-01', description: 'Train', category: 'Travel', receiptUri: 'file:///receipt.jpg', recurring: true },
    { id: 'new', type: 'expense', amount: 20.1, date: '2026-10-03', description: 'Lunch', category: 'Food', tags: ['Work'], syncState: 'pending' },
    { id: 'rejected', type: 'expense', amount: 100, date: '2026-10-02', description: 'Rejected', status: 'rejected' },
    { id: 'salary', type: 'income', amount: 1000, date: '2026-10-01', description: 'Salary' },
  ];
  const result = expenseHistory(rows, 'PHP');
  assert.equal(result.count, 3);
  assert.equal(result.total, 30.35);
  assert.equal(result.pending, 1);
  assert.equal(result.rejected, 1);
  assert.deepEqual(result.rows.map(row => row.id), ['new', 'rejected', 'old']);
  assert.equal(result.rows[2].receiptUri, 'file:///receipt.jpg');
  const filtered = expenseHistory(rows, 'PHP', 'work');
  assert.equal(filtered.total, 30.35);
  assert.equal(filtered.count, 3);
  assert.deepEqual(filtered.rows.map(row => row.id), ['new']);
  assert.equal(expenseHistory([{ ...rows[0], amount: 1.234 }], 'KWD').total, 1.234);
});

test('all-date expense total updates after additions, edits and deletions independently of dashboard month', () => {
  const { expenseHistory, dashboardFromTransactions } = load(path.join(root, 'workspace-dashboard.ts'), { './api': {} });
  const workspace = { id: 'personal', kind: 'personal', currency: 'PHP' };
  const old = { id: 'old', type: 'expense', amount: 100, date: '2025-01-01' };
  const current = { id: 'current', type: 'expense', amount: 25.5, date: '2026-10-03' };
  const rows = [old, current];
  assert.equal(dashboardFromTransactions(workspace, '2026-10', rows, []).totals.expenses, 25.5);
  assert.equal(expenseHistory(rows, 'PHP').total, 125.5);
  const added = [...rows, { id: 'new', type: 'expense', amount: 10, date: '2026-09-01', syncState: 'pending' }];
  assert.equal(expenseHistory(added, 'PHP').total, 135.5);
  assert.equal(expenseHistory(added.map(row => row.id === 'old' ? { ...row, amount: 200 } : row), 'PHP').total, 235.5);
  assert.equal(expenseHistory(added.filter(row => row.id !== 'current'), 'PHP').total, 110);
});

test('budgets keep full category paths separate and sum exact centavos', () => {
  const { budgetSpent, normalizeCategory } = load(path.join(root, 'finance.ts'));
  const budget = { category: 'Food / Other', limit: 100, period: 'monthly' };
  const rows = [
    { type: 'expense', category: ' food/other ', amount: 0.1, date: '2026-10-01' },
    { type: 'expense', category: 'Food / Other', amount: 0.2, date: '2026-10-02', syncState: 'pending' },
    { type: 'expense', category: 'Travel / Other', amount: 100, date: '2026-10-01' },
    { type: 'expense', category: 'Other', amount: 100, date: '2026-10-01' },
    { type: 'expense', category: 'Food / Other', amount: 100, date: '2026-10-01', status: 'rejected' },
    { type: 'income', category: 'Food / Other', amount: 100, date: '2026-10-01' },
    { type: 'expense', category: 'Food / Other', amount: 100, date: '2026-09-01' },
  ];
  assert.equal(budgetSpent(budget, rows, '2026-10'), 0.3);
  assert.equal(normalizeCategory(' Food/ OTHER '), normalizeCategory(budget.category));
  assert.notEqual(normalizeCategory('Travel / Other'), normalizeCategory(budget.category));
});

test('budget edits respect category-wide uniqueness, weekly conversion and PHP precision', () => {
  const { prepareMonthlyBudget } = load(path.join(root, 'budget-form.ts'));
  const budgets = [{ id: 'weekly', category: 'Food / Lunch', limit: 100, period: 'weekly' }];
  assert.throws(() => prepareMonthlyBudget(' food/lunch ', '200', budgets, null), /weekly budget/);
  assert.deepEqual(prepareMonthlyBudget('Food / Lunch', '200.50', budgets, 'weekly'), { category: 'Food / Lunch', limit: 200.5, period: 'monthly' });
  for (const amount of ['0', '-1', '1.001', '1e3', 'Infinity'])
    assert.throws(() => prepareMonthlyBudget('Food', amount, [], null));
  for (const category of ['', 'Food / ', 'a'.repeat(81)])
    assert.throws(() => prepareMonthlyBudget(category, '100', [], null));
  assert.throws(() => prepareMonthlyBudget('Food', '100', [], 'deleted'), /removed/);
});

test('budget summary counts each expense once despite legacy duplicate budgets', () => {
  const { totalBudgetSpent } = load(path.join(root, 'finance.ts'));
  const budgets = [
    { category: 'Food', period: 'monthly' }, { category: ' food ', period: 'monthly' },
    { category: 'Travel', period: 'weekly' },
  ];
  const rows = [
    { type: 'expense', category: 'Food', amount: 10.1, date: '2026-10-01' },
    { type: 'expense', category: 'Travel', amount: 50, date: '2026-10-01' },
  ];
  assert.equal(totalBudgetSpent(budgets, rows, '2026-10'), 10.1);
});

test('parent budgets include subcategory expenses without double-counting the overall spending', () => {
  const { budgetSpent, totalBudgetSpent, budgetCategoryMatches } = load(path.join(root, 'finance.ts'));
  const parent = { category: 'Food & Dining', limit: 1000, period: 'monthly' };
  const child = { category: 'Food & Dining / Groceries', limit: 500, period: 'monthly' };
  const rows = [
    { type: 'expense', category: 'food & dining/ groceries', amount: 125.5, date: '2026-10-01' },
    { type: 'expense', category: 'Food & Dining / Dine Out', amount: 50, date: '2026-10-02' },
    { type: 'expense', category: 'Food & Dining', amount: 10, date: '2026-10-03' },
    { type: 'expense', category: 'Food & Dining / Groceries', amount: 100, date: '2026-09-30' },
    { type: 'income', category: 'Food & Dining / Groceries', amount: 1000, date: '2026-10-01' },
    { type: 'expense', category: 'Food & Dining / Groceries', amount: 1000, date: '2026-10-01', status: 'rejected' },
  ];
  assert.equal(budgetSpent(parent, rows, '2026-10'), 185.5);
  assert.equal(budgetSpent(child, rows, '2026-10'), 125.5);
  assert.equal(totalBudgetSpent([parent, child], rows, '2026-10'), 185.5);
  assert.equal(budgetCategoryMatches('Food', 'Food & Dining'), false);
  assert.equal(budgetCategoryMatches('Food / Other', 'Travel / Other'), false);
  assert.equal(budgetCategoryMatches('Food / Other', 'Other'), false);
});

test('mobile account creation redirects to workspaces instead of dashboard', () => {
  let createdUrl = '';
  const auth = load(path.join(root, 'auth.ts'), {
    'expo-linking': {
      createURL: (route, options) => {
        const query = options?.queryParams?.next ? `?next=${encodeURIComponent(options.queryParams.next)}` : '';
        return `save://${route.replace(/^\//, '')}${query}`;
      },
    },
    'expo-secure-store': {},
    'expo-web-browser': {},
    'react-native': { Platform: { OS: 'ios' } },
    '@supabase/supabase-js': { createClient: () => ({}) },
  });

  assert.equal(auth.authRedirect(), 'save://auth/callback');
  assert.equal(auth.authRedirect('/workspaces'), 'save://auth/callback?next=%2Fworkspaces');

  assert.equal(auth.consumePostAuthRedirect(), null);
  auth.setPendingPostAuthRedirect('/workspaces');
  assert.equal(auth.consumePostAuthRedirect(), '/workspaces');
  assert.equal(auth.consumePostAuthRedirect(), null);
});
