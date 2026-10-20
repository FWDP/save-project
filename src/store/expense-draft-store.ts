import { localDate } from '@/lib/finance';
import { create } from 'zustand';

export type ExpenseDraft = {
  type: 'expense' | 'income';
  date: string;
  amount: string;
  category: string;
  description: string;
  merchant: string;
  tin: string;
  recurring: boolean;
  receiptUri?: string;
  receiptMimeType?: string;
  receiptStatus?: string;
};

const initialDraft = (): ExpenseDraft => ({
  type: 'expense',
  date: localDate(),
  amount: '',
  category: '',
  description: '',
  merchant: '',
  tin: '',
  recurring: false,
});

type ExpenseDraftStore = {
  draft: ExpenseDraft;
  patchDraft: (patch: Partial<ExpenseDraft>) => void;
  resetDraft: () => void;
};

export const useExpenseDraftStore = create<ExpenseDraftStore>((set) => ({
  draft: initialDraft(),
  patchDraft: (patch) =>
    set((state) => ({ draft: { ...state.draft, ...patch } })),
  resetDraft: () => set({ draft: initialDraft() }),
}));
