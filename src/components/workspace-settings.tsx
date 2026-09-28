import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FinancePage, financePageStyles as styles } from './layout/finance-page';
import { useWorkspaceFinance } from './providers/workspace-finance-provider';
import { getAuthUser, clearAuthUser, type AuthUser } from '@/lib/auth';
import { exportFile } from '@/lib/export-file';
import { workspaceTransactionsCsv } from '@/lib/workspace-records';
export function WorkspaceSettings() {
  const { workspace, transactions, isLoading, syncError } = useWorkspaceFinance();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => { let active = true; void getAuthUser().then(value => { if (active) setUser(value); }).catch(() => {}); return () => { active = false; }; }, []);
  const exportRecords = useCallback(async (json: boolean) => {
    if (!workspace || busy || isLoading || syncError) return;
    setBusy(true); setError('');
    try {
      await exportFile(`save-${workspace.id}-${Date.now()}.${json ? 'json' : 'csv'}`, json
        ? JSON.stringify({ workspace, transactions, exportedAt: new Date().toISOString() }, null, 2)
        : workspaceTransactionsCsv(transactions, workspace), json ? 'application/json' : 'text/csv');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not export records.'); }
    finally { setBusy(false); }
  }, [workspace, busy, isLoading, syncError, transactions]);
  return <FinancePage title="Settings" subtitle="Account and workspace records">
    <View style={styles.card}><Text style={styles.cardTitle}>Account</Text><Text style={styles.rowTitle}>{user?.name}</Text><Text style={styles.rowMeta}>{user?.email}</Text></View>
    <View style={styles.card}><Text style={styles.cardTitle}>{workspace?.name ?? 'Choose a workspace'}</Text><Text style={styles.rowMeta}>{workspace?.currency} · {workspace?.role}</Text>
      <Pressable style={styles.primaryButton} onPress={() => router.push('/workspaces')}><Text style={styles.primaryButtonText}>Manage workspace</Text></Pressable></View>
    {workspace ? <View style={styles.card}><Text style={styles.cardTitle}>Export workspace records</Text>
      {[false, true].map(json => <Pressable key={String(json)} disabled={busy || isLoading || !!syncError} style={styles.primaryButton} onPress={() => void exportRecords(json)}><Text style={styles.primaryButtonText}>{json ? 'Export JSON' : 'Export CSV'}</Text></Pressable>)}
      <Text style={styles.rowMeta}>Exports contain only this workspace’s records and currency. Personal backup restore and import are available in your personal workspace.</Text>
    </View> : null}
    {error ? <Text style={{ color: '#ff8195' }}>{error}</Text> : null}
    <Pressable style={styles.primaryButton} onPress={() => Alert.alert('Sign out?', 'Your workspace records remain available when you sign back in.', [{ text: 'Cancel' }, { text: 'Sign out', onPress: () => { void clearAuthUser().catch(() => setError('Could not sign out. Please retry.')); } }])}><Text style={styles.primaryButtonText}>Sign out</Text></Pressable>
  </FinancePage>;
}
