import Constants from 'expo-constants';
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
  merchant?: string;
  tags?: string[];
  recurring?: boolean;
  receiptUri?: string;
  customFields?: Record<string, string>;
};

export type ApiBudget = {
  id: string;
  userId: string;
  category: string;
  limit: number;
  spent: number;
  period: 'monthly' | 'weekly';
};

export type ApiCategory = {
  id: string;
  name: string;
  type: 'expense' | 'income';
  color: string;
};

export type ApiSavingsGoal = {
  id: string;
  name: string;
  targetAmount: number;
  fundedAmount: number;
  targetDate?: string;
  asset: string;
  status: 'draft';
  transactionHash?: string;
  contractId?: string;
};

export function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (Platform.OS === 'web') {
    return 'http://localhost:3000';
  }

  // Detect Expo bundler host (works seamlessly for Expo Go on physical phones & dev builds)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:3000`;
    }
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }

  return 'http://localhost:3000';
}

export async function fetchTransactions(): Promise<ApiTransaction[]> {
  const url = `${getApiBaseUrl()}/transactions`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to load transactions from ${url} (HTTP ${response.status})`);
  }

  return response.json() as Promise<ApiTransaction[]>;
}

export async function fetchBudgets(): Promise<ApiBudget[]> {
  const url = `${getApiBaseUrl()}/budgets`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to load budgets from ${url} (HTTP ${response.status})`);
  }

  return response.json() as Promise<ApiBudget[]>;
}

export async function fetchCategories(): Promise<ApiCategory[]> {
  const url = `${getApiBaseUrl()}/categories`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to load categories from ${url} (HTTP ${response.status})`);
  }

  return response.json() as Promise<ApiCategory[]>;
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`SAVE API request failed: ${url} (HTTP ${response.status})`);
  return response.json() as Promise<T>;
}

export function createBudget(payload: Omit<ApiBudget, 'id' | 'spent'> & { spent?: number }) {
  return postJson<ApiBudget>('/budgets', payload);
}

export function createCategory(payload: Omit<ApiCategory, 'id'>) {
  return postJson<ApiCategory>('/categories', payload);
}

async function mutateJson<T>(path: string, method: 'PATCH' | 'DELETE', payload?: unknown): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const response = await fetch(url, {
    method,
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!response.ok) throw new Error(`SAVE API request failed: ${url} (HTTP ${response.status})`);
  return response.json() as Promise<T>;
}

export function updateCategory(id: string, payload: Partial<Omit<ApiCategory, 'id'>>) {
  return mutateJson<ApiCategory>(`/categories/${id}`, 'PATCH', payload);
}

export function deleteCategory(id: string) {
  return mutateJson<{ deleted: boolean }>(`/categories/${id}`, 'DELETE');
}

export function deleteTransaction(id: string) {
  return mutateJson<{ deleted: boolean }>(`/transactions/${id}`, 'DELETE');
}

export async function fetchSavingsGoals(): Promise<ApiSavingsGoal[]> {
  const url = `${getApiBaseUrl()}/savings-goals`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load savings goals from ${url} (HTTP ${response.status})`);
  return response.json() as Promise<ApiSavingsGoal[]>;
}

export function createSavingsGoal(payload: Pick<ApiSavingsGoal, 'name' | 'targetAmount' | 'targetDate' | 'asset'>) {
  return postJson<ApiSavingsGoal>('/savings-goals', payload);
}

export async function createTransaction(payload: Omit<ApiTransaction, 'id'>): Promise<ApiTransaction> {
  const url = `${getApiBaseUrl()}/transactions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Unable to save transaction to ${url} (HTTP ${response.status})`);
  }

  return response.json() as Promise<ApiTransaction>;
}
