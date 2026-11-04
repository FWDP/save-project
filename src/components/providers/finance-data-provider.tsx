import { loadLocalFinances } from '@/lib/local-finance';
import { useFinanceStore } from '@/store/finance-store';
import { type PropsWithChildren, createContext, useCallback, useContext, useEffect, useRef } from 'react';

const RefreshContext = createContext<() => Promise<void>>(async () => {});
export const useRefreshFinance = () => useContext(RefreshContext);
export function FinanceDataProvider({ children, userId }: PropsWithChildren<{ userId: string | null }>) {
  const activeOwner = useRef(userId);
  const refresh = useCallback(async () => {
    if (!userId) return;
    useFinanceStore.getState().setLoading(true);
    try {
      const data = await loadLocalFinances(userId);
      if (activeOwner.current !== userId) return;
      const state = useFinanceStore.getState();
      state.setTransactions(data.transactions);
      state.setBudgets(data.budgets);
      state.setCategories(data.categories);
      state.setSyncState(null, new Date().toISOString());
    } catch {
      if (activeOwner.current === userId)
        useFinanceStore.getState().setSyncState('Could not read storage on this device. Please retry.');
    } finally {
      if (activeOwner.current === userId) useFinanceStore.getState().setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    activeOwner.current = userId;
    useFinanceStore.getState().reset();
    void refresh();
    // Signing out clears memory only. Device records remain isolated by account.
    return () => { activeOwner.current = null; };
  }, [refresh, userId]);
  return <RefreshContext.Provider value={refresh}>{children}</RefreshContext.Provider>;
}
