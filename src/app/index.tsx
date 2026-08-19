import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createTransaction, fetchTransactions, type ApiTransaction } from '@/lib/api';
import { getAuthUser } from '@/lib/auth';
import { loadCachedTransactions, saveTransactions } from '@/lib/sqlite';
import { useFinanceStore } from '@/store/finance-store';

type ScreenKey = 'dashboard' | 'transactions' | 'reports' | 'budgets' | 'settings';

type FormState = {
  description: string;
  category: string;
  amount: string;
  type: 'income' | 'expense';
  date: string;
};

const sampleTransactions: ApiTransaction[] = [
  {
    id: 'txn_local_1',
    userId: 'usr_2',
    type: 'expense',
    amount: 245.8,
    category: 'Food & Dining',
    description: 'Groceries',
    date: '2026-08-19',
    status: 'approved',
  },
  {
    id: 'txn_local_2',
    userId: 'usr_2',
    type: 'income',
    amount: 3200,
    category: 'Salary',
    description: 'Monthly salary',
    date: '2026-08-01',
    status: 'approved',
  },
  {
    id: 'txn_local_3',
    userId: 'usr_2',
    type: 'expense',
    amount: 89.2,
    category: 'Transport',
    description: 'Fuel refill',
    date: '2026-08-17',
    status: 'pending',
  },
];

const navItems: Array<{ key: ScreenKey; label: string; icon: string }> = [
  { key: 'dashboard', label: 'Dashboard', icon: '◉' },
  { key: 'transactions', label: 'Transactions', icon: '▣' },
  { key: 'reports', label: 'Reports', icon: '◫' },
  { key: 'budgets', label: 'Budgets', icon: '◌' },
  { key: 'settings', label: 'Settings', icon: '⚙' },
];

