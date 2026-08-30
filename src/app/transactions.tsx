import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { FinancePage } from '@/components/layout/finance-page';
import { useFinanceStore } from '@/store/finance-store';

export default function TransactionsScreen() {
  const router = useRouter();
  const { categories, transactions } = useFinanceStore();
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [category, setCategory] = useState('All categories');
  const [showCategories, setShowCategories] = useState(false);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...transactions]
      .filter((item) => !query || [item.description, item.merchant, item.category, ...(item.tags ?? [])].some((value) => value?.toLowerCase().includes(query)))
      .filter((item) => !from || item.date >= from).filter((item) => !to || item.date <= to)
      .filter((item) => category === 'All categories' || item.category === category).sort((a, b) => b.date.localeCompare(a.date));
  }, [category, from, search, to, transactions]);

  return <FinancePage title="Expenses" subtitle={`${filtered.length} of ${transactions.length} records`}>
    <View style={styles.titleRow}><Text style={styles.sectionTitle}>Expenses</Text><Pressable style={styles.addTop} onPress={() => router.push('/expense-add')}><Text style={styles.addTopText}>＋ Add Expense</Text></Pressable></View>
    <View style={styles.filters}>
      <TextInput value={search} onChangeText={setSearch} style={styles.search} placeholder="Search by description, merchant or tags…" placeholderTextColor="#65738c" />
      <View style={styles.filterRow}><View style={styles.filterField}><Text style={styles.label}>From</Text><TextInput value={from} onChangeText={setFrom} style={styles.smallInput} placeholder="YYYY-MM-DD" placeholderTextColor="#526078" /></View><View style={styles.filterField}><Text style={styles.label}>To</Text><TextInput value={to} onChangeText={setTo} style={styles.smallInput} placeholder="YYYY-MM-DD" placeholderTextColor="#526078" /></View></View>
      <Pressable style={styles.select} onPress={() => setShowCategories((value) => !value)}><Text style={styles.selectText}>{category}</Text><Text style={styles.selectText}>⌄</Text></Pressable>
      {showCategories ? <View style={styles.categoryOptions}>{['All categories', ...categories.map((item) => item.name)].map((name) => <Pressable key={name} onPress={() => { setCategory(name); setShowCategories(false); }} style={[styles.chip, category === name && styles.chipActive]}><Text style={styles.chipText}>{name}</Text></Pressable>)}</View> : null}
    </View>
    <View style={styles.table}>
      <View style={styles.tableHeader}><Text style={styles.checkbox}>□</Text><Text style={styles.dateHead}>Date ↕</Text><Text style={styles.descriptionHead}>Description</Text><Text style={styles.amountHead}>Amount</Text></View>
      {filtered.map((item) => <View key={item.id} style={styles.transactionRow}><Text style={styles.checkbox}>□</Text><Text style={styles.date}>{item.date.slice(5)}</Text><View style={styles.description}><Text numberOfLines={1} style={styles.descriptionText}>{item.description}</Text><Text numberOfLines={1} style={styles.meta}>{item.merchant || item.category}</Text></View><Text style={[styles.amount, item.type === 'income' && styles.income]}>{item.type === 'income' ? '+' : '-'}₱{item.amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</Text></View>)}
      {!filtered.length ? <Text style={styles.empty}>No matching transactions.</Text> : null}
    </View>
    <Pressable accessibilityLabel="Add expense" style={styles.fab} onPress={() => router.push('/expense-add')}><Text style={styles.fabText}>＋</Text></Pressable>
  </FinancePage>;
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { color: '#f4f7fb', fontSize: 14, fontWeight: '800' }, addTop: { backgroundColor: '#5ca9ff', borderRadius: 5, paddingHorizontal: 12, paddingVertical: 8 }, addTopText: { color: '#07111f', fontSize: 10, fontWeight: '800' },
  filters: { backgroundColor: '#0d1629', borderWidth: 1, borderColor: '#17243b', borderRadius: 10, padding: 10, gap: 8 }, search: { backgroundColor: '#081120', borderWidth: 1, borderColor: '#1b2941', borderRadius: 7, paddingHorizontal: 11, paddingVertical: 10, color: '#f4f7fb', fontSize: 11 },
  filterRow: { flexDirection: 'row', gap: 8 }, filterField: { flex: 1 }, label: { color: '#7d8ba6', fontSize: 9, marginBottom: 4 }, smallInput: { backgroundColor: '#081120', borderWidth: 1, borderColor: '#1b2941', borderRadius: 7, padding: 9, color: '#f4f7fb', fontSize: 10 }, select: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#081120', borderWidth: 1, borderColor: '#1b2941', borderRadius: 7, padding: 10 }, selectText: { color: '#b5c0d3', fontSize: 10 },
  categoryOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, chip: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#263754' }, chipActive: { backgroundColor: '#315f93' }, chipText: { color: '#dce5f3', fontSize: 9 }, table: { backgroundColor: '#0a1324', borderWidth: 1, borderColor: '#17243b', borderRadius: 8, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#0f1a30', borderBottomWidth: 1, borderBottomColor: '#17243b' }, checkbox: { width: 25, color: '#e4eaf4', fontSize: 13 }, dateHead: { width: 62, color: '#8d99ad', fontSize: 9 }, descriptionHead: { flex: 1, color: '#8d99ad', fontSize: 9 }, amountHead: { width: 74, textAlign: 'right', color: '#8d99ad', fontSize: 9 },
  transactionRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#142039' }, date: { width: 62, color: '#aab5c8', fontSize: 9 }, description: { flex: 1, paddingRight: 5 }, descriptionText: { color: '#edf2fa', fontSize: 10 }, meta: { color: '#65738c', fontSize: 8, marginTop: 3 }, amount: { width: 74, color: '#ff7184', textAlign: 'right', fontSize: 9, fontWeight: '700' }, income: { color: '#26d48d' }, empty: { color: '#7d8ba6', textAlign: 'center', padding: 24, fontSize: 11 },
  fab: { position: 'absolute', right: 12, bottom: 18, width: 54, height: 54, borderRadius: 27, backgroundColor: '#5ca9ff', alignItems: 'center', justifyContent: 'center', shadowColor: '#5ca9ff', shadowOpacity: 0.45, shadowRadius: 10, elevation: 8 }, fabText: { color: '#06101e', fontSize: 28, fontWeight: '300' },
});
