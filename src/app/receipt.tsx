import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createTransaction, type ApiTransaction } from '@/lib/api';
import { saveTransactions } from '@/lib/sqlite';
import { useFinanceStore } from '@/store/finance-store';

export default function ReceiptScreen() {
  const router = useRouter();
  const { transactions, setTransactions } = useFinanceStore();
  const [status, setStatus] = useState('Ready to scan');

  const demoReceipt = {
    merchant: 'Fresh Mart',
    category: 'Food & Dining',
    amount: 142.85,
    date: new Date().toISOString().slice(0, 10),
  };

  const handleSaveReceipt = async () => {
    const transaction: ApiTransaction = {
      id: `txn_receipt_${Date.now()}`,
      userId: 'usr_2',
      type: 'expense',
      amount: demoReceipt.amount,
      category: demoReceipt.category,
      description: `${demoReceipt.merchant} receipt`,
      date: demoReceipt.date,
      status: 'approved',
    };

    try {
      const created = await createTransaction({
        userId: transaction.userId,
        type: transaction.type,
        amount: transaction.amount,
        category: transaction.category,
        description: transaction.description,
        date: transaction.date,
        status: transaction.status,
      });
      const next = [created, ...transactions];
      setTransactions(next);
      saveTransactions(next);
      setStatus('Receipt processed and saved');
    } catch {
      const next = [transaction, ...transactions];
      setTransactions(next);
      saveTransactions(next);
      setStatus('Saved offline. Sync will retry later.');
    }

    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Receipt scan</Text>
          <Text style={styles.title}>OCR review</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Detected values</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Merchant</Text>
            <Text style={styles.value}>{demoReceipt.merchant}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Category</Text>
            <Text style={styles.value}>{demoReceipt.category}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Amount</Text>
            <Text style={styles.value}>${demoReceipt.amount.toFixed(2)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{demoReceipt.date}</Text>
          </View>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Status</Text>
          <Text style={styles.noticeText}>{status}</Text>
        </View>

        <Pressable onPress={handleSaveReceipt} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Save receipt</Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Back to dashboard</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  container: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    marginBottom: 20,
  },
  eyebrow: {
    color: '#7dd3fc',
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 1.2,
  },
  title: {
    color: '#f8fafc',
    fontSize: 30,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#121d2e',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1d2940',
    padding: 18,
    gap: 12,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1d2940',
    paddingBottom: 10,
  },
  label: {
    color: '#8aa3bf',
    fontSize: 14,
  },
  value: {
    color: '#f8fafc',
    fontWeight: '600',
  },
  notice: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#1d2940',
  },
  noticeTitle: {
    color: '#93c5fd',
    fontWeight: '700',
    marginBottom: 6,
  },
  noticeText: {
    color: '#e2e8f0',
  },
  primaryButton: {
    marginTop: 24,
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1d2940',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '600',
  },
});
