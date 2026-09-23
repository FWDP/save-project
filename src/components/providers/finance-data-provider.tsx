import { flushTransactions } from '@/lib/transaction-writes';
import { AppState } from 'react-native';
import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { fetchBudgets, fetchCategories, fetchTransactions } from '@/lib/api';
import {
  initializeDatabase,
  loadAccountCache,
  saveAccountCache,
  clearPrivateCache,
  pendingTransactions,
} from '@/lib/sqlite';
import { useFinanceStore } from '@/store/finance-store';

const RefreshContext = createContext<() => Promise<void>>(async () => {});
export const useRefreshFinance = () => useContext(RefreshContext);
export function FinanceDataProvider({
  children,
  userId,
}: PropsWithChildren<{ userId: string | null }>) {
  const busy = useRef(false);
  const active = useRef(true);
  const refresh = useCallback(async () => {
    if (!userId || busy.current) return;
    busy.current = true;
    useFinanceStore.getState().setLoading(true);
    try {
      await flushTransactions(userId);
      if (!active.current) return;
      const initial = useFinanceStore.getState();
      // Apply one coherent snapshot; partial results must not mix periods or budgets.
      const [transactions, budgets, categories] = await Promise.all([
        fetchTransactions(),
        fetchBudgets(),
        fetchCategories(),
      ]);
      if (
        !active.current ||
        useFinanceStore.getState().transactions !== initial.transactions ||
        useFinanceStore.getState().budgets !== initial.budgets ||
        useFinanceStore.getState().categories !== initial.categories
      )
        return;
      const state = useFinanceStore.getState();
      state.setTransactions([...pendingTransactions(userId), ...transactions]);
      state.setBudgets(budgets);
      state.setCategories(categories);
      try {
        saveAccountCache(userId, { transactions, budgets, categories });
      } catch {
        /* Live data remains available. */
      }
      state.setSyncState(null, new Date().toISOString());
    } catch {
      if (active.current) {
        const state = useFinanceStore.getState();
        let pending: ReturnType<typeof pendingTransactions> = [];
        try {
          pending = pendingTransactions(userId);
        } catch {
          pending = state.transactions.filter(
            (item) => item.syncState === 'pending',
          );
        }
        const current = state.transactions.filter(
          (item) => item.syncState !== 'pending',
        );
        state.setTransactions([...pending, ...current]);
        state.setSyncState(
          pending.length
            ? `${pending.length} transaction(s) saved on this device, awaiting upload. Retry when connected.`
            : 'Could not sync. Showing your last loaded data.',
          state.lastUpdatedAt,
        );
      }
    } finally {
      if (active.current) useFinanceStore.getState().setLoading(false);
      busy.current = false;
    }
  }, [userId]);
  useEffect(() => {
    active.current = true;
    try {
      initializeDatabase();
      if (!userId) clearPrivateCache();
      else {
        const cached = loadAccountCache(userId);
        if (cached) {
          const state = useFinanceStore.getState();
          state.setTransactions(cached.transactions);
          state.setBudgets(cached.budgets);
          state.setCategories(cached.categories);
        }
      }
    } catch {
      /* An unavailable cache must not prevent a network refresh. */
    }
    const unsubscribe = useFinanceStore.subscribe((state) => {
      if (userId && active.current) {
        try {
          saveAccountCache(userId, {
            transactions: state.transactions,
            budgets: state.budgets,
            categories: state.categories,
          });
        } catch {
          /* Cache is optional. */
        }
      }
    });
    void refresh();
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, 30_000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      active.current = false;
      unsubscribe();
      clearInterval(interval);
      listener.remove();
    };
  }, [refresh, userId]);
  return (
    <RefreshContext.Provider value={refresh}>
      {children}
    </RefreshContext.Provider>
  );
}
