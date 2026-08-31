import { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { ApiBudget, ApiTransaction } from '@/lib/api';

type DashboardTotals = {
  income: number;
  expenses: number;
  balance: number;
};

type SaveDashboardProps = {
  transactions: ApiTransaction[];
  budgets: ApiBudget[];
  totals: DashboardTotals;
  loading: boolean;
  syncMessage: string | null;
};

const palette = {
  background: '#070d1a',
  surface: '#0d1629',
  surfaceRaised: '#111c31',
  border: '#17243b',
  text: '#f4f7fb',
  muted: '#7d8ba6',
  blue: '#55a6ff',
  blueDim: '#1c3458',
  green: '#19c983',
  red: '#ff4f6d',
  purple: '#995cff',
  cyan: '#12c1d6',
  orange: '#ff7417',
  pink: '#e63d99',
};

const categoryColors = [palette.cyan, palette.orange, '#ff9a22', palette.pink, '#19a9dc'];

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatPeso(value: number) {
  return peso.format(value).replace('PHP', '₱');
}

function getDashboardMonth(transactions: ApiTransaction[]) {
  const validDates = transactions
    .map((transaction) => new Date(`${transaction.date}T00:00:00`))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  return validDates[0] ?? new Date();
}

function MetricCard({
  label,
  value,
  accent,
  icon,
  note,
}: {
  label: string;
  value: string;
  accent: string;
  icon: string;
  note: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricTopRow}>
        <View style={styles.metricTextWrap}>
          <Text style={styles.metricLabel}>{label}</Text>
          <Text numberOfLines={1} style={[styles.metricValue, { color: accent }]}>
            {value}
          </Text>
        </View>
        <View style={[styles.metricIcon, { backgroundColor: `${accent}18` }]}>
          <Text style={[styles.metricIconText, { color: accent }]}>{icon}</Text>
        </View>
      </View>
      <Text numberOfLines={1} style={styles.metricNote}>{note}</Text>
    </View>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function SaveDashboard({ budgets, transactions, totals, loading, syncMessage }: SaveDashboardProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const month = useMemo(() => getDashboardMonth(transactions), [transactions]);
  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const currentMonthStr = month.toISOString().slice(0, 7);

  const expenses = useMemo(
    () => transactions.filter((transaction) => transaction.type === 'expense'),
    [transactions],
  );

  const spendingByCategory = useMemo(() => {
    const values = new Map<string, number>();
    for (const transaction of expenses) {
      if (transaction.date.startsWith(currentMonthStr)) {
        values.set(transaction.category, (values.get(transaction.category) ?? 0) + transaction.amount);
      }
    }
    return [...values.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [currentMonthStr, expenses]);

  const categorySpentMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const transaction of expenses) {
      if (transaction.date.startsWith(currentMonthStr)) {
        map.set(transaction.category, (map.get(transaction.category) ?? 0) + transaction.amount);
      }
    }
    return map;
  }, [currentMonthStr, expenses]);

  const dailySpending = useMemo(() => {
    const values = new Map<string, number>();
    for (const transaction of expenses) {
      if (transaction.date.startsWith(currentMonthStr)) {
        values.set(transaction.date, (values.get(transaction.date) ?? 0) + transaction.amount);
      }
    }
    return [...values.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-7);
  }, [currentMonthStr, expenses]);

  const topMerchants = useMemo(
    () =>
      [...expenses]
        .filter((t) => t.date.startsWith(currentMonthStr))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
    [currentMonthStr, expenses],
  );

  const spentDates = useMemo(
    () =>
      new Set(
        expenses
          .filter((t) => t.date.startsWith(currentMonthStr))
          .map((transaction) => Number(transaction.date.slice(-2))),
      ),
    [currentMonthStr, expenses],
  );

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const calendarCells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const selectedDay = Math.max(...spentDates, 1);
  const budgetTotal = budgets.reduce((sum, budget) => sum + budget.limit, 0);
  const spendPercent = budgetTotal ? Math.min((totals.expenses / budgetTotal) * 100, 100) : 0;
  const maxCategorySpend = Math.max(...spendingByCategory.map(([, amount]) => amount), 1);
  const maxDailySpend = Math.max(...dailySpending.map(([, amount]) => amount), 1);
  const highestMerchantSpend = Math.max(...topMerchants.map((transaction) => transaction.amount), 1);

  return (
    <View style={styles.dashboard}>
      <View style={styles.pageHeading}>
        <Text style={styles.pageTitle}>Dashboard</Text>
        <Text style={styles.pageSubtitle}>Personal Expenses — {monthLabel}</Text>
      </View>

      <View style={[styles.metricGrid, isWide && styles.metricGridWide]}>
        <MetricCard label="Total income" value={formatPeso(totals.income)} accent={palette.text} icon="↗" note="Money received" />
        <MetricCard label="Total expenses" value={formatPeso(totals.expenses)} accent={palette.text} icon="↘" note="Money spent" />
        <MetricCard label="Net balance" value={formatPeso(totals.balance)} accent={palette.green} icon="▣" note="Surplus this month" />
        <MetricCard label="Transactions" value={String(transactions.length)} accent={palette.text} icon="⌁" note={loading ? 'Refreshing…' : syncMessage ?? 'Records this month'} />
      </View>

      <View style={styles.pacingCard}>
        <View style={styles.pacingHeader}>
          <View style={styles.pacingIcon}><Text style={styles.pacingIconText}>⌁</Text></View>
          <View style={styles.pacingText}>
            <Text style={styles.pacingTitle}>Monthly spending pace</Text>
            <Text style={styles.pacingMeta}>{formatPeso(totals.expenses)} spent · {Math.round(spendPercent)}% of budget</Text>
          </View>
        </View>
        <View style={styles.insightBubble}>
          <Text style={styles.insightText}>
            {spendPercent <= 75 ? 'On pace to stay within budget' : 'Spending is approaching the monthly limit'}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${spendPercent}%` }]} />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabel}>{formatPeso(totals.expenses)} spent</Text>
          <Text style={styles.progressLabel}>Budget: {formatPeso(budgetTotal)}</Text>
        </View>
      </View>

      <View style={[styles.sectionColumns, isWide && styles.sectionColumnsWide]}>
        <View style={styles.sectionColumn}>
          <SectionCard title={`Monthly Spending — ${monthLabel}`}>
            <View style={styles.weekHeader}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarCells.map((day, index) => (
                <View
                  key={`${day ?? 'blank'}-${index}`}
                  style={[
                    styles.calendarDay,
                    day != null && spentDates.has(day) && styles.calendarDaySpent,
                    day === selectedDay && styles.calendarDaySelected,
                  ]}>
                  <Text style={[styles.calendarDayText, day === selectedDay && styles.calendarDayTextSelected]}>
                    {day ?? ''}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.legendRow}>
              <Text style={styles.legendText}>Less</Text>
              {[0.25, 0.45, 0.65, 0.85, 1].map((opacity) => (
                <View key={opacity} style={[styles.legendSquare, { opacity }]} />
              ))}
              <Text style={styles.legendText}>More</Text>
            </View>
          </SectionCard>
        </View>

        <View style={styles.sectionColumn}>
          <SectionCard title="Spending by Category">
            <View style={styles.categoryChart}>
              {(spendingByCategory.length ? spendingByCategory : [['No spending', 0] as [string, number]]).map(
                ([category, amount], index) => (
                  <View key={category} style={styles.categoryRow}>
                    <Text numberOfLines={1} style={styles.categoryLabel}>{category}</Text>
                    <View style={styles.categoryTrack}>
                      <View
                        style={[
                          styles.categoryBar,
                          {
                            width: `${Math.max((amount / maxCategorySpend) * 100, amount ? 8 : 0)}%`,
                            backgroundColor: categoryColors[index % categoryColors.length],
                          },
                        ]}
                      />
                    </View>
                  </View>
                ),
              )}
            </View>
          </SectionCard>
        </View>
      </View>

      <SectionCard title="Daily Spending">
        <View style={styles.dailyChart}>
          {(dailySpending.length ? dailySpending : [['', 0] as [string, number]]).map(([date, amount]) => (
            <View key={date || 'empty'} style={styles.dailyBarSlot}>
              <View style={styles.dailyBarArea}>
                <View style={[styles.dailyBar, { height: `${Math.max((amount / maxDailySpend) * 100, amount ? 6 : 0)}%` }]} />
              </View>
              <Text style={styles.dailyLabel}>{date ? new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No data'}</Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="Top Merchants">
        {topMerchants.length ? topMerchants.map((transaction) => (
          <View key={transaction.id} style={styles.merchantRow}>
            <View style={styles.merchantHeading}>
              <Text numberOfLines={1} style={styles.merchantName}>{transaction.description}</Text>
              <Text style={styles.merchantAmount}>{formatPeso(transaction.amount)} · 1×</Text>
            </View>
            <View style={styles.merchantTrack}>
              <View style={[styles.merchantFill, { width: `${Math.max((transaction.amount / highestMerchantSpend) * 100, 5)}%` }]} />
            </View>
          </View>
        )) : <Text style={styles.emptyText}>Transactions will appear here.</Text>}
      </SectionCard>

      <SectionCard title="Budget Progress">
        {budgets.map((budget, index) => {
          const used = categorySpentMap.has(budget.category)
            ? (categorySpentMap.get(budget.category) ?? 0)
            : budget.spent;
          const percent = Math.min((used / budget.limit) * 100, 100);
          const color = categoryColors[index % categoryColors.length];
          return (
            <View key={budget.id} style={styles.budgetRow}>
              <View style={styles.budgetHeading}>
                <View style={styles.budgetNameWrap}>
                  <View style={[styles.budgetDot, { backgroundColor: color }]} />
                  <Text style={styles.budgetName}>{budget.category}</Text>
                </View>
                <Text style={styles.budgetAmount}>{formatPeso(used)} / {formatPeso(budget.limit)}</Text>
              </View>
              <View style={styles.budgetMeta}>
                <Text style={styles.budgetRemaining}>{Math.max(100 - Math.round(percent), 0)}% remaining</Text>
                <Text style={styles.budgetPercent}>{Math.round(percent)}%</Text>
              </View>
              <View style={styles.budgetTrack}>
                <View style={[styles.budgetFill, { width: `${percent}%`, backgroundColor: color }]} />
              </View>
            </View>
          );
        })}
        {!budgets.length ? <Text style={styles.emptyText}>No budget data is available yet.</Text> : null}
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: { gap: 14, width: '100%', maxWidth: 980, alignSelf: 'center' },
  pageHeading: { gap: 3, marginBottom: 2 },
  pageTitle: { color: palette.text, fontSize: 26, lineHeight: 31, fontWeight: '800' },
  pageSubtitle: { color: palette.muted, fontSize: 12 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricGridWide: { gap: 12 },
  metricCard: { width: '48%', flexGrow: 1, minWidth: 145, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 11, padding: 13 },
  metricTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  metricTextWrap: { flex: 1, minWidth: 0 },
  metricLabel: { color: palette.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.35 },
  metricValue: { fontSize: 22, lineHeight: 29, fontWeight: '800', marginTop: 3 },
  metricIcon: { width: 31, height: 31, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  metricIconText: { fontSize: 17, fontWeight: '700' },
  metricNote: { color: palette.muted, fontSize: 10, marginTop: 5 },
  pacingCard: { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderLeftColor: palette.blue, borderLeftWidth: 3, borderRadius: 11, padding: 13 },
  pacingHeader: { flexDirection: 'row', alignItems: 'center' },
  pacingIcon: { width: 31, height: 31, borderRadius: 8, backgroundColor: palette.blueDim, alignItems: 'center', justifyContent: 'center' },
  pacingIconText: { color: palette.blue, fontWeight: '800' },
  pacingText: { marginLeft: 10, flex: 1 },
  pacingTitle: { color: palette.text, fontSize: 13, fontWeight: '700' },
  pacingMeta: { color: palette.muted, fontSize: 10, marginTop: 2 },
  insightBubble: { alignSelf: 'flex-start', marginTop: 12, backgroundColor: '#123357', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  insightText: { color: '#79bcff', fontSize: 10, fontWeight: '600' },
  progressTrack: { height: 6, backgroundColor: '#16223a', borderRadius: 10, overflow: 'hidden', marginTop: 14 },
  progressFill: { height: '100%', backgroundColor: palette.blue, borderRadius: 10 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressLabel: { color: palette.muted, fontSize: 9 },
  sectionColumns: { gap: 14 },
  sectionColumnsWide: { flexDirection: 'row', alignItems: 'stretch' },
  sectionColumn: { flex: 1 },
  sectionCard: { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 11, padding: 13 },
  sectionTitle: { color: palette.text, fontSize: 13, fontWeight: '700', marginBottom: 16 },
  weekHeader: { flexDirection: 'row', marginBottom: 7 },
  weekday: { width: '14.285%', color: palette.muted, fontSize: 9, textAlign: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  calendarDay: { width: '14.285%', height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 5 },
  calendarDaySpent: { backgroundColor: '#182a47' },
  calendarDaySelected: { backgroundColor: palette.blue },
  calendarDayText: { color: '#66758f', fontSize: 9 },
  calendarDayTextSelected: { color: '#06101f', fontWeight: '800' },
  legendRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 14 },
  legendText: { color: palette.muted, fontSize: 8, marginHorizontal: 2 },
  legendSquare: { width: 8, height: 8, borderRadius: 2, backgroundColor: palette.blue },
  categoryChart: { gap: 13, paddingVertical: 4 },
  categoryRow: { flexDirection: 'row', alignItems: 'center' },
  categoryLabel: { width: 78, color: palette.muted, fontSize: 10, textAlign: 'right', marginRight: 10 },
  categoryTrack: { height: 19, flex: 1 },
  categoryBar: { height: '100%', borderRadius: 3 },
  dailyChart: { height: 175, flexDirection: 'row', alignItems: 'flex-end', gap: 9, borderBottomColor: palette.border, borderBottomWidth: 1 },
  dailyBarSlot: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  dailyBarArea: { flex: 1, width: '70%', justifyContent: 'flex-end' },
  dailyBar: { width: '100%', backgroundColor: '#4f88cf', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  dailyLabel: { height: 25, color: palette.muted, fontSize: 8, paddingTop: 6 },
  merchantRow: { marginBottom: 12 },
  merchantHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 5 },
  merchantName: { color: '#dce5f4', fontSize: 10, fontWeight: '600', flex: 1 },
  merchantAmount: { color: '#dce5f4', fontSize: 10, fontWeight: '700' },
  merchantTrack: { height: 4, backgroundColor: '#16223a', borderRadius: 5, overflow: 'hidden' },
  merchantFill: { height: '100%', backgroundColor: palette.blue, borderRadius: 5 },
  emptyText: { color: palette.muted, fontSize: 11 },
  budgetRow: { marginBottom: 16 },
  budgetHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  budgetNameWrap: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  budgetDot: { width: 7, height: 7, borderRadius: 4 },
  budgetName: { color: '#e5ecf7', fontSize: 11, fontWeight: '600' },
  budgetAmount: { color: '#adb9cc', fontSize: 9 },
  budgetMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 5 },
  budgetRemaining: { color: palette.muted, fontSize: 8 },
  budgetPercent: { color: palette.muted, fontSize: 8 },
  budgetTrack: { height: 4, borderRadius: 5, backgroundColor: '#16223a', overflow: 'hidden' },
  budgetFill: { height: '100%', borderRadius: 5 },
});
