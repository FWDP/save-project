/* global __dirname */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const load = require('./load-typescript.cjs');

// Exercise the real screen handlers without a native renderer or network/storage.
function screen(overrides = {}) {
  const draft = {
    type: 'expense', amount: '125.50', date: '2026-10-28', category: 'Food',
    description: 'Lunch', merchant: ' Shop ', tin: '', recurring: false,
    receiptUri: undefined, ...overrides,
  };
  const saved = [];
  const messages = [];
  const navigation = [];
  let resets = 0;
  const store = {
    draft, patchDraft: values => Object.assign(draft, values), resetDraft: () => { resets++; },
  };
  const useDraft = Object.assign(() => store, { getState: () => store });
  const finance = { categories: [], transactions: [], setTransactions() {} };
  const useFinance = Object.assign(() => finance, { getState: () => finance });
  const jsx = (type, props) => ({ type, props: props || {} });
  const modules = {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: { useMemo: fn => fn(), useState: value => [value, next => { messages.push(next); }] },
    'react-native': { View: 'View', Pressable: 'Pressable', Switch: 'Switch', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value } },
    '@/components/accessible-text': { Text: 'Text', TextInput: 'TextInput' },
    '@/components/date-field': { DateField: 'DateField' },
    '@/components/providers/finance-data-provider': { useRefreshFinance: () => () => {} },
    '@/components/layout/finance-page': { FinancePage: 'FinancePage' },
    '@/lib/api': { scanReceiptWithAi: async () => { throw new Error('scan unavailable'); } },
    '@/lib/finance': load(path.join(__dirname, '../src/lib/finance.ts')),
    '@/lib/receipt-draft': {}, '@/lib/receipt-file': {}, 'expo-file-system': {},
    'expo-router': { useRouter: () => ({ replace: route => navigation.push(route) }) },
    '@/lib/transaction-writes': { saveTransactionDraft: async payload => { saved.push(payload); return { id: 'created', ...payload }; } },
    '@/store/expense-draft-store': { useExpenseDraftStore: useDraft },
    '@/store/finance-store': { useFinanceStore: useFinance },
  };
  const file = path.join(__dirname, '../src/app/expense-add.tsx');
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`);
    return modules[name];
  }, module, module.exports);
  const nodes = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node.type === 'function') return visit(node.type(node.props));
    nodes.push(node);
    visit(node.props.children);
  }
  visit(module.exports.default());
  const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
  const submit = nodes.find(node => node.type === 'Pressable' && text(node).startsWith('Add '));
  assert.ok(submit, 'Add transaction button is rendered');
  return { draft, saved, messages, navigation, nodes, submit: () => submit.props.onPress(), get resets() { return resets; } };
}

for (const type of ['expense', 'income']) {
  for (const tin of ['', '   ']) {
    test(`${type} saves with ${tin ? 'whitespace-only' : 'blank'} optional TIN`, async () => {
      const form = screen({ type, tin, receiptUri: 'file:///receipt.jpg' });
      await form.submit();
      assert.equal(form.saved.length, 1, 'missing OCR TIN must not block saving');
      assert.equal(form.saved[0].merchant, 'Shop');
      assert.equal(form.saved[0].customFields, undefined);
      assert.equal(form.resets, 1);
      assert.deepEqual(form.navigation, ['/expenses']);
    });
  }
  test(`${type} still requires merchant or source`, async () => {
    const form = screen({ type, merchant: '   ', tin: '001-234-567-00000' });
    await form.submit();
    assert.equal(form.saved.length, 0);
    assert.ok(form.messages.some(message => typeof message === 'string' && /merchant or source/.test(message)));
    assert.ok(!form.messages.some(message => typeof message === 'string' && /TIN.*required/.test(message)));
  });
}

test('TIN field is optional and remains editable with leading zeros and branch suffix preserved', async () => {
  const form = screen();
  const input = form.nodes.find(node => node.type === 'TextInput' && node.props.accessibilityLabel.startsWith('Merchant or source TIN'));
  assert.ok(input);
  assert.equal(input.props.accessibilityLabel.includes('*'), false);
  assert.match(input.props.accessibilityLabel, /optional/i);
  input.props.onChangeText(' 001-234-567-00000 ');
  await form.submit();
  assert.deepEqual(form.saved[0].customFields, { TIN: '001-234-567-00000' });
});

for (const invalid of [{ date: '2026-02-30' }, { amount: '0' }, { amount: 'NaN' }, { category: ' ' }, { description: ' ' }]) {
  test(`required transaction field remains validated: ${Object.keys(invalid)[0]}=${Object.values(invalid)[0]}`, async () => {
    const form = screen({ ...invalid, tin: '001-234-567-00000' });
    await form.submit();
    assert.equal(form.saved.length, 0);
  });
}

test('receipt prefill preserves VAT and non-VAT TIN digits without manufacturing absent TINs', () => {
  const { receiptDraftFields } = load(path.join(__dirname, '../src/lib/receipt-draft.ts'));
  const receipt = { merchant: 'Shop', amount: 125.5, date: '2026-10-28' };
  for (const tin of ['001-234-567-00000', '000-123-456-000']) {
    assert.equal(receiptDraftFields({ ...receipt, tin: ` ${tin} ` }, []).tin, tin);
  }
  for (const tin of [undefined, '', '   ']) {
    assert.equal(receiptDraftFields({ ...receipt, tin }, []).tin, '');
  }
});
