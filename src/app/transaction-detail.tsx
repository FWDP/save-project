import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  FinancePage,
  financePageStyles as styles,
} from '@/components/layout/finance-page';
import { deleteTransaction, updateTransaction } from '@/lib/api';
import { validDate } from '@/lib/finance';
import { useFinanceStore } from '@/store/finance-store';
export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { transactions, setTransactions } = useFinanceStore();
  const item = transactions.find((row) => row.id === id);
  const [form, setForm] = useState({
    description: item?.description ?? '',
    amount: String(item?.amount ?? ''),
    date: item?.date ?? '',
    category: item?.category ?? '',
    merchant: item?.merchant ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (item?.syncState === 'pending')
    return (
      <FinancePage title="Awaiting upload" subtitle="Saved on this device">
        <Text style={styles.emptyText}>
          This transaction will upload when a connection is available. Pull to
          refresh to retry before editing.
        </Text>
      </FinancePage>
    );
  if (!item)
    return (
      <FinancePage title="Transaction" subtitle="This record is unavailable">
        <Text style={styles.emptyText}>
          Refresh your transactions and try again.
        </Text>
      </FinancePage>
    );
  const save = async () => {
    if (busy) return;
    if (
      !validDate(form.date) ||
      !form.description.trim() ||
      !form.category.trim() ||
      !Number.isFinite(Number(form.amount)) ||
      Number(form.amount) <= 0
    ) {
      setMessage(
        'Enter a valid date, description, category and positive amount.',
      );
      return;
    }
    setBusy(true);
    try {
      const updated = await updateTransaction(id, {
        ...form,
        amount: Number(form.amount),
      });
      setTransactions(
        useFinanceStore
          .getState()
          .transactions.map((row) => (row.id === id ? updated : row)),
      );
      router.back();
    } catch {
      setMessage('Could not save changes. Please retry.');
    } finally {
      setBusy(false);
    }
  };
  const remove = () =>
    Alert.alert(
      'Delete transaction?',
      'This permanently removes this record.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteTransaction(id);
              setTransactions(
                useFinanceStore
                  .getState()
                  .transactions.filter((row) => row.id !== id),
              );
              router.back();
            } catch {
              setMessage('Could not delete. Please retry.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  return (
    <FinancePage
      title="Transaction details"
      subtitle={item.type === 'income' ? 'Income' : 'Expense'}
    >
      <View style={styles.card}>
        {(Object.keys(form) as (keyof typeof form)[]).map((key) => (
          <View key={key} style={{ marginBottom: 14 }}>
            <Text style={styles.rowTitle}>
              {key === 'amount'
                ? 'Amount (PHP)'
                : key.charAt(0).toUpperCase() + key.slice(1)}
            </Text>
            <TextInput
              accessibilityLabel={key}
              value={form[key]}
              onChangeText={(value) => setForm({ ...form, [key]: value })}
              keyboardType={key === 'amount' ? 'decimal-pad' : 'default'}
              style={{
                color: '#f4f7fb',
                backgroundColor: '#081120',
                padding: 14,
                borderRadius: 8,
                marginTop: 8,
                fontSize: 16,
              }}
            />
          </View>
        ))}
      </View>
      {item.receiptUri &&
        /^(file:|content:|https:|blob:)/.test(item.receiptUri) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Receipt on this device</Text>
            {/\.pdf(?:\?|$)/i.test(item.receiptUri) ? (
              <Pressable onPress={() => Linking.openURL(item.receiptUri!)}>
                <Text style={{ color: '#75b6ff' }}>Open PDF</Text>
              </Pressable>
            ) : (
              <Image
                source={{ uri: item.receiptUri }}
                style={{ height: 300 }}
                contentFit="contain"
              />
            )}
            <Text style={styles.rowMeta}>
              Receipt files are currently stored on the device where they were
              attached.
            </Text>
          </View>
        )}
      {message ? (
        <Text accessibilityLiveRegion="polite" style={{ color: '#ff8195' }}>
          {message}
        </Text>
      ) : null}
      <Pressable disabled={busy} style={styles.primaryButton} onPress={save}>
        <Text style={styles.primaryButtonText}>
          {busy ? 'Please wait…' : 'Save changes'}
        </Text>
      </Pressable>
      <Pressable
        disabled={busy}
        onPress={remove}
        style={{ padding: 18, alignItems: 'center' }}
      >
        <Text style={{ color: '#ff8195', fontSize: 16 }}>
          Delete transaction
        </Text>
      </Pressable>
    </FinancePage>
  );
}
