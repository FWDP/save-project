import { Platform } from 'react-native';

export type ApiTransaction = {
  id: string;
  userId: string;
  type: 'expense' | 'income';
  amount: number;
  category: string;
  description: string;
  date: string;
  status?: 'pending' | 'approved' | 'rejected';
};

const DEFAULT_API_URL = Platform.OS === 'web' ? 'http://localhost:3000' : 'http://10.0.2.2:3000';

export function getApiBaseUrl() {
  return process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL;
}

export async function fetchTransactions(): Promise<ApiTransaction[]> {
  const response = await fetch(`${getApiBaseUrl()}/transactions`);

  if (!response.ok) {
    throw new Error('Unable to load transactions from the SAVE API');
  }

  return response.json() as Promise<ApiTransaction[]>;
}

export async function createTransaction(payload: Omit<ApiTransaction, 'id'>): Promise<ApiTransaction> {
  const response = await fetch(`${getApiBaseUrl()}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Unable to save a new transaction');
  }

  return response.json() as Promise<ApiTransaction>;
}
