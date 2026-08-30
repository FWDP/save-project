import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FinancePage } from '@/components/layout/finance-page';
import { createCategory, deleteCategory, type ApiCategory, updateCategory } from '@/lib/api';
import { saveCategories } from '@/lib/sqlite';
import { useFinanceStore } from '@/store/finance-store';

const COLORS = ['#5ca9ff', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#64748b'];

export default function CategoriesScreen() {
  const { categories, setCategories } = useFinanceStore();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ApiCategory | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [color, setColor] = useState(COLORS[0]);
  const [message, setMessage] = useState<string | null>(null);
  const filtered = useMemo(() => categories.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)), [categories, search]);

  const launch = (category?: ApiCategory) => { setEditing(category ?? null); setName(category?.name ?? ''); setType(category?.type ?? 'expense'); setColor(category?.color ?? COLORS[0]); setMessage(null); setOpen(true); };
  const save = async () => {
    if (!name.trim()) { setMessage('Enter a category name.'); return; }
    try {
      const saved = editing ? await updateCategory(editing.id, { name: name.trim(), type, color }) : await createCategory({ name: name.trim(), type, color });
      const next = editing ? categories.map((item) => item.id === saved.id ? saved : item) : [...categories, saved];
      setCategories(next); saveCategories(next); setOpen(false);
    } catch { setMessage('The categories API is unavailable.'); }
  };
  const remove = (category: ApiCategory) => Alert.alert('Delete category?', `Transactions using “${category.name}” will keep their existing label.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void (async () => { try { await deleteCategory(category.id); const next = categories.filter((item) => item.id !== category.id); setCategories(next); saveCategories(next); } catch { Alert.alert('Could not delete category', 'The categories API is unavailable.'); } })() }]);

  return <FinancePage title="Categories" subtitle="Manage your expense and income categories">
    <View style={styles.titleRow}><View><Text style={styles.title}>Categories</Text><Text style={styles.subtitle}>{categories.length} live categories</Text></View><Pressable style={styles.addTop} onPress={() => launch()}><Text style={styles.addTopText}>＋ Add Category</Text></Pressable></View>
    <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Search categories…" placeholderTextColor="#65738c" />
    <View style={styles.list}>{filtered.map((item) => <View key={item.id} style={styles.row}><View style={[styles.icon, { backgroundColor: `${item.color}22` }]}><View style={[styles.iconDot, { backgroundColor: item.color }]} /></View><View style={styles.rowText}><Text style={styles.rowTitle}>{item.name}</Text><Text style={styles.rowMeta}>{item.type === 'expense' ? 'Expense category' : 'Income category'}</Text></View><Pressable accessibilityLabel={`Edit ${item.name}`} style={styles.action} onPress={() => launch(item)}><Text style={styles.edit}>✎</Text></Pressable><Pressable accessibilityLabel={`Delete ${item.name}`} style={styles.action} onPress={() => remove(item)}><Text style={styles.delete}>×</Text></Pressable></View>)}{!filtered.length ? <Text style={styles.empty}>No matching categories.</Text> : null}</View>
    <Pressable accessibilityLabel="Add category" style={styles.fab} onPress={() => launch()}><Text style={styles.fabText}>＋</Text></Pressable>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}><View style={styles.backdrop}><View style={styles.sheet}><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{editing ? 'Edit Category' : 'Add Category'}</Text><Pressable onPress={() => setOpen(false)}><Text style={styles.close}>Close</Text></Pressable></View><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Category name" placeholderTextColor="#65738c" /><View style={styles.typeRow}>{(['expense', 'income'] as const).map((value) => <Pressable key={value} onPress={() => setType(value)} style={[styles.typeButton, type === value && styles.typeActive]}><Text style={styles.typeText}>{value === 'expense' ? 'Expense' : 'Income'}</Text></Pressable>)}</View><Text style={styles.colorLabel}>Color</Text><View style={styles.colors}>{COLORS.map((value) => <Pressable key={value} accessibilityLabel={`Use color ${value}`} onPress={() => setColor(value)} style={[styles.color, { backgroundColor: value }, color === value && styles.colorActive]} />)}</View>{message ? <Text style={styles.error}>{message}</Text> : null}<Pressable style={styles.saveButton} onPress={save}><Text style={styles.saveText}>{editing ? 'Save Changes' : 'Add Category'}</Text></Pressable></View></View></Modal>
  </FinancePage>;
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { color: '#f4f7fb', fontWeight: '800', fontSize: 15 }, subtitle: { color: '#7d8ba6', fontSize: 9, marginTop: 3 }, addTop: { backgroundColor: '#5ca9ff', borderRadius: 5, paddingHorizontal: 12, paddingVertical: 8 }, addTopText: { color: '#07111f', fontSize: 10, fontWeight: '800' }, search: { backgroundColor: '#081120', borderWidth: 1, borderColor: '#1b2941', borderRadius: 8, padding: 11, color: '#f4f7fb' },
  list: { backgroundColor: '#0b1426', borderWidth: 1, borderColor: '#17243b', borderRadius: 9, overflow: 'hidden' }, row: { minHeight: 55, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#17243b' }, icon: { width: 31, height: 31, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, iconDot: { width: 10, height: 10, borderRadius: 5 }, rowText: { flex: 1, paddingHorizontal: 10 }, rowTitle: { color: '#eef3fb', fontSize: 11, fontWeight: '700' }, rowMeta: { color: '#687790', fontSize: 8, marginTop: 3 }, action: { width: 30, height: 35, alignItems: 'center', justifyContent: 'center' }, edit: { color: '#8b9ab1', fontSize: 15 }, delete: { color: '#e85b70', fontSize: 18 }, empty: { color: '#7d8ba6', textAlign: 'center', padding: 24 }, fab: { position: 'absolute', right: 12, bottom: 18, width: 54, height: 54, borderRadius: 27, backgroundColor: '#5ca9ff', alignItems: 'center', justifyContent: 'center', elevation: 8 }, fabText: { color: '#06101e', fontSize: 28 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,4,12,0.74)', justifyContent: 'flex-end' }, sheet: { backgroundColor: '#0d172d', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 34, gap: 13 }, sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sheetTitle: { color: '#f4f7fb', fontSize: 18, fontWeight: '800' }, close: { color: '#65acfa', fontWeight: '700' }, input: { backgroundColor: '#081120', borderWidth: 1, borderColor: '#1b2941', borderRadius: 9, padding: 13, color: '#f4f7fb' }, typeRow: { flexDirection: 'row', gap: 8 }, typeButton: { flex: 1, backgroundColor: '#111d33', padding: 12, borderRadius: 9, alignItems: 'center' }, typeActive: { backgroundColor: '#315f93' }, typeText: { color: '#f4f7fb', fontWeight: '700' }, colorLabel: { color: '#9eabc0', fontSize: 11 }, colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, color: { width: 29, height: 29, borderRadius: 15 }, colorActive: { borderWidth: 3, borderColor: '#fff' }, error: { color: '#ff788c', fontSize: 11 }, saveButton: { backgroundColor: '#5ca9ff', padding: 13, alignItems: 'center', borderRadius: 9 }, saveText: { color: '#07111f', fontWeight: '800' },
});
