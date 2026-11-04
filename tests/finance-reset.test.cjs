const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-typescript.cjs');
const policy = load('shared/finance-reset.ts');
function storage(values) {
  const disk = new Map(values);
  return { disk, get length() { return disk.size; }, key: index => [...disk.keys()][index], getItem: key => disk.get(key) ?? null, setItem: (key, value) => disk.set(key, value), removeItem: key => disk.delete(key) };
}
test('browser reset clears every account and old queues, retains sign-in, and runs once', () => {
  const local = storage([
    ['save-local-finances:v1:alice', 'private'], ['save-local-finances:v1:bob', 'private'],
    ['save-account-cache:alice', 'private'], ['save-outbox:bob', 'private'],
    ['@save-local-finances:v1:charlie', 'private'], ['save.stellar.testnet.account', 'address'],
    ['sb-auth-token', 'keep'], ['preferences', 'keep'],
  ]);
  policy.resetBrowserFinances(local);
  assert.deepEqual([...local.disk.keys()].sort(), [policy.FINANCE_RESET_KEY, 'sb-auth-token', 'preferences'].sort());
  local.setItem('save-local-finances:v1:alice', 'new test records');
  policy.resetBrowserFinances(local);
  assert.equal(local.getItem('save-local-finances:v1:alice'), 'new test records');
});
function mobileFixture() {
  const local = storage([['save-local-finances:v1:alice', 'old'], ['save-outbox:bob', 'old'], ['sb-auth-token', 'keep']]);
  const removed = [];
  let legacyResets = 0, fail = false;
  class Directory {
    constructor(base, name) { this.name = `${base}/${name}`; }
    exists = true;
    delete() { if (fail) throw new Error('Delete failed'); removed.push(this.name); }
  }
  const reset = load('src/lib/finance-reset.ts', {
    '@react-native-async-storage/async-storage': { ...local, getAllKeys: async () => [...local.disk.keys()], multiRemove: async keys => keys.forEach(key => local.removeItem(key)) },
    './sqlite': { initializeDatabase() {}, clearAllFinancialData() { legacyResets++; } },
    'expo-file-system': { Directory, Paths: { document: 'documents', cache: 'cache' } },
    'expo-secure-store': { deleteItemAsync: async key => removed.push(key) },
    'react-native': { Platform: { OS: 'android' } },
  });
  return { ...reset, local, removed, legacyResets: () => legacyResets, fail: value => { fail = value; } };
}
test('mobile reset clears all accounts, legacy storage and receipt photos once', async () => {
  const f = mobileFixture();
  await f.resetDeviceFinancesOnce();
  assert.equal(f.local.getItem('sb-auth-token'), 'keep');
  assert.equal(f.local.getItem('save-local-finances:v1:alice'), null);
  assert.equal(f.local.getItem('save-outbox:bob'), null);
  assert.deepEqual(f.removed, ['documents/receipts', 'cache/Camera', 'cache/ImageManipulator', 'save.stellar.testnet.account']);
  assert.equal(f.legacyResets(), 1);
  f.local.setItem('save-local-finances:v1:alice', 'new records');
  await f.resetDeviceFinancesOnce();
  assert.equal(f.local.getItem('save-local-finances:v1:alice'), 'new records');
  assert.equal(f.legacyResets(), 1);
});
test('interrupted photo cleanup retries before marking the reset complete', async () => {
  const f = mobileFixture();
  f.fail(true);
  await assert.rejects(f.resetDeviceFinancesOnce(), /Delete failed/);
  assert.equal(f.local.getItem(policy.FINANCE_RESET_KEY), null);
  f.fail(false);
  await f.resetDeviceFinancesOnce();
  assert.equal(f.local.getItem(policy.FINANCE_RESET_KEY), policy.FINANCE_RESET_VERSION);
});
