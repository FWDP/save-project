import { fetchWorkspaceTransactions, fetchBudgets, type ApiWorkspace, type ApiTransaction, type ApiBudget } from './api';
import { currencyDigits } from './workspace-money';
import { monthTransactions } from './finance';
import { filterTransactions } from './transaction-filters';

export function expenseHistory(records: ApiTransaction[], currency: string, search = '') {
  const expenses = records.filter(row => row.type === 'expense');
  const scale = 10 ** currencyDigits(currency);
  return {
    count: expenses.length,
    total: expenses.filter(row => row.status !== 'rejected').reduce((sum, row) => sum + Math.round(row.amount * scale), 0) / scale,
    pending: expenses.filter(row => row.syncState === 'pending').length,
    rejected: expenses.filter(row => row.status === 'rejected').length,
    rows: filterTransactions(expenses, { type: 'expense', search, ascending: false }),
  };
}

export function dashboardFromTransactions(
  workspace: ApiWorkspace, month: string, records: ApiTransaction[], budgets: ApiBudget[],
): WorkspaceDashboardData {
  const transactions = monthTransactions(records, month).sort((a, b) => b.date.localeCompare(a.date));
  const scale = 10 ** currencyDigits(workspace.currency);
  let income = 0;
  let expenses = 0;
  for (const row of transactions) {
    if (row.type === 'income') income += Math.round(row.amount * scale);
    else expenses += Math.round(row.amount * scale);
  }
  return {
    workspaceId: workspace.id, month, transactions,
    budgets: workspace.kind === 'personal' && workspace.currency === 'PHP'
      ? budgets.filter(budget => budget.period === 'monthly') : [],
    totals: { income: income / scale, expenses: expenses / scale, balance: (income - expenses) / scale },
  };
}

export type WorkspaceDashboardData = {
  workspaceId: string;
  month: string;
  transactions: ApiTransaction[];
  budgets: ApiBudget[];
  totals: { income: number; expenses: number; balance: number };
};
export async function loadWorkspaceDashboard(workspace: ApiWorkspace, month: string): Promise<WorkspaceDashboardData> {
  const first = await fetchWorkspaceTransactions(workspace.id, 1, month);
  const rows = [...first.items];
  const pages = Math.ceil(first.total / first.pageSize);
  for (let page = 2; page <= pages; page++) {
    const next = await fetchWorkspaceTransactions(workspace.id, page, month);
    if (next.total !== first.total || next.summary.incomeMinor !== first.summary.incomeMinor || next.summary.expenseMinor !== first.summary.expenseMinor)
      throw new Error('Workspace records changed while syncing. Please refresh.');
    rows.push(...next.items);
  }
  if (rows.length !== first.total || new Set(rows.map(row => row.id)).size !== first.total)
    throw new Error('Workspace records changed while syncing. Please refresh.');
  const scale = 10 ** currencyDigits(workspace.currency);
  const budgets = workspace.kind === 'personal' && workspace.currency === 'PHP'
    ? (await fetchBudgets()).filter(budget => budget.period === 'monthly') : [];
  return {
    workspaceId: workspace.id, month, budgets,
    transactions: rows.map(row => ({
      id: row.id, userId: row.createdBy, type: row.type, amount: row.amountMinor / scale,
      description: row.description, category: row.category, merchant: row.merchant, date: row.date,
    })),
    totals: { income: first.summary.incomeMinor / scale, expenses: first.summary.expenseMinor / scale, balance: first.summary.balanceMinor / scale },
  };
}
