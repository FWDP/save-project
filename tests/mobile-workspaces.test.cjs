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

test('money amounts preserve currency precision and reject rounding', () => {
  const { parseMoney } = load(path.join(root, 'money.ts'));
  assert.equal(parseMoney('12.34', 'PHP'), 1234);
  assert.equal(parseMoney('123', 'JPY'), 123);
  assert.equal(parseMoney('12.345', 'KWD'), 12345);
  for (const [amount, currency] of [['1.001', 'PHP'], ['1.5', 'JPY'], ['0', 'PHP'], ['-1', 'USD'], ['1e3', 'USD']])
    assert.throws(() => parseMoney(amount, currency));
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
  const { dashboardFromTransactions } = load(path.join(root, 'account-dashboard.ts'), { './api': {} });
  const budgets = [{ id: 'monthly', period: 'monthly', limit: 100 }, { id: 'yearly', period: 'yearly', limit: 1200 }];
  const rows = [
    { id: 'salary', type: 'income', amount: 1000, date: '2026-10-01' },
    { id: 'purchase', type: 'expense', amount: 25.75, date: '2026-10-02' },
    { id: 'pending', type: 'expense', amount: 10.1, date: '2026-10-03', syncState: 'pending' },
    { id: 'old', type: 'expense', amount: 500, date: '2026-09-30' },
    { id: 'rejected', type: 'expense', amount: 500, date: '2026-10-03', status: 'rejected' },
  ];
  const data = dashboardFromTransactions('2026-10', rows, budgets);
  assert.deepEqual(data.totals, { income: 1000, expenses: 35.85, balance: 964.15 });
  assert.deepEqual(data.transactions.map(row => row.id), ['pending', 'purchase', 'salary']);
  assert.equal(data.transactions[0].syncState, 'pending');
  assert.deepEqual(data.budgets, [budgets[0]]);
  const updated = dashboardFromTransactions('2026-10', rows.filter(row => row.id !== 'purchase'), budgets);
  assert.equal(updated.totals.expenses, 10.1);
});

test('dashboard expense history includes every date, preserves details and counts, and searches without changing totals', () => {
  const { expenseHistory } = load(path.join(root, 'account-dashboard.ts'), { './api': {} });
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
  const { expenseHistory, dashboardFromTransactions } = load(path.join(root, 'account-dashboard.ts'), { './api': {} });
  const old = { id: 'old', type: 'expense', amount: 100, date: '2025-01-01' };
  const current = { id: 'current', type: 'expense', amount: 25.5, date: '2026-10-03' };
  const rows = [old, current];
  assert.equal(dashboardFromTransactions('2026-10', rows, []).totals.expenses, 25.5);
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

test('mobile account creation supports a direct dashboard redirect', () => {
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
  assert.equal(auth.authRedirect('/'), 'save://auth/callback?next=%2F');

  assert.equal(auth.consumePostAuthRedirect(), null);
  auth.setPendingPostAuthRedirect('/');
  assert.equal(auth.consumePostAuthRedirect(), '/');
  assert.equal(auth.consumePostAuthRedirect(), null);
});

 test('account CSV exports all supplied records without a workspace and escapes spreadsheet formulas', () => {
  const { accountTransactionsCsv } = load(path.join(root, 'account-records.ts'));
  const csv = accountTransactionsCsv([{date:'2026-10-01',type:'expense',amount:12.34,category:'Food',description:'=unsafe',merchant:'Shop'}]);
  assert.match(csv, /^currency,date,type,amount/);
  assert.match(csv, /"PHP"/); assert.match(csv, /"12\.34"/); assert.match(csv, /"'=unsafe"/);
 });
