import { create } from 'zustand';

export type ExpenseDraft = {
  type: 'expense' | 'income';
  date: string;
  amount: string;
  category: string;
  description: string;
  merchant: string;
  tags: string;
  recurring: boolean;
  receiptUri?: string;
  customFields: { label: string; value: string }[];
};

const initialDraft = (): ExpenseDraft => ({
  type: 'expense',
  date: new Date().toISOString().slice(0, 10),
  amount: '',
  category: '',
  description: '',
  merchant: '',
  tags: '',
  recurring: false,
  customFields: [],
});

type ExpenseDraftStore = {
  draft: ExpenseDraft;
  patchDraft: (patch: Partial<ExpenseDraft>) => void;
  resetDraft: () => void;
};

export const useExpenseDraftStore = create<ExpenseDraftStore>((set) => ({
  draft: initialDraft(),
  patchDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
  resetDraft: () => set({ draft: initialDraft() }),
}));
