import { useFinanceStore } from '@/store/finance-store';
import { useRefreshFinance } from './finance-data-provider';
export function useAccountFinance() {
  const data = useFinanceStore();
  return { ...data, currency: 'PHP', refresh: useRefreshFinance() };
}
