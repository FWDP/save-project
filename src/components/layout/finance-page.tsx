import { type PropsWithChildren, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFinanceStore } from '@/store/finance-store';
import { AppSidebar } from '@/components/navigation/app-sidebar';

export function FinancePage({ children, title, subtitle }: PropsWithChildren<{ title: string; subtitle: string }>) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isLoading, lastUpdatedAt, syncError } = useFinanceStore();
  const updatedLabel = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Open navigation" style={styles.menuButton} onPress={() => setSidebarOpen(true)}>
          <Text style={styles.menuText}>☰</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <Text style={[styles.sync, syncError && styles.syncError]}>
            {isLoading ? 'Syncing live data…' : syncError ?? (updatedLabel ? `Updated ${updatedLabel}` : 'Waiting for first sync')}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      <AppSidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </SafeAreaView>
  );
}

export const financePageStyles = StyleSheet.create({
  card: { backgroundColor: '#0d1629', borderWidth: 1, borderColor: '#17243b', borderRadius: 12, padding: 14 },
  cardTitle: { color: '#f4f7fb', fontSize: 14, fontWeight: '700', marginBottom: 12 },
  emptyTitle: { color: '#f4f7fb', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: '#7d8ba6', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7 },
  row: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#17243b' },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowTitle: { color: '#e7edf7', fontSize: 12, fontWeight: '700', flex: 1 },
  rowValue: { color: '#f4f7fb', fontSize: 12, fontWeight: '700' },
  rowMeta: { color: '#7d8ba6', fontSize: 10, marginTop: 5 },
  primaryButton: { backgroundColor: '#55a6ff', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#07111f', fontSize: 13, fontWeight: '800' },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#070d1a' },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 10, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#17243b' },
  menuButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  menuText: { color: '#c6d0e0', fontSize: 20 },
  headerText: { flex: 1 },
  title: { color: '#f4f7fb', fontSize: 25, fontWeight: '800' },
  subtitle: { color: '#7d8ba6', fontSize: 11, marginTop: 3 },
  sync: { color: '#19c983', fontSize: 9, marginTop: 7 },
  syncError: { color: '#f7b719' },
  content: { padding: 10, paddingBottom: 110, gap: 12 },
});
