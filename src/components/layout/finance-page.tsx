import { useRefreshFinance } from '@/components/providers/finance-data-provider';
import { type PropsWithChildren, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFinanceStore } from '@/store/finance-store';
import { AppSidebar } from '@/components/navigation/app-sidebar';

export function FinancePage({
  children,
  title,
  subtitle,
  scroll = true,
  showSync = true,
}: PropsWithChildren<{
  title: string;
  subtitle: string;
  scroll?: boolean;
  showSync?: boolean;
}>) {
  const refresh = useRefreshFinance();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isLoading, lastUpdatedAt, syncError } = useFinanceStore();
  const updatedLabel = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Open navigation"
          style={styles.menuButton}
          onPress={() => setSidebarOpen(true)}
        >
          <Text style={styles.menuText}>☰</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {showSync && (
            <Text style={[styles.sync, syncError && styles.syncError]}>
              {isLoading
                ? 'Syncing live data…'
                : (syncError ??
                  (updatedLabel
                    ? `Updated ${updatedLabel}`
                    : 'Waiting for first sync'))}
            </Text>
          )}
          {showSync && syncError ? (
            <Pressable
              accessibilityRole="button"
              onPress={refresh}
              style={{ paddingVertical: 12 }}
            >
              <Text style={{ color: '#75b6ff' }}>Retry sync</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={refresh}
                tintColor="#55a6ff"
              />
            }
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </View>
      <AppSidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </SafeAreaView>
  );
}

export const financePageStyles = StyleSheet.create({
  card: {
    backgroundColor: '#0d1629',
    borderWidth: 1,
    borderColor: '#17243b',
    borderRadius: 12,
    padding: 14,
  },
  cardTitle: {
    color: '#f4f7fb',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#f4f7fb',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: '#a1afc3',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 7,
  },
  row: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#17243b',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowTitle: { color: '#e7edf7', fontSize: 15, fontWeight: '700', flex: 1 },
  rowValue: { color: '#f4f7fb', fontSize: 15, fontWeight: '700' },
  rowMeta: { color: '#a1afc3', fontSize: 13, marginTop: 5 },
  primaryButton: {
    backgroundColor: '#55a6ff',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonText: { color: '#07111f', fontSize: 15, fontWeight: '800' },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#070d1a' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#17243b',
  },
  menuButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  menuText: { color: '#c6d0e0', fontSize: 20 },
  headerText: { flex: 1 },
  title: { color: '#f4f7fb', fontSize: 25, fontWeight: '800' },
  subtitle: { color: '#a1afc3', fontSize: 14, marginTop: 3 },
  sync: { color: '#19c983', fontSize: 12, marginTop: 7 },
  syncError: { color: '#f7b719' },
  content: { padding: 10, paddingBottom: 110, gap: 12 },
});
