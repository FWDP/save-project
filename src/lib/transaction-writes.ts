import { validDate, validMoney } from './finance';
import { useFinanceStore } from '@/store/finance-store';
import { randomUUID } from 'expo-crypto';
import { createTransaction, type ApiTransaction } from './api';
import { getAuthUser } from './auth';
import {
  acknowledgeTransaction,
  enqueueTransaction,
  pendingTransactions,
} from './sqlite';
const flushes = new Map<string, Promise<ApiTransaction[]>>();
export async function flushTransactions(userId: string) {
  const existing = flushes.get(userId);
  if (existing) return existing;
  const flushing = (async () => {
    const uploaded: ApiTransaction[] = [];
    for (const item of pendingTransactions(userId)) {
      if ((await getAuthUser())?.id !== userId) break;
      const { id: _id, syncState: _syncState, ...payload } = item;
      const created = await createTransaction(payload);
      acknowledgeTransaction(item.id, userId);
      uploaded.push(created);
      if ((await getAuthUser())?.id === userId) {
        const state = useFinanceStore.getState();
        state.setTransactions([
          created,
          ...state.transactions.filter(
            (row) => row.id !== item.id && row.id !== created.id,
          ),
        ]);
      }
    }
    return uploaded;
  })();
  flushes.set(userId, flushing);
  try {
    return await flushing;
  } finally {
    flushes.delete(userId);
  }
}
export async function saveTransactionDraft(
  payload: Omit<ApiTransaction, 'id'>,
) {
  if (
    !validDate(payload.date) ||
    !validMoney(payload.amount) ||
    !payload.category.trim() ||
    !payload.description.trim()
  )
    throw new Error(
      'Enter a valid date and positive PHP amount with at most two decimal places.',
    );
  const user = await getAuthUser();
  if (!user) throw new Error('Sign in to save this transaction.');
  const clientMutationId = randomUUID();
  const item: ApiTransaction = {
    ...payload,
    userId: user.id,
    id: `local_${clientMutationId}`,
    clientMutationId,
    syncState: 'pending',
  };
  enqueueTransaction(user.id, item);
  // The durable outbox is retried by the provider; no failed request is called synced.
  return item;
}
