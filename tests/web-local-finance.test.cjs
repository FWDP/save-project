const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const load = require('./load-typescript.cjs');
const { FINANCE_RESET_KEY, FINANCE_RESET_VERSION } = load('shared/finance-reset.ts');

function fixture(owner, disk = new Map(), actions) {
  const hooks = [];
  let cursor = 0;
  const listeners = [];
  let storageFails = false;
  global.localStorage = {
    getItem: key => disk.get(key) ?? null,
    get length() { return disk.size; }, key: index => [...disk.keys()][index] ?? null,
    removeItem: key => disk.delete(key),
    setItem: (key, value) => { if (storageFails) throw new Error('Quota exceeded'); disk.set(key, value); },
  };
  global.window = { addEventListener: (_, callback) => listeners.push(callback), removeEventListener() {} };
  const jsx = (type, props) => ({ type, props });
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    useState: initial => {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], value => { hooks[index] = value; }];
    },
    useRef: value => {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: value };
      return hooks[index];
    },
    useEffect: callback => { const index = cursor++; if (!(index in hooks)) { hooks[index] = true; callback(); } },
  };
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync('web/src/components/local-finance.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'module', 'exports', output)(name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name.startsWith('next/')) return {};
    if (name === '@/app/finance-sync-actions') return actions ?? { readDatabaseFinances: () => { throw new Error('Unexpected sync request'); }, writeDatabaseFinances: () => { throw new Error('Unexpected sync request'); } };
    if (name.endsWith('shared/finance-sync')) return load('shared/finance-sync.ts');
    if (name === '@/app/receipts/actions') return { scanReceipt: () => { throw new Error('Unexpected scan'); } };
    if (name.endsWith('shared/finance-reset')) return load('shared/finance-reset.ts');
    if (name.endsWith('shared/category-catalog')) return load('shared/category-catalog.ts');
    throw new Error(`Unexpected dependency: ${name}`);
  }, module, module.exports);
  const render = () => { cursor = 0; return module.exports.LocalFinanceProvider({ owner, children: null }).props.value; };
  render();
  return { render, disk, listeners, failWrites: () => { storageFails = true; } };
}
const empty = { transactions: [], budgets: [], categories: [], goals: [] };
test('web records and inline receipt photos survive reload and remain isolated by account', () => {
  const f = fixture('alice');
  const transaction = { id: 'local-1', description: 'Lunch', receiptUri: 'data:image/jpeg;base64,aW1hZ2U=' };
  assert.equal(f.render().save({ ...empty, transactions: [transaction] }), true);
  assert.deepEqual(fixture('alice', f.disk).render().data.transactions, [transaction]);
  assert.deepEqual(fixture('bob', f.disk).render().data.transactions, []);
});
test('web storage failures do not claim a successful save or replace durable data', () => {
  const f = fixture('alice');
  f.failWrites();
  assert.equal(f.render().save(empty), false);
  assert.match(f.render().error, /not been saved/);
  assert.equal(f.disk.has('save-local-finances:v1:alice'), false);
});
test('web refuses stale overwrites from another tab and damaged snapshots', () => {
  const f = fixture('alice');
  f.disk.set('save-local-finances:v1:alice', JSON.stringify(empty));
  assert.equal(f.render().save({ ...empty, goals: [{ id: 'goal' }] }), false);
  assert.match(f.render().error, /another tab/);
  const broken = fixture('alice', new Map([[FINANCE_RESET_KEY, FINANCE_RESET_VERSION], ['save-local-finances:v1:alice', '{broken']]));
  assert.equal(broken.render().ready, false);
  assert.equal(broken.render().save(empty), false);
});

test('browser sync stays off by default and explicitly uploads/downloads after opt-in', async () => {
  let calls = 0;
  const remote = { revision: 1, snapshot: { ...empty, transactions: [{ id: 'remote', amount: 20 }] } };
  const f = fixture('alice', new Map(), {
    readDatabaseFinances: async owner => { assert.equal(owner, 'alice'); calls++; return remote; },
    writeDatabaseFinances: async (owner, payload) => { assert.equal(owner, 'alice'); assert.equal(payload.consent, true); calls++; assert.ok(!JSON.stringify(payload).includes('receiptUri')); return { revision: 2, snapshot: payload.snapshot }; },
  });
  f.render().save({ ...empty, transactions: [{ id: 'local', receiptUri: 'data:image/jpeg;base64,private' }] });
  await f.render().synchronize();
  assert.equal(calls, 0);
  assert.equal(f.render().configureSync(true), true);
  await f.render().synchronize();
  assert.equal(calls, 2);
  assert.equal(f.render().data.transactions.length, 2);
  assert.equal(f.render().data.transactions.find(row => row.id === 'local').receiptUri, 'data:image/jpeg;base64,private');
  assert.ok(f.render().syncSettings.lastSyncedAt);
  f.render().configureSync(false);
  await f.render().synchronize();
  assert.equal(calls, 2);
});
test('browser edits during a sync are preserved rather than overwritten by a response', async () => {
  let f;
  f = fixture('alice', new Map(), {
    readDatabaseFinances: async () => { f.render().save({ ...empty, transactions: [{ id: 'new-edit' }] }); return { revision: 1, snapshot: empty }; },
    writeDatabaseFinances: async () => { throw new Error('Must not upload a stale snapshot'); },
  });
  f.render().configureSync(true);
  await f.render().synchronize();
  assert.deepEqual(f.render().data.transactions.map(row => row.id), ['new-edit']);
  assert.match(f.render().syncMessage, /Records changed/);
});
