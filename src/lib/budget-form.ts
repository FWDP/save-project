import type { ApiBudget } from './api';
import { normalizeCategory } from './finance';
import { workspaceAmount } from './workspace-money';

export function prepareMonthlyBudget(category: string, limit: string, budgets: ApiBudget[], editing: string | null) {
  const label = category.trim();
  if (!label || label.length > 80 || label.split('/').some(part => !part.trim())) {
    throw new Error('Enter a category of up to 80 characters with non-empty category names.');
  }
  const existing = budgets.find(budget => budget.id !== editing && normalizeCategory(budget.category) === normalizeCategory(label));
  if (existing) {
    throw new Error(existing.period === 'weekly'
      ? 'This category has a weekly budget. Use “Convert to monthly” below instead.'
      : 'This category already has a monthly budget. Edit it below.');
  }
  if (editing && !budgets.some(budget => budget.id === editing)) {
    throw new Error('This budget was removed. Close the form and refresh before continuing.');
  }
  return { category: label, limit: workspaceAmount(limit, 'PHP') / 100, period: 'monthly' as const };
}
