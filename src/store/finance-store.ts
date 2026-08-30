import { create } from 'zustand';

import type { ApiBudget, ApiCategory, ApiTransaction } from '@/lib/api';

type FinanceStore = {
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
  setSyncState: (syncError: string | null, lastUpdatedAt?: string | null) => void;
  clearTransactions: () => void;
};

export const useFinanceStore = create<FinanceStore>((set) => ({
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
  setSyncState: (syncError, lastUpdatedAt = null) => set({ syncError, lastUpdatedAt }),
  clearTransactions: () => set({ transactions: [] }),
}));
