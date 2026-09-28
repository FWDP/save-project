import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MonthPicker } from '@/components/month-picker';
import { SaveDashboard } from '@/components/dashboard/save-dashboard';
import { AppSidebar } from '@/components/navigation/app-sidebar';
import { useWorkspace } from '@/components/providers/workspace-provider';
import { useFinanceStore } from '@/store/finance-store';
import { loadWorkspaceDashboard, type WorkspaceDashboardData } from '@/lib/workspace-dashboard';

export default function DashboardScreen() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { selectedMonth } = useFinanceStore();
  const { workspaces, selectedId, refreshWorkspaces } = useWorkspace();
  const workspace = workspaces.find(item => item.id === selectedId);
  const [snapshot, setSnapshot] = useState<WorkspaceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  // Never render a previous workspace or month's snapshot during a switch.
  const data = snapshot?.workspaceId === selectedId && snapshot.month === selectedMonth ? snapshot : null;
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError(null);
    try {
      const list = await refreshWorkspaces();
      if (request !== generation.current) return;
      const selected = list.find(item => item.id === selectedId);
      if (!selected) { setSnapshot(null); return; }
      const result = await loadWorkspaceDashboard(selected, selectedMonth);
      if (request === generation.current) setSnapshot(result);
    } catch (err) {
      if (request === generation.current) {
        setSnapshot(null);
        setError(err instanceof Error ? err.message : 'Could not sync this workspace.');
      }
    } finally { if (request === generation.current) setLoading(false); }
  }, [refreshWorkspaces, selectedId, selectedMonth]);
  useFocusEffect(useCallback(() => {
    void refresh();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 30000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { generation.current++; clearInterval(timer); listener.remove(); };
  }, [refresh]));
  const personal = workspace?.kind === 'personal' && workspace.currency === 'PHP';
  const openRecords = () => router.push('/workspaces');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Open navigation" style={styles.iconButton} onPress={() => setSidebarOpen(true)}>
          <Text style={styles.iconText}>☰</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Change workspace" style={{ flex: 1 }} onPress={openRecords}>
          <Text numberOfLines={1} style={{ color: '#f4f7fb', fontSize: 18, fontWeight: '800' }}>SAVE · {workspace?.name ?? 'Choose workspace'} ⌄</Text>
        </Pressable>
        <Pressable accessibilityLabel="Workspace transactions" style={{ padding: 12 }} onPress={openRecords}>
          <Text style={{ color: '#75b6ff' }}>Records</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#55a6ff" />}>
        <MonthPicker />
        {error ? <View style={{ padding: 16 }}><Text accessibilityRole="alert" style={{ color: '#ff788c' }}>{error}</Text>
          <Pressable onPress={() => void refresh()} style={{ paddingVertical: 12 }}><Text style={{ color: '#75b6ff' }}>Retry sync</Text></Pressable></View> : null}
        {workspace && data ? <SaveDashboard
          monthKey={selectedMonth} workspaceName={workspace.name} currency={workspace.currency}
          showBudgets={personal} budgets={data.budgets} transactions={data.transactions} totals={data.totals}
          loading={loading} syncMessage={error} onTransactionPress={openRecords}
        /> : !error ? <Text style={{ color: '#9ba9bf', padding: 16 }}>{loading || workspace ? 'Loading workspace dashboard…' : 'Choose or create a workspace to see its dashboard.'}</Text> : null}
      </ScrollView>
      {workspace && workspace.role !== 'viewer' ? <View style={styles.fabGroup}>
        <Pressable accessibilityLabel="Add workspace transaction" style={styles.fab}
          onPress={() => router.push(personal ? '/expense-add' : { pathname: '/workspaces', params: { add: '1' } })}>
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      </View> : null}
      <AppSidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#070d1a' },
  topBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#17243b',
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: '#c6d0e0', fontSize: 19 },
  modeSelector: {
    flex: 1,
    maxWidth: 205,
    height: 34,
    flexDirection: 'row',
    borderRadius: 18,
    backgroundColor: '#0d1629',
    padding: 3,
  },
  modeSelected: {
    flex: 1,
    borderRadius: 15,
    backgroundColor: '#172440',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeOption: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modeSelectedText: { color: '#f4f7fb', fontSize: 10, fontWeight: '700' },
  modeText: { color: '#65738c', fontSize: 10, fontWeight: '600' },
  plainButton: {
    width: 30,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plainIcon: { color: '#9aa8bd', fontSize: 18 },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 130 },
  fabGroup: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    gap: 10,
    alignItems: 'center',
  },
  secondaryFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111c31',
    borderWidth: 1,
    borderColor: '#263956',
  },
  secondaryFabText: { color: '#55a6ff', fontSize: 19 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#55a6ff',
    elevation: 8,
    shadowColor: '#55a6ff',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  fabText: {
    color: '#07111f',
    fontSize: 31,
    lineHeight: 33,
    fontWeight: '400',
  },
});
