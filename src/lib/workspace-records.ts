import { fetchWorkspaceTransactions, type ApiTransaction, type ApiWorkspace, type ApiWorkspaceTransaction } from './api';
import { currencyDigits } from './workspace-money';
export async function refreshPersonalWorkspace(id: string, refreshAccount: () => Promise<void>) {
  try {
    await fetchWorkspaceTransactions(id);
  } finally {
    await refreshAccount();
  }
}
export async function fetchAllWorkspaceTransactions(id: string) {
  const first = await fetchWorkspaceTransactions(id);
  const rows = [...first.items];
  for (let page = 2; page <= Math.ceil(first.total / first.pageSize); page++) {
    const next = await fetchWorkspaceTransactions(id, page);
    if (next.total !== first.total || next.summary.incomeMinor !== first.summary.incomeMinor || next.summary.expenseMinor !== first.summary.expenseMinor)
      throw new Error('Workspace changed while syncing. Please refresh.');
    rows.push(...next.items);
  }
  if (rows.length !== first.total || new Set(rows.map(row => row.id)).size !== first.total)
    throw new Error('Workspace changed while syncing. Please refresh.');
  return rows;
}
export function workspaceTransaction(row: ApiWorkspaceTransaction, currency: string): ApiTransaction {
  return { ...row, userId: row.createdBy, amount: row.amountMinor / 10 ** currencyDigits(currency) };
}
export function workspaceTransactionsCsv(rows: ApiTransaction[], workspace: Pick<ApiWorkspace, 'id' | 'currency'>) {
  const escape = (value: unknown) => {
    const text = String(value ?? '');
    return `"${(/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
  };
  return ['workspace_id,currency,date,type,amount,category,description,merchant', ...rows.map(row => [
    workspace.id, workspace.currency, row.date, row.type,
    row.amount.toFixed(currencyDigits(workspace.currency)), row.category, row.description, row.merchant,
  ].map(escape).join(','))].join('\r\n');
}
