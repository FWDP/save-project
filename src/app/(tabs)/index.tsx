import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MonthPicker } from '@/components/month-picker';
import { monthTransactions, totalsFor } from '@/lib/finance';
import { SaveDashboard } from '@/components/dashboard/save-dashboard';
import { AppSidebar } from '@/components/navigation/app-sidebar';
import { getAuthUser } from '@/lib/auth';
import { useFinanceStore } from '@/store/finance-store';

export default function DashboardScreen() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { budgets, isLoading, syncError, transactions, selectedMonth } =
    useFinanceStore();

  useEffect(() => {
    getAuthUser().then((user) => {
      if (!user) router.replace('/onboarding');
    });
  }, [router]);

  const monthly = useMemo(
    () => monthTransactions(transactions, selectedMonth),
    [transactions, selectedMonth],
  );
  const totals = useMemo(() => totalsFor(monthly), [monthly]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Open navigation"
          style={styles.iconButton}
          onPress={() => setSidebarOpen(true)}
        >
          <Text style={styles.iconText}>☰</Text>
        </Pressable>
        <Text
          style={{ flex: 1, color: '#f4f7fb', fontSize: 18, fontWeight: '800' }}
        >
          SAVE · Personal
        </Text>
        <Pressable
          accessibilityLabel="Search transactions"
          style={{ padding: 12 }}
          onPress={() => router.push('/expenses')}
        >
          <Text style={{ color: '#75b6ff' }}>Search</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <MonthPicker />
        <SaveDashboard
          monthKey={selectedMonth}
          budgets={budgets.filter((b) => b.period === 'monthly')}
          transactions={monthly}
          totals={totals}
          loading={isLoading}
          syncMessage={syncError}
        />
      </ScrollView>

      <View style={styles.fabGroup}>
        <Pressable
          accessibilityLabel="Add transaction"
          style={styles.fab}
          onPress={() => router.push('/expense-add')}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      </View>
      <AppSidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#070d1a' },
  topBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#17243b',
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: '#c6d0e0', fontSize: 19 },
  modeSelector: {
    flex: 1,
    maxWidth: 205,
    height: 34,
    flexDirection: 'row',
    borderRadius: 18,
    backgroundColor: '#0d1629',
    padding: 3,
  },
  modeSelected: {
    flex: 1,
    borderRadius: 15,
    backgroundColor: '#172440',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeOption: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modeSelectedText: { color: '#f4f7fb', fontSize: 10, fontWeight: '700' },
  modeText: { color: '#65738c', fontSize: 10, fontWeight: '600' },
  plainButton: {
    width: 30,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plainIcon: { color: '#9aa8bd', fontSize: 18 },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 130 },
  fabGroup: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    gap: 10,
    alignItems: 'center',
  },
  secondaryFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111c31',
    borderWidth: 1,
    borderColor: '#263956',
  },
  secondaryFabText: { color: '#55a6ff', fontSize: 19 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#55a6ff',
    elevation: 8,
    shadowColor: '#55a6ff',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  fabText: {
    color: '#07111f',
    fontSize: 31,
    lineHeight: 33,
    fontWeight: '400',
  },
});
