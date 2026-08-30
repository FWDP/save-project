import { AppState } from 'react-native';
import { type PropsWithChildren, useCallback, useEffect, useRef } from 'react';

import { fetchBudgets, fetchCategories, fetchTransactions, getApiBaseUrl } from '@/lib/api';
import {
  initializeDatabase,
  loadCachedBudgets,
  loadCachedCategories,
  loadCachedTransactions,
  saveBudgets,
  saveCategories,
  saveTransactions,
} from '@/lib/sqlite';
import { useFinanceStore } from '@/store/finance-store';

const REFRESH_INTERVAL_MS = 30_000;

export function FinanceDataProvider({ children }: PropsWithChildren) {
  const isRefreshing = useRef(false);
  const {
    setBudgets,
    setCategories,
    setLoading,
    setSyncState,
    setTransactions,
  } = useFinanceStore();

  const refresh = useCallback(async () => {
    if (isRefreshing.current) return;
    isRefreshing.current = true;

    try {
      const baseUrl = getApiBaseUrl();
      console.log(`[FinanceDataProvider] Syncing data from API: ${baseUrl}`);

      const [transactionsResult, budgetsResult, categoriesResult] = await Promise.allSettled([
        fetchTransactions(),
        fetchBudgets(),
        fetchCategories(),
      ]);

      const failures: string[] = [];
      if (transactionsResult.status === 'fulfilled') {
        setTransactions(transactionsResult.value);
        try {
          saveTransactions(transactionsResult.value);
        } catch (err) {
          console.warn('[FinanceDataProvider] Failed to cache transactions in SQLite:', err);
        }
      } else {
        failures.push('transactions');
        console.warn('[FinanceDataProvider] Error fetching transactions:', transactionsResult.reason);
      }

      if (budgetsResult.status === 'fulfilled') {
        setBudgets(budgetsResult.value);
        try {
          saveBudgets(budgetsResult.value);
        } catch (err) {
          console.warn('[FinanceDataProvider] Failed to cache budgets in SQLite:', err);
        }
      } else {
        failures.push('budgets');
        console.warn('[FinanceDataProvider] Error fetching budgets:', budgetsResult.reason);
      }

      if (categoriesResult.status === 'fulfilled') {
        setCategories(categoriesResult.value);
        try {
          saveCategories(categoriesResult.value);
        } catch (err) {
          console.warn('[FinanceDataProvider] Failed to cache categories in SQLite:', err);
        }
      } else {
        failures.push('categories');
        console.warn('[FinanceDataProvider] Error fetching categories:', categoriesResult.reason);
      }

      setSyncState(
        failures.length ? `Offline cache: ${failures.join(' and ')} unavailable` : null,
        new Date().toISOString(),
      );
    } finally {
      setLoading(false);
      isRefreshing.current = false;
    }
  }, [setBudgets, setCategories, setLoading, setSyncState, setTransactions]);

  useEffect(() => {
    try {
      initializeDatabase();
      const cachedTxns = loadCachedTransactions();
      if (cachedTxns?.length) setTransactions(cachedTxns);
      const cachedBudgets = loadCachedBudgets();
      if (cachedBudgets?.length) setBudgets(cachedBudgets);
      const cachedCats = loadCachedCategories();
      if (cachedCats?.length) setCategories(cachedCats);
    } catch (err) {
      console.warn('[FinanceDataProvider] Failed initial SQLite load:', err);
    }

    void refresh();

    const interval = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [refresh, setBudgets, setCategories, setTransactions]);

  return children;
}
