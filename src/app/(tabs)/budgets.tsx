import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import {
  FinancePage,
  financePageStyles as styles,
} from '@/components/layout/finance-page';
import { MonthPicker } from '@/components/month-picker';
import { createBudget, updateBudget, deleteBudget } from '@/lib/api';
import { budgetProgress, budgetSpent } from '@/lib/finance';
import { getAuthUser } from '@/lib/auth';
import { useFinanceStore } from '@/store/finance-store';
const money = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function BudgetsScreen() {
  const { budgets, setBudgets, transactions, categories, selectedMonth } =
    useFinanceStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (busy) return;
    if (!category || !Number.isFinite(Number(limit)) || Number(limit) <= 0) {
      setMessage('Choose a category and enter a positive limit.');
      return;
    }
    if (
      budgets.some(
        (b) =>
          b.category === category && b.period === 'monthly' && b.id !== editing,
      )
    ) {
      setMessage('This category already has a monthly budget. Edit it below.');
      return;
    }
    setBusy(true);
    try {
      const user = await getAuthUser();
      if (!user) throw new Error('Sign in first');
      const result = editing
        ? await updateBudget(editing, {
            category,
            limit: Number(limit),
            period: 'monthly',
          })
        : await createBudget({
            userId: user.id,
            category,
            limit: Number(limit),
            period: 'monthly',
          });
      const current = useFinanceStore.getState().budgets;
      setBudgets(
        editing
          ? current.map((b) => (b.id === editing ? result : b))
          : [...current, result],
      );
      setOpen(false);
      setEditing(null);
      setCategory('');
      setLimit('');
      setMessage('');
    } catch {
      setMessage('Could not save this budget. Please retry.');
    } finally {
      setBusy(false);
    }
  };
  const rows = budgets
    .filter((b) => b.period === 'monthly')
    .map((budget) => {
      const spent = budgetSpent(budget, transactions, selectedMonth);
      return { budget, spent, ...budgetProgress(spent, budget.limit) };
    })
    .sort((a, b) => b.percent - a.percent);
  return (
    <FinancePage
      title="Budgets"
      subtitle="Monthly category limits and remaining amounts"
    >
      <MonthPicker />
      <Pressable
        style={styles.primaryButton}
        onPress={() => {
          setEditing(null);
          setCategory('');
          setLimit('');
          setOpen(!open);
        }}
      >
        <Text style={styles.primaryButtonText}>
          {open ? 'Close form' : 'Add monthly budget'}
        </Text>
      </Pressable>
      {open && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {editing ? 'Edit budget' : 'New budget'}
          </Text>
          <Text style={styles.rowTitle}>Category</Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              marginVertical: 12,
            }}
          >
            {categories
              .filter((c) => c.type === 'expense')
              .map((c) => (
                <Pressable
                  key={c.id}
                  accessibilityState={{ selected: c.name === category }}
                  onPress={() => setCategory(c.name)}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor:
                      category === c.name ? '#264b78' : '#17243b',
                  }}
                >
                  <Text style={{ color: '#f4f7fb' }}>{c.name}</Text>
                </Pressable>
              ))}
          </View>
          {!categories.length && (
            <Text style={styles.rowMeta}>
              Create an expense category in More → Categories first.
            </Text>
          )}
          <TextInput
            accessibilityLabel="Monthly budget limit in PHP"
            value={limit}
            onChangeText={setLimit}
            placeholder="Limit in PHP"
            placeholderTextColor="#a1afc3"
            keyboardType="decimal-pad"
            style={{
              padding: 15,
              backgroundColor: '#081120',
              color: '#f4f7fb',
              borderRadius: 8,
              fontSize: 16,
            }}
          />
          <Pressable
            disabled={busy}
            style={styles.primaryButton}
            onPress={save}
          >
            <Text style={styles.primaryButtonText}>
              {busy ? 'Saving…' : 'Save budget'}
            </Text>
          </Pressable>
        </View>
      )}
      {message ? <Text style={{ color: '#ff8195' }}>{message}</Text> : null}
      {rows.map(({ budget, spent, percent, width, remaining }) => (
        <View key={budget.id} style={styles.card}>
          <View style={styles.rowTop}>
            <Text style={styles.rowTitle}>{budget.category}</Text>
            <Text
              style={[styles.rowValue, remaining < 0 && { color: '#ff8195' }]}
            >
              {Math.round(percent)}%
            </Text>
          </View>
          <Text style={styles.rowMeta}>
            {money(spent)} of {money(budget.limit)}
          </Text>
          <View
            style={{
              height: 8,
              backgroundColor: '#26344b',
              borderRadius: 8,
              marginVertical: 12,
            }}
          >
            <View
              style={{
                width: `${width}%`,
                height: 8,
                borderRadius: 8,
                backgroundColor: remaining < 0 ? '#ff8195' : '#55a6ff',
              }}
            />
          </View>
          <Text
            style={{
              color: remaining < 0 ? '#ff8195' : '#a1afc3',
              fontSize: 15,
            }}
          >
            {money(Math.abs(remaining))}{' '}
            {remaining < 0 ? 'over budget' : 'remaining'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 24 }}>
            <Pressable
              style={{ paddingVertical: 16 }}
              onPress={() => {
                setEditing(budget.id);
                setCategory(budget.category);
                setLimit(String(budget.limit));
                setOpen(true);
              }}
            >
              <Text style={{ color: '#75b6ff' }}>Edit</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              style={{ paddingVertical: 16 }}
              onPress={() =>
                Alert.alert(
                  'Delete budget?',
                  'Transactions in this category will be kept.',
                  [
                    { text: 'Cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        setBusy(true);
                        try {
                          await deleteBudget(budget.id);
                          setBudgets(
                            useFinanceStore
                              .getState()
                              .budgets.filter((b) => b.id !== budget.id),
                          );
                        } catch {
                          setMessage('Could not delete budget.');
                        } finally {
                          setBusy(false);
                        }
                      },
                    },
                  ],
                )
              }
            >
              <Text style={{ color: '#ff8195' }}>Delete</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {!rows.length && (
        <Text style={styles.emptyText}>
          Create a monthly budget to see how much you have left to spend.
        </Text>
      )}
      {budgets.some((b) => b.period === 'weekly') && (
        <Text style={styles.rowMeta}>
          Weekly budgets are excluded from this monthly view.
        </Text>
      )}
    </FinancePage>
  );
}
