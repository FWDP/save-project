import { WorkspaceScope } from '@/components/workspace-scope';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import {
  FinancePage,
  financePageStyles as styles,
} from '@/components/layout/finance-page';
import { MonthPicker } from '@/components/month-picker';
import { createBudget, updateBudget, deleteBudget } from '@/lib/api';
import { budgetProgress, budgetSpent, monthTransactions, totalBudgetSpent } from '@/lib/finance';
import { prepareMonthlyBudget } from '@/lib/budget-form';
import { getAuthUser } from '@/lib/auth';
import { useFinanceStore } from '@/store/finance-store';
import { useWorkspaceFinance } from '@/components/providers/workspace-finance-provider';
const money = (n: number, currency: string) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(n);
function BudgetsScreen() {
  const { budgets, transactions, categories, selectedMonth, isLoading, currency, workspace, refresh } = useWorkspaceFinance();
  const setBudgets = useFinanceStore(state => state.setBudgets);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const mutating = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const writable = workspace?.role !== 'viewer';
  const expenseCategories = categories.filter(item => item.type === 'expense');
  const save = async () => {
    if (mutating.current || !writable) return;
    let payload: ReturnType<typeof prepareMonthlyBudget>;
    try {
      payload = prepareMonthlyBudget(category, limit, useFinanceStore.getState().budgets, editing);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Enter a valid budget limit.');
      return;
    }
    mutating.current = true;
    setBusy(true);
    try {
      const user = await getAuthUser();
      if (!user) throw new Error('Sign in first');
      const result = editing
        ? await updateBudget(editing, payload)
        : await createBudget({ userId: user.id, ...payload });
      if (!mounted.current || (await getAuthUser())?.id !== user.id) return;
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
      void refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save this budget. Please retry.');
    } finally {
      mutating.current = false;
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
  const monthlyExpenses = monthTransactions(transactions, selectedMonth).filter(item => item.type === 'expense');
  const totalSpent = totalBudgetSpent(budgets, transactions, selectedMonth);
  const monthLabel = new Date(`${selectedMonth}-15T12:00:00`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  return (
    <FinancePage
      title="Budgets"
      subtitle={isLoading ? 'Syncing current transactions…' : 'Monthly category limits and remaining amounts'}
    >
      <MonthPicker />
      {rows.length ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{monthLabel}</Text>
          <Text style={styles.rowMeta}>
            {money(totalSpent, currency)} spent across {rows.length} budgeted categor{rows.length === 1 ? 'y' : 'ies'} of {money(rows.reduce((sum, row) => sum + row.budget.limit, 0), currency)}
          </Text>
        </View>
      ) : null}
      {!isLoading && rows.length > 0 && monthlyExpenses.length > 0 && rows.every((row) => row.spent === 0) ? (
        <Text style={{ color: '#e9bd69', lineHeight: 22 }}>
          Expenses exist for this month, but none match the budget category names. Edit a budget category to match the transaction category.
        </Text>
      ) : null}
      <Pressable
        disabled={busy || !writable}
        style={styles.primaryButton}
        onPress={() => {
          setMessage('');
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
            {editing ? budgets.find(item => item.id === editing)?.period === 'weekly' ? 'Convert weekly budget to monthly' : 'Edit budget' : 'New budget'}
          </Text>
          <Text style={styles.rowTitle}>Category</Text>
          <Text style={styles.rowMeta}>Parent categories include spending in their subcategories. Budgets use expenses dated in the selected month.</Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              marginVertical: 12,
            }}
          >
            {expenseCategories
              .map((c) => (
                <Pressable
                  key={c.id}
                  disabled={busy || !writable}
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
          <TextInput accessibilityLabel="Budget category" value={category} onChangeText={setCategory}
            editable={!busy && writable} maxLength={80} placeholder="Category / Subcategory" placeholderTextColor="#a1afc3"
            style={{ padding: 15, backgroundColor: '#081120', color: '#f4f7fb', borderRadius: 8 }} />
          {!expenseCategories.length && (
            <Text style={styles.rowMeta}>
              Enter the category exactly as it appears on your expenses, or create one in More → Categories.
            </Text>
          )}
          <TextInput
            accessibilityLabel="Monthly budget limit in PHP"
            editable={!busy && writable}
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
            disabled={busy || !writable}
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
            {money(spent, currency)} of {money(budget.limit, currency)}
          </Text>
          <Text style={styles.rowMeta}>Includes matching subcategories · {monthLabel}</Text>
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
            {money(Math.abs(remaining), currency)}{' '}
            {remaining < 0 ? 'over budget' : 'remaining'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 24 }}>
            <Pressable
              disabled={busy || !writable}
              style={{ paddingVertical: 16 }}
              onPress={() => {
                setMessage('');
                setEditing(budget.id);
                setCategory(budget.category);
                setLimit(String(budget.limit));
                setOpen(true);
              }}
            >
              <Text style={{ color: '#75b6ff' }}>Edit</Text>
            </Pressable>
            <Pressable
              disabled={busy || !writable}
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
                        if (mutating.current || !writable) return;
                        mutating.current = true;
                        setBusy(true);
                        setMessage('');
                        try {
                          const user = await getAuthUser();
                          if (!user) throw new Error('Sign in first.');
                          await deleteBudget(budget.id);
                          if (!mounted.current || (await getAuthUser())?.id !== user.id) return;
                          setBudgets(
                            useFinanceStore
                              .getState()
                              .budgets.filter((b) => b.id !== budget.id),
                          );
                          if (editing === budget.id) { setOpen(false); setEditing(null); setCategory(''); setLimit(''); }
                          void refresh();
                        } catch (error) {
                          setMessage(error instanceof Error ? error.message : 'Could not delete budget.');
                        } finally {
                          mutating.current = false;
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
          {isLoading ? 'Loading budgets…' : 'Create a monthly budget to see how much you have left to spend.'}
        </Text>
      )}
      {budgets.filter(item => item.period === 'weekly').map(budget => (
        <View key={budget.id} style={styles.card}>
          <Text style={styles.cardTitle}>{budget.category} · Weekly</Text>
          <Text style={styles.rowMeta}>{money(budget.limit, currency)} per week. Excluded from monthly totals.</Text>
          <Pressable disabled={busy || !writable} style={{ paddingVertical: 16 }} onPress={() => {
            setEditing(budget.id); setCategory(budget.category); setLimit(''); setMessage(''); setOpen(true);
          }}>
            <Text style={{ color: '#75b6ff' }}>Convert to monthly</Text>
          </Pressable>
        </View>
      ))}
    </FinancePage>
  );
}

export default function ScopedPage() { return <WorkspaceScope personalOnly><BudgetsScreen /></WorkspaceScope>; }
