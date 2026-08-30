import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';

import { FinancePage } from '@/components/layout/finance-page';
import { createTransaction } from '@/lib/api';
import { saveTransactions } from '@/lib/sqlite';
import { useExpenseDraftStore } from '@/store/expense-draft-store';
import { useFinanceStore } from '@/store/finance-store';

export default function AddExpenseScreen() {
  const router = useRouter();
  const { categories, setTransactions, transactions } = useFinanceStore();
  const { draft, patchDraft, resetDraft } = useExpenseDraftStore();
  const [showCategories, setShowCategories] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const availableCategories = useMemo(() => categories.filter((item) => item.type === draft.type), [categories, draft.type]);

  const setType = (type: 'expense' | 'income') => patchDraft({ type, category: '' });
  const addField = () => patchDraft({ customFields: [...draft.customFields, { label: '', value: '' }] });
  const updateField = (index: number, key: 'label' | 'value', value: string) => patchDraft({ customFields: draft.customFields.map((field, fieldIndex) => fieldIndex === index ? { ...field, [key]: value } : field) });
  const upload = async () => {
    const selected = await File.pickFileAsync({ mimeTypes: ['image/*', 'application/pdf'] });
    if (!selected.canceled) patchDraft({ receiptUri: selected.result.uri });
  };
  const submit = async () => {
    const amount = Number(draft.amount);
    if (!draft.date || !draft.category || !draft.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      setMessage('Date, amount, category, and description are required.'); return;
    }
    setSaving(true);
    try {
      const customFields = Object.fromEntries(draft.customFields.filter((field) => field.label.trim()).map((field) => [field.label.trim(), field.value.trim()]));
      const created = await createTransaction({ userId: 'usr_2', type: draft.type, amount, category: draft.category, description: draft.description.trim(), date: draft.date, status: 'approved', merchant: draft.merchant.trim() || undefined, tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean), recurring: draft.type === 'expense' && draft.recurring, receiptUri: draft.receiptUri, customFields });
      const next = [created, ...transactions]; setTransactions(next); saveTransactions(next); resetDraft(); router.replace('/expenses');
    } catch { setMessage('The expense API is unavailable. Nothing was added.'); } finally { setSaving(false); }
  };

  return <FinancePage title="Add Expense" subtitle="Create an expense or income record">
    <View style={styles.segment}><Pressable style={[styles.segmentButton, draft.type === 'expense' && styles.expenseActive]} onPress={() => setType('expense')}><Text style={styles.segmentText}>Expense</Text></Pressable><Pressable style={[styles.segmentButton, draft.type === 'income' && styles.incomeActive]} onPress={() => setType('income')}><Text style={styles.segmentText}>Income</Text></Pressable></View>
    <View style={styles.twoColumns}><Field label="Date *" value={draft.date} onChangeText={(date) => patchDraft({ date })} placeholder="YYYY-MM-DD" /><Field label="Amount (PHP) *" value={draft.amount} onChangeText={(amount) => patchDraft({ amount })} placeholder="0.00" keyboardType="decimal-pad" /></View>
    <Text style={styles.label}>{draft.type === 'expense' ? 'Category' : 'Income Source'} *</Text>
    <View style={styles.categoryRow}><Pressable style={styles.select} onPress={() => setShowCategories((value) => !value)}><Text style={[styles.inputText, !draft.category && styles.placeholder]}>{draft.category || `Select ${draft.type === 'expense' ? 'category' : 'income source'}…`}</Text><Text style={styles.inputText}>⌄</Text></Pressable><Pressable style={styles.newButton} onPress={() => router.push('/categories')}><Text style={styles.newButtonText}>＋ New</Text></Pressable></View>
    {showCategories ? <View style={styles.options}>{availableCategories.map((item) => <Pressable key={item.id} onPress={() => { patchDraft({ category: item.name }); setShowCategories(false); }} style={styles.option}><View style={[styles.dot, { backgroundColor: item.color }]} /><Text style={styles.optionText}>{item.name}</Text></Pressable>)}</View> : null}
    <Field label="Description *" value={draft.description} onChangeText={(description) => patchDraft({ description })} placeholder={draft.type === 'expense' ? 'What was this expense for?' : 'What was this income for?'} />
    <Field label="Merchant / Store" value={draft.merchant} onChangeText={(merchant) => patchDraft({ merchant })} placeholder="e.g. Jollibee, SM Mall, Lazada…" />
    <View style={styles.details}><Text style={styles.legend}>Personal Details</Text>{draft.customFields.length ? draft.customFields.map((field, index) => <View key={index} style={styles.twoColumns}><Field label="Field name" value={field.label} onChangeText={(value) => updateField(index, 'label', value)} placeholder="Project" /><Field label="Value" value={field.value} onChangeText={(value) => updateField(index, 'value', value)} placeholder="Value" /></View>) : <Text style={styles.help}>No extra fields yet. Add fields like “Project”, “Client”, or “Tax Rate”.</Text>}<Pressable style={styles.dashedButton} onPress={addField}><Text style={styles.dashedText}>＋ Add Custom Field</Text></Pressable></View>
    <Field label="Tags" value={draft.tags} onChangeText={(tags) => patchDraft({ tags })} placeholder="Add comma-separated tags…" help="Commas separate tags" />
    {draft.type === 'expense' ? <View style={styles.switchRow}><Text style={styles.switchText}>↻  Recurring expense</Text><Switch value={draft.recurring} onValueChange={(recurring) => patchDraft({ recurring })} trackColor={{ false: '#21304a', true: '#5ca9ff' }} /></View> : null}
    <View><Text style={styles.label}>Receipt <Text style={styles.muted}>(optional — AI pre-fill coming later)</Text></Text><View style={styles.receiptRow}><Pressable style={[styles.receiptButton, styles.receiptPrimary]} onPress={() => router.push('/receipt-camera')}><Text style={styles.receiptIcon}>▣</Text><Text style={styles.receiptTitle}>Take Photo</Text><Text style={styles.receiptMeta}>Use camera</Text></Pressable><Pressable style={styles.receiptButton} onPress={upload}><Text style={styles.receiptIcon}>⇧</Text><Text style={styles.receiptTitle}>Upload File</Text><Text style={styles.receiptMeta}>Image or PDF</Text></Pressable></View>{draft.receiptUri ? <Text numberOfLines={1} style={styles.attachment}>✓ Receipt attached: {draft.receiptUri.split('/').pop()}</Text> : null}</View>
    {message ? <Text style={styles.error}>{message}</Text> : null}
    <View style={styles.actions}><Pressable style={styles.cancel} onPress={() => { resetDraft(); router.back(); }}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={saving} style={styles.submit} onPress={submit}><Text style={styles.submitText}>{saving ? 'Saving…' : `Add ${draft.type === 'expense' ? 'Expense' : 'Income'}`}</Text></Pressable></View>
  </FinancePage>;
}

