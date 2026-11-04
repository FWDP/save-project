// One-time reset requested for testing on November 4, 2026.
export const FINANCE_RESET_KEY = 'save-finance-reset';
export const FINANCE_RESET_VERSION = '2026-11-04-testing-1';
export function isFinancialStorageKey(key: string) {
  const normalized = key.startsWith('@') ? key.slice(1) : key;
  return ['save-local-finances:', 'save-account-cache:', 'save-outbox:'].some(prefix => normalized.startsWith(prefix))
    || normalized === 'save.stellar.testnet.account';
}
export function resetBrowserFinances(storage: Storage) {
  if (storage.getItem(FINANCE_RESET_KEY) === FINANCE_RESET_VERSION) return;
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  for (const key of keys) if (key && isFinancialStorageKey(key)) storage.removeItem(key);
  storage.setItem(FINANCE_RESET_KEY, FINANCE_RESET_VERSION);
}
