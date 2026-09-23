import type { ApiTransaction, ApiBudget } from './api';

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && localDate(parsed) === value;
}
export function shiftMonth(month: string, offset: number) {
  const [year, number] = month.split('-').map(Number);
  return localDate(new Date(year, number - 1 + offset, 1)).slice(0, 7);
}
export function monthTransactions(items: ApiTransaction[], month: string) {
  return items.filter(
    (item) => item.date.startsWith(`${month}-`) && item.status !== 'rejected',
  );
}
export function totalsFor(items: ApiTransaction[]) {
  const income =
    items
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Math.round(t.amount * 100), 0) / 100;
  const expenses =
    items
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Math.round(t.amount * 100), 0) / 100;
  return {
    income,
    expenses,
    balance: Math.round((income - expenses) * 100) / 100,
  };
}
export function budgetProgress(spent: number, limit: number) {
  return {
    percent: limit > 0 ? (spent / limit) * 100 : 0,
    width: limit > 0 ? Math.min(100, Math.max(0, (spent / limit) * 100)) : 0,
    remaining: Math.round((limit - spent) * 100) / 100,
  };
}
export function budgetSpent(
  budget: ApiBudget,
  items: ApiTransaction[],
  month: string,
) {
  return totalsFor(
    monthTransactions(items, month).filter(
      (t) => t.category === budget.category,
    ),
  ).expenses;
}
export function merchantTotals(items: ApiTransaction[]) {
  const merchants = new Map<
    string,
    { name: string; amount: number; count: number }
  >();
  for (const item of items.filter((t) => t.type === 'expense')) {
    const name = item.merchant?.trim() || item.description;
    const key = name.toLocaleLowerCase();
    const previous = merchants.get(key) ?? { name, amount: 0, count: 0 };
    merchants.set(key, {
      ...previous,
      amount: previous.amount + Math.round(item.amount * 100),
      count: previous.count + 1,
    });
  }
  return [...merchants.values()]
    .map((item) => ({ ...item, amount: item.amount / 100 }))
    .sort((a, b) => b.amount - a.amount);
}

export function validMoney(value: number) {
  return (
    Number.isFinite(value) &&
    value > 0 &&
    Number.isSafeInteger(Math.round(value * 100)) &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
  );
}
