import { useCallback, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { FinancePage } from '@/components/layout/finance-page';
import { useWorkspaceFinance } from '@/components/providers/workspace-finance-provider';
import { useWorkspace } from '@/components/providers/workspace-provider';
import {
  fetchWorkspaces, createWorkspace, fetchWorkspaceTransactions,
  saveWorkspaceTransaction, deleteWorkspaceTransaction,
  type ApiWorkspaceTransaction, type WorkspaceTransactionPage,
} from '@/lib/api';
import { currencyDigits, workspaceAmount, workspaceMoney } from '@/lib/workspace-money';
import { localDate, validDate } from '@/lib/finance';

const emptyDraft = () => ({ type: 'expense' as 'expense' | 'income', amount: '', description: '', category: '', merchant: '', date: localDate(), clientMutationId: randomUUID() });
const message = (error: unknown) => error instanceof Error ? error.message : 'Unable to load workspace. Please retry.';

export default function WorkspacesScreen() {
  const router = useRouter();
  const { add } = useLocalSearchParams<{ add?: string }>();
  const { refresh: refreshFinance } = useWorkspaceFinance();
  const { workspaces, setWorkspaces, selectedId, setSelectedId } = useWorkspace();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<WorkspaceTransactionPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('PHP');
  const [kind, setKind] = useState<'personal' | 'business'>('business');
  const [creating, setCreating] = useState(false);
  const createKey = useRef(randomUUID());
  const [editing, setEditing] = useState<ApiWorkspaceTransaction | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const generation = useRef(0);
  const busy = useRef(false);
  const workspace = workspaces.find((item) => item.id === selectedId);
  const writable = workspace && workspace.role !== 'viewer';

  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    try {
      const list = await fetchWorkspaces();
      if (request !== generation.current) return;
      setWorkspaces(list);
      if (!selectedId) {
        setData(null); setError(null);
        if (list.length) { setPage(1); setSelectedId(list[0].id); }
        return;
      }
      if (!list.some((item) => item.id === selectedId)) {
        setSelectedId(null); setData(null); setShowForm(false);
        throw new Error('This workspace is no longer available to your account.');
      }
      const records = await fetchWorkspaceTransactions(selectedId, page);
      if (request !== generation.current) return;
      setData(records); setError(null); setUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      if (request === generation.current) { setData(null); setError(message(err)); }
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [selectedId, page, setWorkspaces, setSelectedId]);

  useFocusEffect(useCallback(() => {
    void load();
    const timer = setInterval(() => { if (AppState.currentState === 'active' && !busy.current) void load(); }, 30000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active' && !busy.current) void load(); });
    return () => { generation.current++; clearInterval(timer); subscription.remove(); };
  }, [load]));

  useFocusEffect(useCallback(() => {
    if (add === '1' && writable) {
      setEditing(null); setDraft(emptyDraft()); setShowForm(true);
      router.setParams({ add: undefined });
    }
  }, [add, writable, router]));

  const select = (id: string) => {
    if (id === selectedId) { void load(); return; }
    generation.current++;
    setSelectedId(id); setPage(1); setData(null); setUpdated(null);
    setShowForm(false); setEditing(null); setDraft(emptyDraft()); setError(null);
  };
  const mutate = async (operation: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError(null);
    try { await operation(); }
    catch (err) { setError(message(err)); }
    finally { busy.current = false; setSaving(false); }
  };
  const save = () => mutate(async () => {
    if (!workspace || !writable) throw new Error('Select a writable workspace.');
    if (!validDate(draft.date) || !draft.description.trim() || !draft.category.trim())
      throw new Error('Enter a valid date, description, and category.');
    await saveWorkspaceTransaction(workspace.id, {
      clientMutationId: draft.clientMutationId, type: draft.type,
      amountMinor: workspaceAmount(draft.amount, workspace.currency),
      description: draft.description.trim(), category: draft.category.trim(),
      merchant: draft.merchant.trim(), date: draft.date,
    }, editing ?? undefined);
    setShowForm(false); setEditing(null); setDraft(emptyDraft());
    await load();
    await refreshFinance();
  });
  const remove = (row: ApiWorkspaceTransaction) => {
    if (!workspace) return;
    const id = workspace.id;
    Alert.alert('Delete transaction?', row.description, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void mutate(async () => {
        await deleteWorkspaceTransaction(id, row);
        await load();
        await refreshFinance();
      }) },
    ]);
  };
  const field = (label: string, key: 'amount' | 'description' | 'category' | 'merchant' | 'date', maxLength: number) => (
    <View><Text style={styles.meta}>{label}</Text><TextInput accessibilityLabel={label} editable={!saving} style={styles.input}
      value={draft[key]} maxLength={maxLength} keyboardType={key === 'amount' ? 'decimal-pad' : 'default'}
      onChangeText={(value) => setDraft((previous) => ({ ...previous, [key]: value }))} /></View>
  );

  return <FinancePage title="Workspaces" subtitle="Your personal and business workspaces from SAVE Web" showSync={false} onRefresh={load} refreshing={loading}>
    <Text style={styles.meta}>Choose a workspace to view and manage its records.</Text>
    <View style={styles.row}>
      <Button label={loading ? 'Refreshing…' : 'Refresh workspaces'} disabled={saving || loading} onPress={() => void load()} />
      <Button label="New workspace" disabled={saving} onPress={() => setCreating(!creating)} />
    </View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {!loading && !error && !workspaces.length ? <Text style={styles.meta}>No workspaces yet. Create one here or in SAVE Web.</Text> : null}
    {workspaces.map((item) => <Pressable accessibilityRole="button" accessibilityState={{ selected: item.id === selectedId }} disabled={saving} key={item.id}
      style={[styles.card, item.id === selectedId && styles.selected]} onPress={() => select(item.id)}>
      <Text style={styles.title}>{item.name}</Text><Text style={styles.meta}>{item.kind} · {item.currency} · {item.role}</Text>
    </Pressable>)}
    {creating ? <View style={styles.card}>
      <Text style={styles.title}>Create workspace</Text>
      <TextInput accessibilityLabel="Workspace name" placeholder="Workspace name" placeholderTextColor="#8793a8" value={name} onChangeText={setName} editable={!saving} maxLength={80} style={styles.input} />
      <View style={styles.row}>{(['personal', 'business'] as const).map((value) => <Button key={value} label={`${kind === value ? '✓ ' : ''}${value}`} disabled={saving} onPress={() => { setKind(value); if (value === 'personal') setCurrency('PHP'); }} />)}</View>
      <Text style={styles.meta}>Currency code (e.g. PHP, USD, JPY)</Text>
      <TextInput accessibilityLabel="Currency code" value={kind === 'personal' ? 'PHP' : currency} onChangeText={(value) => setCurrency(value.toUpperCase())} editable={!saving && kind === 'business'} maxLength={3} autoCapitalize="characters" style={styles.input} />
      <Button label={saving ? 'Creating…' : 'Create workspace'} disabled={saving} onPress={() => void mutate(async () => {
        if (!name.trim()) throw new Error('Enter a workspace name.');
        const created = await createWorkspace({ name: name.trim(), kind, currency: kind === 'personal' ? 'PHP' : currency, clientMutationId: createKey.current });
        createKey.current = randomUUID(); setCreating(false); setName('');
        setWorkspaces((previous) => [...previous.filter((item) => item.id !== created.id), created]); select(created.id);
      })} />
    </View> : null}
    {workspace ? <View style={styles.card}>
      <Text style={styles.title}>{workspace.name}</Text>
      <Button label="View dashboard" disabled={saving} onPress={() => router.push('/')} />
      <Text style={styles.meta}>{workspace.currency} · {workspace.role} · {workspace.memberCount} member(s)</Text>
      <Text style={styles.meta}>{loading ? 'Syncing…' : updated ? `Updated ${updated}` : 'Waiting for sync'}</Text>
      {workspace.role === 'viewer' ? <Text style={styles.meta}>You have read-only access.</Text> : null}
      {workspace.role === 'member' ? <Text style={styles.meta}>Your role shows only records you created.</Text> : null}
      {data ? <>
        <Text style={styles.title}>Balance {workspaceMoney(data.summary.balanceMinor, workspace.currency)}</Text>
        <Text style={styles.meta}>Income {workspaceMoney(data.summary.incomeMinor, workspace.currency)} · Expenses {workspaceMoney(data.summary.expenseMinor, workspace.currency)}</Text>
      </> : null}
      {writable ? <Button label="Add transaction" disabled={saving} onPress={() => { setEditing(null); setDraft(emptyDraft()); setShowForm(true); }} /> : null}
      {showForm && writable ? <View style={styles.form}>
        <Text style={styles.title}>{editing ? 'Edit transaction' : 'New transaction'}</Text>
        <View style={styles.row}>{(['expense', 'income'] as const).map((type) => <Button key={type} disabled={saving} label={`${draft.type === type ? '✓ ' : ''}${type}`} onPress={() => setDraft((previous) => ({ ...previous, type }))} />)}</View>
        {field(`Amount (${workspace.currency})`, 'amount', 16)}
        {field('Description', 'description', 160)}{field('Category', 'category', 80)}
        {field('Merchant', 'merchant', 120)}{field('Date (YYYY-MM-DD)', 'date', 10)}
        <View style={styles.row}><Button label={saving ? 'Saving…' : 'Save transaction'} disabled={saving} onPress={() => void save()} /><Button label="Cancel" disabled={saving} onPress={() => setShowForm(false)} /></View>
      </View> : null}
      {data?.items.map((item) => <View key={item.id} style={styles.record}>
        <Text style={styles.title}>{item.description}</Text>
        <Text style={styles.meta}>{item.date} · {item.category} · {item.type}</Text>
        <Text style={styles.title}>{workspaceMoney(item.amountMinor, workspace.currency)}</Text>
        {writable ? <View style={styles.row}>
          <Button label="Edit" disabled={saving} onPress={() => {
            setEditing(item); setDraft({ ...item, amount: (item.amountMinor / 10 ** currencyDigits(workspace.currency)).toFixed(currencyDigits(workspace.currency)) }); setShowForm(true);
          }} />
          <Button label="Delete" disabled={saving} onPress={() => remove(item)} />
        </View> : null}
      </View>)}
      {data && !data.items.length ? <Text style={styles.meta}>No transactions on this page.</Text> : null}
      {data ? <View style={styles.row}>
        <Button label="Previous" disabled={saving || loading || page <= 1} onPress={() => { setData(null); setPage(page - 1); }} />
        <Text style={styles.meta}>Page {page} · {data.total} records</Text>
        <Button label="Next" disabled={saving || loading || page * data.pageSize >= data.total} onPress={() => { setData(null); setPage(page + 1); }} />
      </View> : null}
    </View> : null}
  </FinancePage>;
}
function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && { opacity: 0.45 }]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#0d1629', borderWidth: 1, borderColor: '#263650', borderRadius: 12, padding: 14, gap: 12 },
  selected: { borderColor: '#75b6ff', borderWidth: 2 },
  title: { color: '#edf2fa', fontSize: 16, fontWeight: '700' },
  meta: { color: '#a1afc3', fontSize: 13, lineHeight: 20 },
  error: { color: '#ff788c', fontSize: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  button: { backgroundColor: '#213653', padding: 12, borderRadius: 8 },
  buttonText: { color: '#91c6ff', fontWeight: '700' },
  input: { backgroundColor: '#081120', borderColor: '#263650', borderWidth: 1, borderRadius: 8, padding: 12, color: '#edf2fa' },
  form: { gap: 12, paddingVertical: 12 },
  record: { borderTopWidth: 1, borderColor: '#263650', paddingVertical: 12, gap: 7 },
});
