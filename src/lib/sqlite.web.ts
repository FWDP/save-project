import type { ApiBudget, ApiCategory, ApiTransaction } from './api';
type Snapshot = {
  transactions: ApiTransaction[];
  budgets: ApiBudget[];
  categories: ApiCategory[];
};
const cachePrefix = 'save-account-cache:';
const queuePrefix = 'save-outbox:';
function storage() {
  if (typeof window === 'undefined')
    throw new Error('Browser storage unavailable');
  return window.localStorage;
}
export function initializeDatabase() {
  /* Browser persistence does not need a native database. */
}
export function loadAccountCache(userId: string): Snapshot | null {
  const raw = storage().getItem(cachePrefix + userId);
  return raw ? JSON.parse(raw) : null;
}
export function saveAccountCache(userId: string, snapshot: Snapshot) {
  storage().setItem(cachePrefix + userId, JSON.stringify(snapshot));
}
export function clearPrivateCache() {
  const local = storage();
  for (const key of Object.keys(local))
    if (key.startsWith(cachePrefix)) local.removeItem(key);
}
export function pendingTransactions(userId: string): ApiTransaction[] {
  return JSON.parse(storage().getItem(queuePrefix + userId) ?? '[]');
}
export function enqueueTransaction(
  userId: string,
  transaction: ApiTransaction,
) {
  storage().setItem(
    queuePrefix + userId,
    JSON.stringify([...pendingTransactions(userId), transaction]),
  );
}
export function acknowledgeTransaction(id: string, userId: string) {
  storage().setItem(
    queuePrefix + userId,
    JSON.stringify(
      pendingTransactions(userId).filter((item) => item.id !== id),
    ),
  );
}
