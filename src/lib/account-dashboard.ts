import { type ApiTransaction, type ApiBudget } from './api';
import { currencyDigits } from './money';
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
  month: string, records: ApiTransaction[], budgets: ApiBudget[],
): AccountDashboardData {
  const transactions = monthTransactions(records, month).sort((a, b) => b.date.localeCompare(a.date));
  const scale = 10 ** currencyDigits('PHP');
  let income = 0;
  let expenses = 0;
  for (const row of transactions) {
    if (row.type === 'income') income += Math.round(row.amount * scale);
    else expenses += Math.round(row.amount * scale);
  }
  return {
    month, transactions,
    budgets: budgets.filter(budget => budget.period === 'monthly'),
    totals: { income: income / scale, expenses: expenses / scale, balance: (income - expenses) / scale },
  };
}

export type AccountDashboardData = {
  month: string;
  transactions: ApiTransaction[];
  budgets: ApiBudget[];
  totals: { income: number; expenses: number; balance: number };
};
