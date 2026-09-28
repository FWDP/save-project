import type { ApiTransaction } from '@/lib/api';
import { fetchAllWorkspaceTransactions, refreshPersonalWorkspace, workspaceTransaction } from '@/lib/workspace-records';
import { selectedWorkspaceTransactions, supportsPersonalFinance } from '@/lib/workspace-scope';
import { useFinanceStore } from '@/store/finance-store';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useRefreshFinance } from './finance-data-provider';
import { useWorkspace } from './workspace-provider';

const ScopedContext = createContext<{ id: string | null; transactions: ApiTransaction[]; loading: boolean; error: string | null; updated: string | null; refresh: () => Promise<void> } | null>(null);
export function WorkspaceFinanceProvider({ children }: PropsWithChildren) {
  const { selectedId, workspaces, refreshWorkspaces } = useWorkspace();
  const workspace = workspaces.find(item => item.id === selectedId);
  const personal = supportsPersonalFinance(workspace);
  const refreshPersonal = useRefreshFinance();
  const [snapshot, setSnapshot] = useState<{ id: string; transactions: ApiTransaction[]; updated: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const currency = workspace?.currency;
  const invalidate = useCallback(() => { generation.current++; }, []);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError(null);
    try {
      if (!selectedId) {
        const available = await refreshWorkspaces();
        if (request === generation.current && !available.length)
          setError('No workspace is available. Create one from Workspaces.');
        return;
      }
      if (!currency) return;
      if (personal) await refreshPersonalWorkspace(selectedId, refreshPersonal);
      else {
        const rows = await fetchAllWorkspaceTransactions(selectedId);
        if (request === generation.current) setSnapshot({ id: selectedId, transactions: rows.map(row => workspaceTransaction(row, currency)), updated: new Date().toISOString() });
      }
    } catch (err) {
      if (request === generation.current) { setSnapshot(null); setError(err instanceof Error ? err.message : 'Could not sync workspace.'); }
    } finally { if (request === generation.current) setLoading(false); }
  }, [selectedId, currency, personal, refreshPersonal, refreshWorkspaces]);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 30000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { invalidate(); clearTimeout(initial); clearInterval(timer); listener.remove(); };
  }, [refresh, invalidate]);
  return <ScopedContext.Provider value={{ id: selectedId, transactions: snapshot?.id === selectedId ? snapshot.transactions : [], loading: loading || (!personal && !!selectedId && !error && snapshot?.id !== selectedId), error, updated: snapshot?.id === selectedId ? snapshot.updated : null, refresh }}>{children}</ScopedContext.Provider>;
}
export function useWorkspaceFinance() {
  const scoped = useContext(ScopedContext);
  if (!scoped) throw new Error('Workspace finance provider unavailable.');
  const personalData = useFinanceStore();
  const { selectedId, workspaces } = useWorkspace();
  const workspace = workspaces.find(item => item.id === selectedId);
  const personal = supportsPersonalFinance(workspace);
  return {
    workspace, personal, currency: workspace?.currency ?? 'PHP', refresh: scoped.refresh,
    transactions: selectedWorkspaceTransactions(workspace, personalData.transactions, scoped),
    budgets: personal ? personalData.budgets : [], categories: personal ? personalData.categories : [],
    isLoading: scoped.loading || (personal && personalData.isLoading),
    syncError: personal ? personalData.syncError : scoped.error,
    lastUpdatedAt: personal ? personalData.lastUpdatedAt : scoped.updated,
    selectedMonth: personalData.selectedMonth,
  };
}
