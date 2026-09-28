import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  SectionList,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FinancePage } from '@/components/layout/finance-page';
import { MonthPicker } from '@/components/month-picker';
import { useWorkspaceFinance } from '@/components/providers/workspace-finance-provider';
import { WorkspaceScope } from '@/components/workspace-scope';
import { monthTransactions } from '@/lib/finance';
import { fetchWorkspaceTransactions, type ApiTransaction } from '@/lib/api';
import { workspaceTransaction } from '@/lib/workspace-records';

function TransactionsScreen() {
  const router = useRouter();
  const { transactions, selectedMonth, isLoading, refresh, currency, workspace } = useWorkspaceFinance();
  const [monthRows, setMonthRows] = useState<ApiTransaction[] | null>(null);
  const [monthLoading, setMonthLoading] = useState(false);
  useEffect(() => {
    let active = true;
    const loadMonth = async () => {
      if (!workspace) { setMonthRows(null); return; }
      setMonthLoading(true);
      try {
        const first = await fetchWorkspaceTransactions(workspace.id, 1, selectedMonth);
        const rows = [...first.items];
        for (let page = 2; page <= Math.ceil(first.total / first.pageSize); page++) {
          const next = await fetchWorkspaceTransactions(workspace.id, page, selectedMonth);
          rows.push(...next.items);
        }
        if (active) setMonthRows(rows.map(row => workspaceTransaction(row, workspace.currency)));
      } catch {
        if (active) setMonthRows(null);
      } finally {
        if (active) setMonthLoading(false);
      }
    };
    void loadMonth();
    return () => { active = false; };
  }, [workspace, selectedMonth]);
  const visibleTransactions = monthRows ?? monthTransactions(transactions, selectedMonth);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'all' | 'expense' | 'income'>('all');
  const [ascending, setAscending] = useState(false);
  const filtered = useMemo(
    () =>
      visibleTransactions
        .filter((item) => type === 'all' || item.type === type)
        .filter((item) =>
          [
            item.description,
            item.merchant,
            item.category,
            ...(item.tags ?? []),
          ].some((value) =>
            value?.toLowerCase().includes(search.trim().toLowerCase()),
          ),
        )
        .sort((a, b) =>
          ascending
            ? a.date.localeCompare(b.date)
            : b.date.localeCompare(a.date),
        ),
    [visibleTransactions, type, search, ascending],
  );
  const sections = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    for (const item of filtered)
      groups.set(item.date, [...(groups.get(item.date) ?? []), item]);
    return [...groups].map(([title, data]) => ({ title, data }));
  }, [filtered]);
  return (
    <FinancePage
      title="Transactions"
      subtitle={`${filtered.length} records in this period`}
      scroll={false}
    >
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || monthLoading}
            onRefresh={refresh}
            tintColor="#55a6ff"
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <MonthPicker />
            <Pressable
              disabled={workspace?.role === 'viewer'}
              style={styles.add}
              onPress={() => router.push('/expense-add')}
            >
              <Text style={styles.addText}>Add transaction</Text>
            </Pressable>
            <TextInput
              accessibilityLabel="Search transactions"
              value={search}
              onChangeText={setSearch}
              style={styles.search}
              placeholder="Search description, merchant, category or tags"
              placeholderTextColor="#9ba9bf"
            />
            <View style={styles.filters}>
              {(['all', 'expense', 'income'] as const).map((value) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: type === value }}
                  key={value}
                  style={[styles.chip, type === value && styles.selected]}
                  onPress={() => setType(value)}
                >
                  <Text style={styles.text}>
                    {value === 'all'
                      ? 'All'
                      : value === 'expense'
                        ? 'Expenses'
                        : 'Income'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={styles.sort}
              onPress={() => setAscending(!ascending)}
            >
              <Text style={styles.meta}>
                {ascending ? 'Oldest first' : 'Newest first'} · Tap to change
              </Text>
            </Pressable>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.date}>
            {new Date(`${section.title}T12:00:00`).toLocaleDateString('en-PH', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        )}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            style={styles.row}
            onPress={() =>
              router.push({
                pathname: '/transaction-detail',
                params: { id: item.id },
              })
            }
          >
            <View style={styles.description}>
              <Text style={styles.text}>{item.description}</Text>
              <Text style={styles.meta}>
                {item.merchant ? `${item.merchant} · ` : ''}
                {item.category}
                {item.syncState === 'pending' ? ' · Awaiting upload' : ''}
              </Text>
            </View>
            <Text
              style={[styles.amount, item.type === 'income' && styles.income]}
            >
              {item.type === 'income' ? '+' : '−'}{new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(item.amount)}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {isLoading || monthLoading
              ? 'Loading transactions…'
              : search
                ? 'No matches. Try a different search.'
                : 'No transactions this month. Add your first record above.'}
          </Text>
        }
      />
    </FinancePage>
  );
}
const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 100 },
  header: { gap: 12 },
  add: {
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#55a6ff',
  },
  addText: { color: '#07111f', fontSize: 16, fontWeight: '800' },
  search: {
    padding: 14,
    fontSize: 15,
    color: '#f4f7fb',
    backgroundColor: '#111c31',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#31405a',
  },
  filters: { flexDirection: 'row', gap: 8 },
  chip: { padding: 13, backgroundColor: '#111c31', borderRadius: 10 },
  selected: { backgroundColor: '#264b78' },
  sort: { minHeight: 44, justifyContent: 'center' },
  text: { color: '#f4f7fb', fontSize: 15, fontWeight: '600' },
  meta: { color: '#a1afc3', fontSize: 13, marginTop: 5 },
  date: { color: '#a1afc3', fontSize: 14, marginTop: 22, marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: '#26344b',
    gap: 12,
  },
  description: { flex: 1 },
  amount: { color: '#ff8195', fontSize: 15, fontWeight: '700' },
  income: { color: '#36dc9b' },
  empty: {
    color: '#a1afc3',
    paddingVertical: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default function ScopedTransactions() { return <WorkspaceScope><TransactionsScreen /></WorkspaceScope>; }
