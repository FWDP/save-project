import type { ApiTransaction } from './api';

export function filterTransactions(
  transactions: ApiTransaction[],
  options: { month?: string; type: 'all' | 'expense' | 'income'; search: string; ascending: boolean },
) {
  const query = options.search.trim().toLowerCase();
  return transactions
    .filter(item => !options.month || item.date.startsWith(`${options.month}-`))
    .filter(item => options.type === 'all' || item.type === options.type)
    .filter(item => !query || [item.description, item.merchant, item.category, ...(item.tags ?? [])]
      .some(value => value?.toLowerCase().includes(query)))
    .sort((a, b) => options.ascending ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
}
