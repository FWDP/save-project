import { useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { FinancePage } from '@/components/layout/finance-page';
import type { ApiTransaction } from '@/lib/api';
import { useFinanceStore } from '@/store/finance-store';

type PeriodKey = 'month' | 'lastMonth' | 'threeMonths' | 'sixMonths' | 'year';
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'threeMonths', label: 'Last 3 months' },
  { key: 'sixMonths', label: 'Last 6 months' },
  { key: 'year', label: 'Year to date' },
];

const money = (value: number) =>
  `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function rangeFor(key: PeriodKey) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (key === 'lastMonth') {
    const start = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    return { start, end };
  }
  if (key === 'threeMonths') {
    const start = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
    return { start, end };
  }
  if (key === 'sixMonths') {
    const start = new Date(Date.UTC(year, month - 5, 1)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
    return { start, end };
  }
  if (key === 'year') {
    const start = new Date(Date.UTC(year, 0, 1)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
    return { start, end };
  }
  const start = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  return { start, end };
}

function inPeriod(item: ApiTransaction, key: PeriodKey) {
  const { start, end } = rangeFor(key);
  return item.date >= start && item.date <= end;
}

function stats(items: ApiTransaction[]) {
  const expenses = items.filter((item) => item.type === 'expense');
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  const categories = Object.entries(
    expenses.reduce<Record<string, number>>(
      (all, item) => ({ ...all, [item.category]: (all[item.category] ?? 0) + item.amount }),
      {},
    ),
  ).sort((a, b) => b[1] - a[1]);

  const merchants = Object.entries(
    expenses.reduce<Record<string, { count: number; total: number }>>((all, item) => {
      const name = item.merchant?.trim() || item.description;
      const previous = all[name] ?? { count: 0, total: 0 };
      return { ...all, [name]: { count: previous.count + 1, total: previous.total + item.amount } };
    }, {}),
  )
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5);

  return {
    total,
    count: expenses.length,
    average: expenses.length ? total / expenses.length : 0,
    largest: Math.max(0, ...expenses.map((item) => item.amount)),
    categories,
    merchants,
  };
}

export default function ReportsScreen() {
  const transactions = useFinanceStore((state) => state.transactions);
  const [mode, setMode] = useState<'single' | 'compare'>('single');
  const [periodA, setPeriodA] = useState<PeriodKey>('month');
  const [periodB, setPeriodB] = useState<PeriodKey>('lastMonth');

  const a = useMemo(
    () => stats(transactions.filter((item) => inPeriod(item, periodA))),
    [periodA, transactions],
  );
  const b = useMemo(
    () => stats(transactions.filter((item) => inPeriod(item, periodB))),
    [periodB, transactions],
  );

  const maxCategory = Math.max(
    1,
    ...a.categories.map((entry) => entry[1]),
    ...b.categories.map((entry) => entry[1]),
  );

  const exportCsv = async () => {
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [
      'date,type,amount,category,description,merchant,tags',
      ...transactions.map((item) =>
        [
          item.date,
          item.type,
          item.amount,
          item.category,
          item.description,
          item.merchant,
          item.tags?.join('|'),
        ]
          .map(escape)
          .join(','),
      ),
    ].join('\n');

    try {
      await Share.share({
        title: `SAVE report ${new Date().toISOString().slice(0, 10)}`,
        message: csv,
      });
    } catch {
      Alert.alert('Export failed', 'The CSV could not be shared on this device.');
    }
  };

  return (
    <FinancePage title="Reports" subtitle="Personal Spending Analysis">
      <View style={styles.toolbar}>
        <View style={styles.segment}>
          <Pressable
            style={[styles.tab, mode === 'single' && styles.tabActive]}
            onPress={() => setMode('single')}>
            <Text style={styles.tabText}>Single</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, mode === 'compare' && styles.tabActive]}
            onPress={() => setMode('compare')}>
            <Text style={styles.tabText}>Compare</Text>
          </Pressable>
        </View>
        <Pressable style={styles.export} onPress={exportCsv}>
          <Text style={styles.exportText}>⇩ Export CSV</Text>
        </Pressable>
      </View>

      {mode === 'single' ? (
        <SinglePeriod value={periodA} onChange={setPeriodA} />
      ) : (
        <View style={styles.card}>
          <Text style={styles.periodLabel}>PERIOD A</Text>
          <PeriodButtons value={periodA} onChange={setPeriodA} />
          <View style={styles.divider} />
          <Text style={styles.periodLabel}>PERIOD B</Text>
          <PeriodButtons value={periodB} onChange={setPeriodB} />
        </View>
      )}

      {mode === 'compare' ? <CompareSummary a={a} b={b} /> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {mode === 'single'
            ? `Spending by Category — ${PERIODS.find((item) => item.key === periodA)?.label}`
            : 'Category Breakdown'}
        </Text>
        {Array.from(
          new Set([
            ...a.categories.map(([name]) => name),
            ...(mode === 'compare' ? b.categories.map(([name]) => name) : []),
          ]),
        ).map((name) => {
          const av = a.categories.find(([key]) => key === name)?.[1] ?? 0;
          const bv = b.categories.find(([key]) => key === name)?.[1] ?? 0;
          return (
            <View key={name} style={styles.barRow}>
              <Text numberOfLines={2} style={styles.barLabel}>
                {name}
              </Text>
              <View style={styles.barArea}>
                <View
                  style={[
                    styles.bar,
                    { width: `${Math.max(av ? 3 : 0, (av / maxCategory) * 100)}%` },
                  ]}
                />
                {mode === 'compare' ? (
                  <View
                    style={[
                      styles.bar,
                      styles.barB,
                      { width: `${Math.max(bv ? 3 : 0, (bv / maxCategory) * 100)}%` },
                    ]}
                  />
                ) : null}
              </View>
            </View>
          );
        })}
        {!a.categories.length && (mode === 'single' || !b.categories.length) ? (
          <Text style={styles.empty}>No expenses in the selected period.</Text>
        ) : null}
        {mode === 'compare' ? (
          <View style={styles.legend}>
            <Text style={styles.legendA}>■ Period A</Text>
            <Text style={styles.legendB}>■ Period B</Text>
          </View>
        ) : null}
      </View>

      {mode === 'single' ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Summary</Text>
            <Metric label="Total spent" value={money(a.total)} />
            <Metric label="Transactions" value={String(a.count)} />
            <Metric label="Avg per transaction" value={money(a.average)} />
            <Metric label="Largest expense" value={money(a.largest)} />
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top Merchants</Text>
            {a.merchants.map(([name, value]) => (
              <View key={name} style={styles.metric}>
                <Text numberOfLines={1} style={styles.metricLabel}>
                  {name}
                </Text>
                <Text style={styles.count}>{value.count}×</Text>
                <Text style={styles.metricValue}>{money(value.total)}</Text>
              </View>
            ))}
            {!a.merchants.length ? (
              <Text style={styles.empty}>No merchant data in this period.</Text>
            ) : null}
          </View>
        </>
      ) : null}
    </FinancePage>
  );
}

function SinglePeriod({
  value,
  onChange,
}: {
  value: PeriodKey;
  onChange: (value: PeriodKey) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.periodLabel}>PERIOD</Text>
      <PeriodButtons value={value} onChange={onChange} />
    </View>
  );
}

function PeriodButtons({
  value,
  onChange,
}: {
  value: PeriodKey;
  onChange: (value: PeriodKey) => void;
}) {
  return (
    <View style={styles.periods}>
      {PERIODS.map((period) => (
        <Pressable
          key={period.key}
          style={[styles.pill, value === period.key && styles.pillActive]}
          onPress={() => onChange(period.key)}>
          <Text style={styles.pillText}>{period.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function CompareSummary({
  a,
  b,
}: {
  a: ReturnType<typeof stats>;
  b: ReturnType<typeof stats>;
}) {
  const rows: [string, number, number, (n: number) => string][] = [
    ['Total Spent', a.total, b.total, money],
    ['Transactions', a.count, b.count, String],
    ['Avg / Transaction', a.average, b.average, money],
    ['Largest Expense', a.largest, b.largest, money],
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Summary Comparison</Text>
      <View style={styles.compareHead}>
        <Text style={styles.compareMetric}>Metric</Text>
        <Text style={styles.compareA}>Period A</Text>
        <Text style={styles.compareB}>Period B</Text>
        <Text style={styles.change}>Change</Text>
      </View>
      {rows.map(([label, av, bv, format]) => {
        const delta = bv ? (av - bv) / bv : av ? 1 : 0;
        return (
          <View key={label} style={styles.compareRow}>
            <Text style={styles.compareMetric}>{label}</Text>
            <Text style={styles.compareA}>{format(av)}</Text>
            <Text style={styles.compareB}>{format(bv)}</Text>
            <Text style={[styles.change, delta > 0 ? styles.negative : styles.positive]}>
              {delta > 0 ? '↑' : '↓'} {Math.abs(delta * 100).toFixed(1)}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', gap: 9 },
  segment: {
    flex: 1,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#1e2b43',
    borderRadius: 9,
    overflow: 'hidden',
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabActive: { backgroundColor: '#5ca9ff' },
  tabText: { color: '#e6edf7', fontWeight: '700' },
  export: {
    borderWidth: 1,
    borderColor: '#263650',
    borderRadius: 9,
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  exportText: { color: '#e6edf7', fontWeight: '700' },
  card: {
    backgroundColor: '#0d1629',
    borderWidth: 1,
    borderColor: '#1c2941',
    borderRadius: 12,
    padding: 15,
    gap: 12,
  },
  cardTitle: { color: '#f3f6fb', fontWeight: '800', fontSize: 14 },
  periodLabel: { color: '#8e9bb0', fontSize: 11, fontWeight: '800' },
  periods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1,
    borderColor: '#26344d',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillActive: { backgroundColor: '#5ca9ff', borderColor: '#5ca9ff' },
  pillText: { color: '#e7edf7', fontSize: 11, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#223049', marginVertical: 7 },
  metric: { flexDirection: 'row', alignItems: 'center', minHeight: 34 },
  metricLabel: { color: '#a1aec2', flex: 1 },
  metricValue: { color: '#f2f6fb', fontWeight: '800' },
  count: { color: '#8996aa', marginRight: 10 },
  barRow: { flexDirection: 'row', alignItems: 'center', minHeight: 50 },
  barLabel: { width: 112, textAlign: 'right', paddingRight: 12, color: '#dce4ef', fontSize: 11 },
  barArea: { flex: 1, gap: 4 },
  bar: { height: 15, borderRadius: 4, backgroundColor: '#559be8' },
  barB: { backgroundColor: '#dc9410' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  legendA: { color: '#5ca9ff', fontSize: 11 },
  legendB: { color: '#e9a113', fontSize: 11 },
  empty: { color: '#7d8ba6', textAlign: 'center', padding: 15 },
  compareHead: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#243149',
    paddingVertical: 9,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#19263d',
    paddingVertical: 12,
  },
  compareMetric: { flex: 1.4, color: '#9aa7bc', fontSize: 10 },
  compareA: { flex: 1, textAlign: 'right', color: '#69afff', fontSize: 10, fontWeight: '700' },
  compareB: { flex: 1, textAlign: 'right', color: '#e7a522', fontSize: 10 },
  change: { flex: 0.9, textAlign: 'right', color: '#8c99ad', fontSize: 9 },
  positive: { color: '#28ca83' },
  negative: { color: '#f05c70' },
});
