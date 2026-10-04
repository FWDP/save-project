import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ApiTransaction } from '@/lib/api';
import { expenseHistory } from '@/lib/account-dashboard';

export function ExpenseHistory({ transactions, currency, onOpen }: {
  transactions: ApiTransaction[];
  currency: string;
  onOpen: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(20);
  const history = useMemo(() => expenseHistory(transactions, currency, search), [transactions, currency, search]);
  const money = (amount: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(amount);
  return <View style={styles.card}>
    <Text style={styles.title}>Expenses · All dates</Text>
    <Text style={styles.total}>{money(history.total)}</Text>
    <Text style={styles.meta}>{history.count} expense records · {history.pending} awaiting upload</Text>
    {history.rejected ? <Text style={styles.meta}>{history.rejected} rejected records excluded from the amount total</Text> : null}
    <TextInput accessibilityLabel="Search dashboard expenses" value={search}
      onChangeText={value => { setSearch(value); setLimit(20); }} style={styles.search}
      placeholder="Search description, merchant, category or tags" placeholderTextColor="#9ba9bf" />
    {history.rows.slice(0, limit).map(item => <Pressable key={item.id} accessibilityRole="button"
      onPress={() => onOpen(item.id)} style={styles.row}>
      <View style={styles.details}>
        <Text style={styles.text}>{item.description}</Text>
        <Text style={styles.meta}>{item.date} · {item.category}{item.merchant ? ` · ${item.merchant}` : ''}</Text>
        {item.tags?.length ? <Text style={styles.meta}>{item.tags.join(', ')}</Text> : null}
        <Text style={styles.meta}>{item.syncState === 'pending' ? 'Awaiting upload' : item.status ?? 'Recorded'}{item.recurring ? ' · Recurring' : ''}{item.receiptUri ? ' · Receipt attached' : ''}</Text>
      </View>
      <Text style={styles.amount}>{money(item.amount)}</Text>
    </Pressable>)}
    {!history.rows.length ? <Text style={styles.meta}>{search ? 'No matching expenses.' : 'No expense records in your account.'}</Text> : null}
    {history.rows.length > limit ? <Pressable style={styles.more} onPress={() => setLimit(value => value + 20)}>
      <Text style={styles.text}>Show more expenses ({history.rows.length - limit} remaining)</Text>
    </Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#0d1629', borderRadius: 14, padding: 16, gap: 10, marginBottom: 16 },
  title: { color: '#f4f7fb', fontSize: 18, fontWeight: '700' },
  total: { color: '#ff8195', fontSize: 26, fontWeight: '800' },
  text: { color: '#f4f7fb', fontSize: 14, fontWeight: '600' },
  meta: { color: '#a1afc3', fontSize: 12, marginTop: 4 },
  search: { backgroundColor: '#111c31', color: '#f4f7fb', padding: 12, borderRadius: 10 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#26344b' },
  details: { flex: 1 },
  amount: { color: '#ff8195', fontWeight: '700' },
  more: { paddingVertical: 14, alignItems: 'center' },
});