function Field({ label, help, ...props }: { label: string; help?: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: 'decimal-pad' }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} placeholderTextColor="#65738c" style={styles.input} />{help ? <Text style={styles.help}>{help}</Text> : null}</View>;
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderWidth: 1, borderColor: '#1b2941', borderRadius: 10, overflow: 'hidden' }, segmentButton: { flex: 1, paddingVertical: 15, alignItems: 'center', backgroundColor: '#0d1629' }, expenseActive: { backgroundColor: '#d9474d' }, incomeActive: { backgroundColor: '#18b95f' }, segmentText: { color: '#f4f7fb', fontWeight: '800' },
  twoColumns: { flexDirection: 'row', gap: 12 }, field: { flex: 1 }, label: { color: '#e5ebf5', fontSize: 13, fontWeight: '700', marginBottom: 7 }, input: { backgroundColor: '#081120', borderWidth: 1, borderColor: '#1b2941', borderRadius: 9, paddingHorizontal: 13, paddingVertical: 13, color: '#f4f7fb' }, placeholder: { color: '#65738c' }, inputText: { color: '#edf2fa', fontSize: 13 }, categoryRow: { flexDirection: 'row', gap: 9 }, select: { flex: 1, minHeight: 48, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#081120', borderWidth: 1, borderColor: '#1b2941', borderRadius: 9 }, newButton: { paddingHorizontal: 13, justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderStyle: 'dashed', borderColor: '#4d83bd' }, newButtonText: { color: '#65acfa', fontWeight: '700' },
  options: { backgroundColor: '#101c32', borderRadius: 9, borderWidth: 1, borderColor: '#22334f', padding: 7 }, option: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 9 }, dot: { width: 9, height: 9, borderRadius: 5 }, optionText: { color: '#e7edf7' }, details: { borderWidth: 1, borderColor: '#26334a', borderRadius: 10, padding: 14, gap: 10 }, legend: { color: '#9aa6ba', fontSize: 13, fontWeight: '700' }, help: { color: '#8793a8', fontSize: 11, lineHeight: 17, marginTop: 6 }, dashedButton: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#263a58', borderRadius: 8, padding: 12, alignItems: 'center' }, dashedText: { color: '#9aa8bd', fontWeight: '700', fontSize: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#0d1629', borderWidth: 1, borderColor: '#1b2941', borderRadius: 10 }, switchText: { color: '#edf2fa', fontWeight: '700' }, muted: { color: '#8b97aa', fontWeight: '400' }, receiptRow: { flexDirection: 'row', gap: 10 }, receiptButton: { flex: 1, minHeight: 130, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#293a54', alignItems: 'center', justifyContent: 'center' }, receiptPrimary: { borderStyle: 'solid', borderWidth: 2, borderColor: '#386a9e' }, receiptIcon: { color: '#62aaff', fontSize: 27 }, receiptTitle: { color: '#75b6ff', fontWeight: '700', marginTop: 8 }, receiptMeta: { color: '#8793a8', fontSize: 11, marginTop: 7 }, attachment: { color: '#21c985', fontSize: 10, marginTop: 8 }, error: { color: '#ff788c', fontSize: 11 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, borderTopWidth: 1, borderTopColor: '#19263d', paddingTop: 12 }, cancel: { borderWidth: 1, borderColor: '#263650', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 9 }, cancelText: { color: '#e6edf8', fontWeight: '700' }, submit: { backgroundColor: '#5ca9ff', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 9 }, submitText: { color: '#07111f', fontWeight: '800' },
});
