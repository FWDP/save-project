import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { FinancePage, financePageStyles as styles } from '@/components/layout/finance-page';
import { useFinanceStore } from '@/store/finance-store';
import { createBudget } from '@/lib/api';
import { saveBudgets } from '@/lib/sqlite';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

export default function BudgetsScreen() {
  const { budgets, setBudgets, transactions } = useFinanceStore();
  const [form, setForm] = useState({ category: '', limit: '' });
  const [message, setMessage] = useState<string | null>(null);

  const currentMonthPrefix = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const dynamicSpentMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.type === 'expense' && t.date.startsWith(currentMonthPrefix)) {
        map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
      }
    }
    return map;
  }, [currentMonthPrefix, transactions]);

  const addBudget = async () => {
    const limit = Number(form.limit);
    if (!form.category.trim() || !Number.isFinite(limit) || limit <= 0) {
      return setMessage('Enter a category and valid limit.');
    }
    try {
      const created = await createBudget({
        userId: 'usr_2',
        category: form.category.trim(),
        limit,
        period: 'monthly',
      });
      const next = [...budgets, created];
      setBudgets(next);
      saveBudgets(next);
      setForm({ category: '', limit: '' });
      setMessage(null);
    } catch {
      setMessage('The budgets API is unavailable.');
    }
  };

  return (
    <FinancePage title="Budgets" subtitle="Category spending limits and progress">
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Budget progress</Text>
        {budgets.map((budget) => {
          const used = dynamicSpentMap.has(budget.category)
            ? (dynamicSpentMap.get(budget.category) ?? 0)
            : budget.spent;
          const percent = Math.min((used / Math.max(budget.limit, 1)) * 100, 100);

          return (
            <View key={budget.id} style={styles.row}>
              <View style={styles.rowTop}>
                <Text style={styles.rowTitle}>{budget.category}</Text>
                <Text style={styles.rowValue}>{Math.round(percent)}%</Text>
              </View>
              <Text style={styles.rowMeta}>
                {peso.format(used)} of {peso.format(budget.limit)} · {budget.period}
              </Text>
              <View
                style={{
                  height: 5,
                  borderRadius: 5,
                  backgroundColor: '#17243b',
                  marginTop: 9,
                  overflow: 'hidden',
                }}>
                <View
                  style={{
                    width: `${percent}%`,
                    height: '100%',
                    backgroundColor: percent >= 100 ? '#ff4f6d' : '#55a6ff',
                  }}
                />
              </View>
            </View>
          );
        })}
        {!budgets.length ? <Text style={styles.emptyText}>No budgets have synced yet.</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add monthly budget</Text>
        <TextInput
          style={{
            backgroundColor: '#081120',
            color: '#f4f7fb',
            borderRadius: 9,
            padding: 12,
            marginBottom: 9,
          }}
          placeholder="Category"
          placeholderTextColor="#65738c"
          value={form.category}
          onChangeText={(category) => setForm((value) => ({ ...value, category }))}
        />
        <TextInput
          style={{
            backgroundColor: '#081120',
            color: '#f4f7fb',
            borderRadius: 9,
            padding: 12,
          }}
          placeholder="Limit in PHP"
          placeholderTextColor="#65738c"
          keyboardType="decimal-pad"
          value={form.limit}
          onChangeText={(limit) => setForm((value) => ({ ...value, limit }))}
        />
        {message ? <Text style={[styles.rowMeta, { color: '#ff8b9c' }]}>{message}</Text> : null}
        <Pressable style={styles.primaryButton} onPress={addBudget}>
          <Text style={styles.primaryButtonText}>Save budget</Text>
        </Pressable>
      </View>
    </FinancePage>
  );
}
