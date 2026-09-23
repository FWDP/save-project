import { create } from 'zustand';
import { localDate } from '@/lib/finance';

import type { ApiBudget, ApiCategory, ApiTransaction } from '@/lib/api';

type FinanceStore = {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  reset: () => void;
  transactions: ApiTransaction[];
  budgets: ApiBudget[];
  categories: ApiCategory[];
  isLoading: boolean;
  syncError: string | null;
  lastUpdatedAt: string | null;
  setTransactions: (transactions: ApiTransaction[]) => void;
  setBudgets: (budgets: ApiBudget[]) => void;
  setCategories: (categories: ApiCategory[]) => void;
  setLoading: (isLoading: boolean) => void;
  setSyncState: (
    syncError: string | null,
    lastUpdatedAt?: string | null,
  ) => void;
  clearTransactions: () => void;
};

export const useFinanceStore = create<FinanceStore>((set) => ({
  selectedMonth: localDate().slice(0, 7),
  setSelectedMonth: (selectedMonth) => set({ selectedMonth }),
  reset: () =>
    set({
      transactions: [],
      budgets: [],
      categories: [],
      isLoading: false,
      syncError: null,
      lastUpdatedAt: null,
    }),
  transactions: [],
  budgets: [],
  categories: [],
  isLoading: true,
  syncError: null,
  lastUpdatedAt: null,
  setTransactions: (transactions) => set({ transactions }),
  setBudgets: (budgets) => set({ budgets }),
  setCategories: (categories) => set({ categories }),
  setLoading: (isLoading) => set({ isLoading }),
  setSyncState: (syncError, lastUpdatedAt = null) =>
    set({ syncError, lastUpdatedAt }),
  clearTransactions: () => set({ transactions: [] }),
}));
