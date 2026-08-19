import { create } from 'zustand';

import type { ApiTransaction } from '@/lib/api';

type FinanceStore = {
  transactions: ApiTransaction[];
  setTransactions: (transactions: ApiTransaction[]) => void;
  clearTransactions: () => void;
};

export const useFinanceStore = create<FinanceStore>((set) => ({
  transactions: [],
  setTransactions: (transactions) => set({ transactions }),
  clearTransactions: () => set({ transactions: [] }),
}));
