import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { FinancePage, financePageStyles as styles } from '@/components/layout/finance-page';
import { createSavingsGoal, fetchSavingsGoals, type ApiSavingsGoal } from '@/lib/api';

export default function SavingsScreen() {
  const [goals, setGoals] = useState<ApiSavingsGoal[]>([]);
  const [form, setForm] = useState({ name: '', targetAmount: '', targetDate: '' });
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { void fetchSavingsGoals().then(setGoals).catch(() => setMessage('Savings API unavailable.')); }, []);
  const create = async () => {
    const targetAmount = Number(form.targetAmount);
    if (!form.name.trim() || !Number.isFinite(targetAmount) || targetAmount <= 0) return setMessage('Enter a goal name and valid target.');
    try { const goal = await createSavingsGoal({ name: form.name.trim(), targetAmount, targetDate: form.targetDate || undefined, asset: 'XLM' }); setGoals((items) => [goal, ...items]); setForm({ name: '', targetAmount: '', targetDate: '' }); setMessage(null); }
    catch { setMessage('Savings API unavailable.'); }
  };
  return <FinancePage title="Savings Goals" subtitle="Off-chain drafts prepared for Stellar testnet">
    <View style={styles.card}>{goals.map((goal) => <View key={goal.id} style={styles.row}><View style={styles.rowTop}><Text style={styles.rowTitle}>{goal.name}</Text><Text style={styles.rowValue}>{goal.fundedAmount} / {goal.targetAmount} {goal.asset}</Text></View><Text style={styles.rowMeta}>{goal.status} · {goal.targetDate || 'No target date'} · awaiting Soroban deployment</Text></View>)}{!goals.length ? <><Text style={styles.emptyTitle}>No savings goals yet</Text><Text style={styles.emptyText}>Create an off-chain draft below. Funding remains unavailable until the verified Soroban integration is complete.</Text></> : null}</View>
    <View style={styles.card}><Text style={styles.cardTitle}>Create goal draft</Text>{[['Goal name', 'name'], ['Target amount in XLM', 'targetAmount'], ['Target date (YYYY-MM-DD)', 'targetDate']].map(([placeholder, key]) => <TextInput key={key} style={{ backgroundColor: '#081120', color: '#f4f7fb', borderRadius: 9, padding: 12, marginBottom: 9 }} placeholder={placeholder} placeholderTextColor="#65738c" keyboardType={key === 'targetAmount' ? 'decimal-pad' : 'default'} value={form[key as keyof typeof form]} onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))} />)}{message ? <Text style={[styles.rowMeta, { color: '#ff8b9c' }]}>{message}</Text> : null}<Pressable style={styles.primaryButton} onPress={create}><Text style={styles.primaryButtonText}>Save goal draft</Text></Pressable></View>
  </FinancePage>;
}
