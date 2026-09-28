import { createContext, useCallback, useContext, useEffect, useRef, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from 'react';
import { fetchWorkspaces, type ApiWorkspace } from '@/lib/api';
import { useExpenseDraftStore } from '@/store/expense-draft-store';

type WorkspaceContextValue = {
  workspaces: ApiWorkspace[];
  selectedId: string | null;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setWorkspaces: Dispatch<SetStateAction<ApiWorkspace[]>>;
  refreshWorkspaces: () => Promise<ApiWorkspace[]>;
};
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
// Mounted inside the account-keyed provider: selection and pending requests belong to one account.
export function WorkspaceProvider({ children }: PropsWithChildren) {
  const [workspaces, setWorkspaces] = useState<ApiWorkspace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(() => { useExpenseDraftStore.getState().resetDraft(); }, [selectedId]);
  const refreshWorkspaces = useCallback(async () => {
    const request = ++generation.current;
    const list = await fetchWorkspaces();
    if (request === generation.current) {
      setWorkspaces(list);
      setSelectedId(previous => list.some(item => item.id === previous) ? previous : list[0]?.id ?? null);
    }
    return list;
  }, []);
  useEffect(() => () => { generation.current++; }, []);
  return <WorkspaceContext.Provider value={{ workspaces, selectedId, setSelectedId, setWorkspaces, refreshWorkspaces }}>{children}</WorkspaceContext.Provider>;
}
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('Workspace provider is unavailable.');
  return value;
}
