import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createTransaction, type ApiTransaction } from '@/lib/api';
import { saveTransactions } from '@/lib/sqlite';
import { useExpenseDraftStore } from '@/store/expense-draft-store';
import { useFinanceStore } from '@/store/finance-store';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function ReceiptScreen() {
  const router = useRouter();
  const { transactions, setTransactions, categories } = useFinanceStore();
  const { draft, patchDraft, resetDraft } = useExpenseDraftStore();

  const [merchant, setMerchant] = useState(draft.merchant || 'SM Supermarket');
  const [category, setCategory] = useState(draft.category || (categories[0]?.name ?? 'Groceries'));
  const [amount, setAmount] = useState(draft.amount || '1428.50');
  const [date, setDate] = useState(draft.date || new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('Scanned receipt values ready for review');
  const [saving, setSaving] = useState(false);

  const handleSaveReceipt = async () => {
    const numAmount = Number(amount);
    if (!merchant.trim() || !Number.isFinite(numAmount) || numAmount <= 0) {
      setStatus('Please ensure merchant and positive amount are provided.');
      return;
    }

    setSaving(true);
    const transactionPayload = {
      userId: 'usr_2',
      type: 'expense' as const,
      amount: numAmount,
      category,
      description: `${merchant} receipt`,
      merchant: merchant.trim(),
      date,
      status: 'approved' as const,
      receiptUri: draft.receiptUri,
    };

    try {
      const created = await createTransaction(transactionPayload);
      const next = [created, ...transactions];
      setTransactions(next);
      saveTransactions(next);
      resetDraft();
      router.replace('/expenses');
    } catch {
      const fallback: ApiTransaction = {
        id: `txn_receipt_${Date.now()}`,
        ...transactionPayload,
      };
      const next = [fallback, ...transactions];
      setTransactions(next);
      saveTransactions(next);
      resetDraft();
      router.replace('/expenses');
    } finally {
      setSaving(false);
    }
  };

  const handleEditInFullForm = () => {
    patchDraft({
      merchant,
      category,
      amount,
      date,
      description: `${merchant} receipt`,
      type: 'expense',
    });
    router.push('/expense-add');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Receipt Scanner</Text>
          <Text style={styles.title}>Review Scanned Details</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Detected Values</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Merchant</Text>
            <TextInput
              style={styles.input}
              value={merchant}
              onChangeText={setMerchant}
              placeholder="Merchant name"
              placeholderTextColor="#65738c"
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Category</Text>
            <TextInput
              style={styles.input}
              value={category}
              onChangeText={setCategory}
              placeholder="Category"
              placeholderTextColor="#65738c"
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Amount (PHP)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#65738c"
            />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#65738c"
            />
          </View>

          {draft.receiptUri ? (
            <View style={styles.attachmentRow}>
              <Text style={styles.attachmentText}>
                ✓ Image attached: {draft.receiptUri.split('/').pop()}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Status</Text>
          <Text style={styles.noticeText}>{status}</Text>
        </View>

        <Pressable
          disabled={saving}
          onPress={handleSaveReceipt}
          style={[styles.primaryButton, saving && { opacity: 0.6 }]}>
          <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Quick Save Receipt'}</Text>
        </Pressable>

        <Pressable onPress={handleEditInFullForm} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Edit in Full Expense Form</Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.linkButton}>
          <Text style={styles.linkButtonText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070d1a',
  },
  container: {
    flexGrow: 1,
    padding: 20,
    gap: 12,
  },
  header: {
    marginBottom: 8,
  },
  eyebrow: {
    color: '#55a6ff',
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  title: {
    color: '#f4f7fb',
    fontSize: 26,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#0d1629',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#17243b',
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    color: '#f4f7fb',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  row: {
    gap: 4,
  },
  label: {
    color: '#7d8ba6',
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#081120',
    borderWidth: 1,
    borderColor: '#17243b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f4f7fb',
    fontSize: 14,
  },
  attachmentRow: {
    paddingTop: 6,
  },
  attachmentText: {
    color: '#19c983',
    fontSize: 12,
    fontWeight: '600',
  },
  notice: {
    backgroundColor: '#0d1629',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#17243b',
  },
  noticeTitle: {
    color: '#55a6ff',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 4,
  },
  noticeText: {
    color: '#7d8ba6',
    fontSize: 12,
  },
  primaryButton: {
    backgroundColor: '#55a6ff',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryButtonText: {
    color: '#07111f',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#263956',
    backgroundColor: '#111c31',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#f4f7fb',
    fontSize: 14,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  linkButtonText: {
    color: '#7d8ba6',
    fontSize: 14,
  },
});