const categoryColors: Record<string, string> = {
  'Food & Dining': '#7dd3fc',
  Transport: '#a78bfa',
  Shopping: '#f9a8d4',
  Salary: '#6ee7b7',
  Utilities: '#fbbf24',
  Entertainment: '#fb7185',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

export default function HomeScreen() {
  const router = useRouter();
  const { transactions, setTransactions } = useFinanceStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ScreenKey>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [displayName, setDisplayName] = useState('SAVE');
  const [form, setForm] = useState<FormState>({
    description: '',
    category: 'Food & Dining',
    amount: '',
    type: 'expense',
    date: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    getAuthUser().then((user) => {
      if (!user) {
        router.replace('/onboarding');
        return;
      }

      setDisplayName(user.name.split(' ')[0] ?? 'SAVE');
    });

    const cached = loadCachedTransactions();
    if (cached.length > 0) {
      setTransactions(cached);
      setLoading(false);
    } else {
      setTransactions(sampleTransactions);
      saveTransactions(sampleTransactions);
      setLoading(false);
    }

    fetchTransactions()
      .then((data) => {
        if (data.length > 0) {
          setTransactions(data);
          saveTransactions(data);
          setError(null);
        }
      })
      .catch(() => {
        const fallback = loadCachedTransactions();
        if (fallback.length > 0) {
          setTransactions(fallback);
        } else {
          setTransactions(sampleTransactions);
          saveTransactions(sampleTransactions);
        }
        setError('Using offline data');
      })
      .finally(() => setLoading(false));
  }, [setTransactions]);

  const totals = useMemo(() => {
    const income = transactions
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0);
    const expenses = transactions
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0);
    const balance = income - expenses;

    return { income, expenses, balance };
  }, [transactions]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();

    transactions.forEach((item) => {
      if (item.type === 'expense') {
        map.set(item.category, (map.get(item.category) ?? 0) + item.amount);
      }
    });

    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [transactions]);

  const visibleTransactions = useMemo(() => transactions.slice(0, 6), [transactions]);

  const saveCurrentTransaction = async () => {
    const amountValue = Number(form.amount);
    if (!form.description.trim() || Number.isNaN(amountValue) || amountValue <= 0) {
      setError('Enter a valid description and amount.');
      return;
    }

    const record: ApiTransaction = {
      id: `txn_${Date.now()}`,
      userId: 'usr_2',
      type: form.type,
      amount: amountValue,
      category: form.category,
      description: form.description.trim(),
      date: form.date,
      status: 'approved',
    };

    let nextTransactions = [record, ...transactions];

    try {
      const created = await createTransaction({
        userId: record.userId,
        type: record.type,
        amount: record.amount,
        category: record.category,
        description: record.description,
        date: record.date,
        status: record.status,
      });
      nextTransactions = [created, ...transactions];
      setError(null);
    } catch {
      setError('Saved locally. Sync will retry later.');
    }

    setTransactions(nextTransactions);
    saveTransactions(nextTransactions);
    setForm({
      description: '',
      category: 'Food & Dining',
      amount: '',
      type: 'expense',
      date: new Date().toISOString().slice(0, 10),
    });
    setIsAddOpen(false);
  };

  const renderDashboard = () => (
    <View style={styles.contentStack}>
      <View style={styles.cardGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.cardLabel}>Net balance</Text>
          <Text style={styles.cardValue}>{formatCurrency(totals.balance)}</Text>
          <Text style={styles.cardNote}>{loading ? 'Loading...' : error ?? 'Updated just now'}</Text>
        </View>
        <View style={styles.miniCard}>
          <Text style={styles.cardLabel}>Income</Text>
          <Text style={styles.miniValue}>{formatCurrency(totals.income)}</Text>
        </View>
        <View style={styles.miniCard}>
          <Text style={styles.cardLabel}>Expenses</Text>
          <Text style={styles.miniValue}>{formatCurrency(totals.expenses)}</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Spending overview</Text>
          <Text style={styles.sectionBadge}>This month</Text>
        </View>

        <View style={styles.chartWrap}>
          {categoryBreakdown.map(([label, value], index) => {
            const maxValue = Math.max(...categoryBreakdown.map(([, amount]) => amount), 1);
            const height = (value / maxValue) * 100;

            return (
              <View key={label} style={styles.barItem}>
                <View style={styles.barColumn}>
                  <View style={[styles.barFill, { height: `${height}%`, backgroundColor: Object.values(categoryColors)[index % Object.values(categoryColors).length] }]} />
                </View>
                <Text style={styles.barLabel}>{label}</Text>
                <Text style={styles.barValue}>{formatCurrency(value)}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          <Text style={styles.sectionMeta}>{transactions.length} items</Text>
        </View>

        {visibleTransactions.map((item) => (
          <View key={item.id} style={styles.transactionRow}>
            <View style={[styles.transactionIcon, { backgroundColor: categoryColors[item.category] ?? '#7dd3fc' }]}>
              <Text style={styles.transactionIconText}>{item.type === 'income' ? '+' : '-'}</Text>
            </View>
            <View style={styles.transactionMetaWrap}>
              <Text style={styles.transactionTitle}>{item.description}</Text>
              <Text style={styles.transactionMeta}>{item.category}</Text>
            </View>
            <Text style={[styles.transactionAmount, item.type === 'income' ? styles.income : styles.expense]}>
              {item.type === 'income' ? '+' : '-'}
              {formatCurrency(item.amount)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderTransactions = () => (
    <View style={styles.contentStack}>
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All transactions</Text>
          <Text style={styles.sectionBadge}>Live</Text>
        </View>

        {transactions.map((item) => (
          <View key={item.id} style={styles.listRow}>
            <View>
              <Text style={styles.listTitle}>{item.description}</Text>
              <Text style={styles.listMeta}>{item.date} • {item.category}</Text>
            </View>
            <Text style={[styles.transactionAmount, item.type === 'income' ? styles.income : styles.expense]}>
              {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderReports = () => (
    <View style={styles.contentStack}>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Performance</Text>
        <View style={styles.reportRow}>
          <Text style={styles.reportLabel}>Monthly budget</Text>
          <Text style={styles.reportValue}>82%</Text>
        </View>
        <View style={styles.reportRow}>
          <Text style={styles.reportLabel}>Savings rate</Text>
          <Text style={styles.reportValue}>29%</Text>
        </View>
        <View style={styles.reportRow}>
          <Text style={styles.reportLabel}>Recurring spend</Text>
          <Text style={styles.reportValue}>{formatCurrency(totals.expenses * 0.42)}</Text>
        </View>
      </View>
    </View>
  );

  const renderBudgets = () => (
    <View style={styles.contentStack}>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Budget tracker</Text>
        {[
          ['Housing', 1800, 2100],
          ['Food', 680, 900],
          ['Travel', 420, 650],
          ['Shopping', 360, 500],
        ].map(([label, used, limit]) => (
          <View key={label} style={styles.budgetItem}>
            <View style={styles.budgetHeader}>
              <Text style={styles.budgetLabel}>{label}</Text>
              <Text style={styles.budgetValue}>{formatCurrency(Number(used))}/{formatCurrency(Number(limit))}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min((Number(used) / Number(limit)) * 100, 100)}%` },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const renderSettings = () => (
    <View style={styles.contentStack}>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Biometric lock</Text>
          <Text style={styles.settingValue}>On</Text>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Auto-sync</Text>
          <Text style={styles.settingValue}>Enabled</Text>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Alerts</Text>
          <Text style={styles.settingValue}>Daily</Text>
        </View>
      </View>
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'transactions':
        return renderTransactions();
      case 'reports':
        return renderReports();
      case 'budgets':
        return renderBudgets();
      case 'settings':
        return renderSettings();
      default:
        return renderDashboard();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.appShell}>
        <Pressable
          style={[styles.overlay, sidebarOpen ? styles.overlayVisible : styles.overlayHidden]}
          onPress={() => setSidebarOpen(false)}
        />

        <View style={[styles.sidebar, sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed]}>
          <Text style={styles.sidebarTitle}>SAVE</Text>
          {navItems.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.navItem, activeTab === item.key && styles.navItemActive]}
              onPress={() => {
                setActiveTab(item.key);
                setSidebarOpen(false);
              }}>
              <Text style={styles.navIcon}>{item.icon}</Text>
              <Text style={styles.navLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.mainPanel}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => setSidebarOpen((current) => !current)} style={styles.menuButton}>
              <Text style={styles.menuButtonText}>☰</Text>
            </Pressable>
            <View style={styles.headerTextWrap}>
              <Text style={styles.eyebrow}>Good morning</Text>
              <Text style={styles.title}>{displayName}</Text>
            </View>
            <Pressable style={styles.avatarButton} onPress={() => router.push('/onboarding')}>
              <Text style={styles.avatarText}>{displayName.slice(0, 1).toUpperCase()}</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
            {renderTabContent()}
          </ScrollView>
        </View>

        <View style={styles.fabGroup}>
          <Pressable style={styles.secondaryFab} onPress={() => router.push('/receipt')}>
            <Text style={styles.secondaryFabText}>◎</Text>
          </Pressable>
          <Pressable style={styles.fab} onPress={() => setIsAddOpen(true)}>
            <Text style={styles.fabText}>+</Text>
          </Pressable>
        </View>
      </View>

      <Modal transparent visible={isAddOpen} animationType="slide" onRequestClose={() => setIsAddOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add entry</Text>
              <Pressable onPress={() => setIsAddOpen(false)}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>

            <TextInput
              placeholder="Description"
              value={form.description}
              onChangeText={(value) => setForm((current) => ({ ...current, description: value }))}
              placeholderTextColor="#8aa3bf"
              style={styles.input}
            />

            <TextInput
              placeholder="Amount"
              keyboardType="decimal-pad"
              value={form.amount}
              onChangeText={(value) => setForm((current) => ({ ...current, amount: value }))}
              placeholderTextColor="#8aa3bf"
              style={styles.input}
            />

            <View style={styles.fieldRow}>
              <TextInput
                placeholder="Category"
                value={form.category}
                onChangeText={(value) => setForm((current) => ({ ...current, category: value }))}
                placeholderTextColor="#8aa3bf"
                style={[styles.input, styles.flexInput]}
              />
              <TextInput
                placeholder="Date"
                value={form.date}
                onChangeText={(value) => setForm((current) => ({ ...current, date: value }))}
                placeholderTextColor="#8aa3bf"
                style={[styles.input, styles.flexInput]}
              />
            </View>

            <View style={styles.typeRow}>
              {(['expense', 'income'] as const).map((type) => (
                <Pressable
                  key={type}
                  style={[styles.typeButton, form.type === type && styles.typeButtonActive]}
                  onPress={() => setForm((current) => ({ ...current, type }))}>
                  <Text style={styles.typeButtonText}>{type}</Text>
                </Pressable>
              ))}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable style={styles.saveButton} onPress={saveCurrentTransaction}>
              <Text style={styles.saveButtonText}>Save transaction</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  appShell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0f172a',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    zIndex: 1,
  },
  overlayVisible: {
    display: 'flex',
  },
  overlayHidden: {
    display: 'none',
  },
  sidebar: {
    width: 260,
    backgroundColor: '#111827',
    paddingTop: 28,
    paddingHorizontal: 16,
    borderRightWidth: 1,
    borderColor: '#1f2937',
    zIndex: 2,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  sidebarOpen: {
    transform: [{ translateX: 0 }],
  },
  sidebarClosed: {
    transform: [{ translateX: -280 }],
  },
  sidebarTitle: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 28,
    letterSpacing: 1.5,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  navItemActive: {
    backgroundColor: '#1d4ed8',
  },
  navIcon: {
    color: '#e2e8f0',
    fontSize: 18,
  },
  navLabel: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
  },
  mainPanel: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#121d2e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1d2940',
  },
  menuButtonText: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
  },
  headerTextWrap: {
    flex: 1,
    marginHorizontal: 12,
  },
  eyebrow: {
    fontSize: 12,
    color: '#8aa3bf',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 140,
  },
  contentStack: {
    gap: 18,
  },
  cardGrid: {
    gap: 12,
  },
  summaryCard: {
    backgroundColor: '#121d2e',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1d2940',
  },
  cardLabel: {
    color: '#8aa3bf',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  cardValue: {
    color: '#f8fafc',
    fontSize: 30,
    fontWeight: '700',
    marginTop: 8,
  },
  cardNote: {
    color: '#6ee7b7',
    marginTop: 10,
  },
  miniCard: {
    backgroundColor: '#121d2e',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1d2940',
  },
  miniValue: {
    color: '#f3f4f6',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
  },
  sectionCard: {
    backgroundColor: '#121d2e',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1d2940',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionBadge: {
    color: '#93c5fd',
    fontSize: 12,
    backgroundColor: '#172554',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  sectionMeta: {
    color: '#8aa3bf',
    fontSize: 12,
  },
  chartWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 14,
    minHeight: 150,
  },
  barItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  barColumn: {
    height: 100,
    width: '100%',
    justifyContent: 'flex-end',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 10,
  },
  barLabel: {
    color: '#cbd5e1',
    fontSize: 11,
    textAlign: 'center',
  },
  barValue: {
    color: '#e2e8f0',
    fontSize: 10,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1d2940',
  },
  transactionIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionIconText: {
    color: '#020817',
    fontWeight: '800',
    fontSize: 18,
  },
  transactionMetaWrap: {
    flex: 1,
  },
  transactionTitle: {
    color: '#f8fafc',
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionMeta: {
    color: '#8aa3bf',
    fontSize: 12,
  },
  transactionAmount: {
    fontWeight: '700',
    fontSize: 14,
  },
  income: {
    color: '#6ee7b7',
  },
  expense: {
    color: '#fca5a5',
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1d2940',
  },
  listTitle: {
    color: '#f8fafc',
    fontWeight: '600',
    marginBottom: 4,
  },
  listMeta: {
    color: '#8aa3bf',
    fontSize: 12,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1d2940',
  },
  reportLabel: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  reportValue: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 16,
  },
  budgetItem: {
    marginTop: 16,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  budgetLabel: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
  budgetValue: {
    color: '#8aa3bf',
    fontSize: 12,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#0f172a',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#60a5fa',
    borderRadius: 999,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1d2940',
  },
  settingLabel: {
    color: '#e2e8f0',
    fontSize: 15,
  },
  settingValue: {
    color: '#8aa3bf',
    fontSize: 14,
  },
  fabGroup: {
    position: 'absolute',
    right: 24,
    bottom: 28,
    alignItems: 'center',
    gap: 12,
    zIndex: 3,
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.4,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
  },
  fabText: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '300',
    lineHeight: 34,
  },
  secondaryFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1d2940',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryFabText: {
    color: '#7dd3fc',
    fontSize: 20,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.64)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
  },
  closeText: {
    color: '#93c5fd',
    fontSize: 14,
  },
  input: {
    backgroundColor: '#0f172a',
    borderColor: '#1d2940',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexInput: {
    flex: 1,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeButton: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1d2940',
    paddingVertical: 12,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
  typeButtonText: {
    textTransform: 'capitalize',
    color: '#f8fafc',
    fontWeight: '600',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
  },
  saveButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
