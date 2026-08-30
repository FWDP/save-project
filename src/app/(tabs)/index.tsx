import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SaveDashboard } from '@/components/dashboard/save-dashboard';
import { AppSidebar } from '@/components/navigation/app-sidebar';
import { getAuthUser } from '@/lib/auth';
import { useFinanceStore } from '@/store/finance-store';

export default function DashboardScreen() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { budgets, isLoading, syncError, transactions } = useFinanceStore();

  useEffect(() => {
    getAuthUser().then((user) => {
      if (!user) router.replace('/onboarding');
    });
  }, [router]);

  const totals = useMemo(() => {
    const income = transactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
    const expenses = transactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
    return { income, expenses, balance: income - expenses };
  }, [transactions]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Open navigation" style={styles.iconButton} onPress={() => setSidebarOpen(true)}><Text style={styles.iconText}>☰</Text></Pressable>
        <View style={styles.modeSelector}>
          <View style={styles.modeSelected}><Text style={styles.modeSelectedText}>♙ Personal</Text></View>
          <View style={styles.modeOption}><Text style={styles.modeText}>♧ Business</Text></View>
        </View>
        <Pressable accessibilityLabel="Search" style={styles.plainButton}><Text style={styles.plainIcon}>⌕</Text></Pressable>
        <Pressable accessibilityLabel="Appearance" style={styles.plainButton}><Text style={styles.plainIcon}>◔</Text></Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SaveDashboard budgets={budgets} transactions={transactions} totals={totals} loading={isLoading} syncMessage={syncError} />
      </ScrollView>

      <View style={styles.fabGroup}>
        <Pressable accessibilityLabel="Scan receipt" style={styles.secondaryFab} onPress={() => router.push('/receipt')}>
          <Text style={styles.secondaryFabText}>◎</Text>
        </Pressable>
        <Pressable accessibilityLabel="View expenses" style={styles.fab} onPress={() => router.push('/expenses')}>
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      </View>
      <AppSidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#070d1a' },
  topBar: { height: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: '#17243b' },
  iconButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: '#c6d0e0', fontSize: 19 },
  modeSelector: { flex: 1, maxWidth: 205, height: 34, flexDirection: 'row', borderRadius: 18, backgroundColor: '#0d1629', padding: 3 },
  modeSelected: { flex: 1, borderRadius: 15, backgroundColor: '#172440', justifyContent: 'center', alignItems: 'center' },
  modeOption: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modeSelectedText: { color: '#f4f7fb', fontSize: 10, fontWeight: '700' },
  modeText: { color: '#65738c', fontSize: 10, fontWeight: '600' },
  plainButton: { width: 30, height: 34, alignItems: 'center', justifyContent: 'center' },
  plainIcon: { color: '#9aa8bd', fontSize: 18 },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 130 },
  fabGroup: { position: 'absolute', right: 16, bottom: 20, gap: 10, alignItems: 'center' },
  secondaryFab: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111c31', borderWidth: 1, borderColor: '#263956' },
  secondaryFabText: { color: '#55a6ff', fontSize: 19 },
  fab: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#55a6ff', elevation: 8, shadowColor: '#55a6ff', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  fabText: { color: '#07111f', fontSize: 31, lineHeight: 33, fontWeight: '400' },
});
