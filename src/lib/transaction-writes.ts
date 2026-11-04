import { createTransaction, type ApiTransaction } from './api';
export function saveTransactionDraft(payload: Omit<ApiTransaction, 'id'>) {
  return createTransaction(payload);
}
