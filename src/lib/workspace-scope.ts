import type { ApiWorkspace, ApiTransaction } from './api';
export function supportsPersonalFinance(workspace: ApiWorkspace | undefined) {
  return workspace?.kind === 'personal' && workspace.currency === 'PHP';
}
export function selectedWorkspaceTransactions(
  workspace: ApiWorkspace | undefined,
  personal: ApiTransaction[],
  snapshot: { id: string | null; transactions: ApiTransaction[] } | null,
) {
  if (!workspace) return [];
  if (supportsPersonalFinance(workspace)) return personal;
  return snapshot?.id === workspace.id ? snapshot.transactions : [];
}
