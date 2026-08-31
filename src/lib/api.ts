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

export type ApiSavingsGoalStatus = 'draft' | 'pending' | 'active' | 'completed' | 'withdrawn' | 'cancelled';

export type ApiSavingsGoal = {
  id: string;
  name: string;
  targetAmount: number;
  fundedAmount: number;
  targetDate?: string;
  asset: string;
  status: ApiSavingsGoalStatus;
  network?: string;
  ownerAddress?: string;
  contractId?: string;
  vaultGoalId?: string;
  transactionHash?: string;
};

export type StellarNetworkStatus = {
  network: 'testnet';
  passphrase: string;
  protocolVersion: number;
  latestLedger: number;
  horizonUrl: string;
  rpcUrl: string;
  vaultContractId: string | null;
  xlmSacId: string;
  sep7: {
    callbackEnabled: boolean;
    requestSigningEnabled: boolean;
    requestSigningPublicKey: string | null;
    originDomain: string | null;
  };
};

export type StellarPortfolio = {
  address: string;
  sequence: string;
  balances: { asset: string; issuer?: string; balance: string; assetType: string }[];
  subentryCount: number;
  lastModifiedLedger: number;
  explorerUrl: string;
  linked?: boolean;
  signingMode?: 'external-wallet';
  secretsStored?: false;
};

export type StellarSigningRequest = {
  idempotencyKey: string;
  kind: 'classic' | 'soroban';
  action: string;
  unsignedXdr: string;
  status: 'prepared' | 'submitted' | 'pending' | 'success' | 'failed';
  createdAt: string;
  network: 'testnet';
  networkPassphrase: string;
  signingUrl: string;
  fee?: string;
  savingsGoalId?: string;
  goalId?: string;
  hash: string;
  source: string;
  error?: string;
  callbackUrl: string | null;
  explorerUrl: string;
};

export type StellarTransactionSubmission = {
  kind: 'classic' | 'soroban';
  status: 'submitted' | 'pending' | 'success';
  hash: string;
  ledger?: number;
  latestLedger?: number;
  explorerUrl: string;
};

export type StellarVaultGoal = {
  id: string;
  owner: string;
  asset: string;
  targetAmount: string;
  targetDate: string | null;
  balance: string;
  status: 'Active' | 'Completed' | 'Cancelled' | string;
};

export type StellarVaultEvent = {
  id: string;
  ledger: number;
  ledgerClosedAt?: string;
  txHash: string;
  contractId: string;
  type: string;
  goalId: string | null;
  topics: unknown[];
  value: unknown;
  successful: boolean;
  explorerUrl: string;
};

export type StellarVaultGoalsResponse = {
  owner: string;
  goals: StellarVaultGoal[];
  events: StellarVaultEvent[];
  ledgerVerified: boolean;
  contractId: string;
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

async function apiError(response: Response, path: string) {
  let detail = '';
  try {
    const body = await response.json() as { message?: string | string[]; error?: string };
    detail = Array.isArray(body.message) ? body.message.join(', ') : body.message ?? body.error ?? '';
  } catch {
    // Some upstream/proxy failures do not return JSON.
  }
  return new Error(
    `SAVE API request failed: ${path} (HTTP ${response.status})${detail ? ` — ${detail}` : ''}`,
  );
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await apiError(response, path);
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

export async function fetchSavingsGoal(id: string): Promise<ApiSavingsGoal> {
  const url = `${getApiBaseUrl()}/savings-goals/${id}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load savings goal ${id} from ${url}`);
  return response.json() as Promise<ApiSavingsGoal>;
}

export function createSavingsGoal(payload: Partial<Omit<ApiSavingsGoal, 'id'>> & Pick<ApiSavingsGoal, 'name' | 'targetAmount'>) {
  return postJson<ApiSavingsGoal>('/savings-goals', payload);
}

export function updateSavingsGoal(id: string, payload: Partial<Omit<ApiSavingsGoal, 'id'>>) {
  return mutateJson<ApiSavingsGoal>(`/savings-goals/${id}`, 'PATCH', payload);
}

export function deleteSavingsGoal(id: string) {
  return mutateJson<{ deleted: boolean }>(`/savings-goals/${id}`, 'DELETE');
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`);
  if (!response.ok) throw await apiError(response, path);
  return response.json() as Promise<T>;
}

export function fetchStellarNetwork() {
  return getJson<StellarNetworkStatus>('/stellar/network');
}

export function linkStellarAccount(address: string) {
  return postJson<StellarPortfolio>('/stellar/accounts/link', { address });
}

export function fetchStellarPortfolio(address: string) {
  return getJson<StellarPortfolio>(`/stellar/accounts/${encodeURIComponent(address)}`);
}

export function fetchStellarPayments(address: string) {
  return getJson<{ id: string; type: string; from?: string; to?: string; amount?: string; asset?: string; transactionHash: string; createdAt: string; explorerUrl: string }[]>(`/stellar/accounts/${encodeURIComponent(address)}/payments?limit=10`);
}

export function prepareStellarPayment(payload: { source: string; destination: string; amount: string; memo?: string; idempotencyKey: string }) {
  return postJson<StellarSigningRequest>('/stellar/payments/prepare', payload);
}

export function prepareVaultInvocation(payload: {
  source: string;
  action: 'create_goal' | 'contribute' | 'complete_goal' | 'withdraw' | 'cancel_goal';
  idempotencyKey: string;
  owner?: string;
  contributor?: string;
  assetContractId?: string;
  goalId?: string;
  savingsGoalId?: string;
  targetAmount?: string;
  targetDate?: string;
  amount?: string;
}) {
  return postJson<StellarSigningRequest>('/stellar/vault/prepare', payload);
}

export function fetchVaultGoals(owner: string) {
  return getJson<StellarVaultGoalsResponse>(`/stellar/vault/goals/${encodeURIComponent(owner)}`);
}

export function fetchStellarSigningRequest(idempotencyKey: string) {
  return getJson<StellarSigningRequest>(`/stellar/signing-requests/${encodeURIComponent(idempotencyKey)}`);
}

export function submitStellarTransaction(payload: {
  signedXdr: string;
  kind: 'classic' | 'soroban';
  idempotencyKey: string;
}) {
  return postJson<StellarTransactionSubmission>('/stellar/transactions/submit', payload);
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
