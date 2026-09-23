import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { File } from 'expo-file-system';
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import {
  FinancePage,
  financePageStyles as styles,
} from '@/components/layout/finance-page';
import {
  createBudget,
  createCategory,
  createTransaction,
  deleteTransaction,
  fetchBudgets,
  fetchCategories,
  fetchSavingsGoals,
  type ApiBudget,
  type ApiCategory,
  type ApiTransaction,
} from '@/lib/api';
import { clearAuthUser, getAuthUser, type AuthUser } from '@/lib/auth';
import { useFinanceStore } from '@/store/finance-store';
import { exportFile } from '@/lib/export-file';
import {
  csvRows,
  importPreview,
  transactionFingerprint,
  transactionsCsv,
  type ImportRow,
} from '@/lib/transfers';
import { validDate } from '@/lib/finance';
import { useRefreshFinance } from '@/components/providers/finance-data-provider';

export default function SettingsScreen() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<{
    rows: ImportRow[];
    duplicates: number;
    categories?: ApiCategory[];
    budgets?: ApiBudget[];
  } | null>(null);
  const { transactions, budgets, categories } = useFinanceStore();
  const refresh = useRefreshFinance();
  useEffect(() => {
    void getAuthUser().then(setUser);
  }, []);
  const perform = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await fn();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Operation failed. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  };
  const exportBackup = () =>
    perform(async () => {
      const goals = await fetchSavingsGoals();
      await exportFile(
        `save-records-${Date.now()}.json`,
        JSON.stringify(
          {
            version: 2,
            exportedAt: new Date().toISOString(),
            transactions,
            categories,
            budgets,
            savingsGoals: goals,
            receiptFilesIncluded: false,
          },
          null,
          2,
        ),
        'application/json',
      );
    });
  const choose = (json: boolean) =>
    perform(async () => {
      const selected = await File.pickFileAsync({
        mimeTypes: json
          ? 'application/json'
          : ['text/csv', 'text/plain', 'text/comma-separated-values'],
      });
      if (selected.canceled) return;
      const text = await selected.result.text();
      let rows: ImportRow[];
      let importedCategories: ApiCategory[] = [];
      let importedBudgets: ApiBudget[] = [];
      if (json) {
        const backup = JSON.parse(text);
        if (
          ![1, 2].includes(backup.version) ||
          !Array.isArray(backup.transactions)
        )
          throw new Error('Choose a supported SAVE records backup.');
        importedCategories = Array.isArray(backup.categories)
          ? backup.categories
          : [];
        importedBudgets = Array.isArray(backup.budgets) ? backup.budgets : [];
        if (
          importedCategories.some(
            (row) =>
              typeof row.name !== 'string' ||
              !row.name.trim() ||
              !['income', 'expense'].includes(row.type) ||
              !/^#[0-9a-f]{6}$/i.test(row.color),
          )
        )
          throw new Error('The backup has invalid categories.');
        if (
          importedBudgets.some(
            (row) =>
              typeof row.category !== 'string' ||
              !row.category.trim() ||
              !Number.isFinite(row.limit) ||
              row.limit <= 0 ||
              !['monthly', 'weekly'].includes(row.period),
          )
        )
          throw new Error('The backup has invalid budgets.');
        rows = backup.transactions.map((row: ApiTransaction) => {
          if (
            !validDate(row.date) ||
            !Number.isFinite(row.amount) ||
            row.amount <= 0 ||
            !['expense', 'income'].includes(row.type) ||
            typeof row.category !== 'string' ||
            typeof row.description !== 'string'
          )
            throw new Error(
              'The backup contains invalid transactions. Nothing was imported.',
            );
          return {
            date: row.date,
            type: row.type,
            amount: row.amount,
            category: row.category,
            description: row.description,
            merchant: row.merchant,
            tags: row.tags,
            recurring: row.recurring,
            customFields: row.customFields,
            status: 'approved',
          };
        });
      } else rows = csvRows(text);
      setPreview({
        ...importPreview(rows, useFinanceStore.getState().transactions),
        categories: importedCategories,
        budgets: importedBudgets,
      });
    });
  const importRows = () =>
    perform(async () => {
      if (!preview || !user) return;
      let imported = 0;
      const remaining = [...preview.rows];
      try {
        // Re-read before retrying a partially completed restore.
        const currentCategories = await fetchCategories();
        const currentBudgets = await fetchBudgets();
        for (const row of preview.categories ?? []) {
          if ((await getAuthUser())?.id !== user.id)
            throw new Error('Account changed.');
          if (
            currentCategories.some(
              (item) =>
                item.name.toLowerCase() === row.name.toLowerCase() &&
                item.type === row.type,
            )
          )
            continue;
          currentCategories.push(
            await createCategory({
              name: row.name,
              type: row.type,
              color: row.color,
            }),
          );
        }
        useFinanceStore.getState().setCategories(currentCategories);
        for (const row of preview.budgets ?? []) {
          if ((await getAuthUser())?.id !== user.id)
            throw new Error('Account changed.');
          if (
            currentBudgets.some(
              (item) =>
                item.category.toLowerCase() === row.category.toLowerCase() &&
                item.period === row.period,
            )
          )
            continue;
          currentBudgets.push(
            await createBudget({
              userId: user.id,
              category: row.category,
              limit: row.limit,
              period: row.period,
            }),
          );
        }
        useFinanceStore.getState().setBudgets(currentBudgets);
        for (const row of preview.rows) {
          if ((await getAuthUser())?.id !== user.id)
            throw new Error('Account changed.');
          const state = useFinanceStore.getState();
          if (
            !state.categories.some(
              (c) =>
                c.name.toLowerCase() === row.category.toLowerCase() &&
                c.type === row.type,
            )
          ) {
            const category = await createCategory({
              name: row.category,
              type: row.type,
              color: '#55a6ff',
            });
            state.setCategories([
              ...useFinanceStore.getState().categories,
              category,
            ]);
          }
          const clientMutationId = `import_${await digestStringAsync(CryptoDigestAlgorithm.SHA256, transactionFingerprint(row))}`;
          const created = await createTransaction({
            ...row,
            userId: user.id,
            clientMutationId,
          });
          state.setTransactions([
            ...useFinanceStore
              .getState()
              .transactions.filter((item) => item.id !== created.id),
            created,
          ]);
          imported++;
          remaining.shift();
        }
        setPreview(null);
        setMessage(`${imported} transactions imported.`);
      } catch {
        setPreview({ ...preview, rows: remaining });
        setMessage(
          `${imported} imported; ${remaining.length} remain. Retry to continue without duplicating completed rows.`,
        );
      }
    });
  return (
    <FinancePage title="Settings" subtitle="Account and financial records">
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <Text style={styles.rowTitle}>{user?.name}</Text>
        <Text style={styles.rowMeta}>{user?.email}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Currency</Text>
        <Text style={styles.rowTitle}>PHP · Philippine Peso</Text>
        <Text style={styles.rowMeta}>
          Personal finance amounts are recorded in PHP. Testnet vaults display
          XLM separately.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Export records</Text>
        <Button
          disabled={busy}
          label="Export transactions CSV"
          onPress={() =>
            perform(() =>
              exportFile(
                `save-transactions-${Date.now()}.csv`,
                transactionsCsv(transactions),
                'text/csv',
              ),
            )
          }
        />
        <Button
          disabled={busy}
          label="Export records backup"
          onPress={exportBackup}
        />
        <Text style={styles.rowMeta}>
          JSON includes transactions, categories, budgets and savings goal
          metadata. Receipt files remain on this device; this export does not
          contain wallet keys or transfer funds.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Import transactions</Text>
        <Button
          disabled={busy}
          label="Preview CSV import"
          onPress={() => choose(false)}
        />
        <Button
          disabled={busy}
          label="Preview backup restore"
          onPress={() => choose(true)}
        />
        <Text style={styles.rowMeta}>
          Review before importing. Matching records are skipped. Backup restore
          adds missing categories and budgets and preserves existing limits.
          Vault metadata is for reference only; it cannot restore funds or
          ledger proof.
        </Text>
      </View>
      {preview && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Import preview</Text>
          <Text style={styles.rowTitle}>
            {preview.rows.length} new transactions · {preview.duplicates}{' '}
            matching records skipped
          </Text>
          <Text style={styles.rowMeta}>
            {preview.categories?.length ?? 0} categories and{' '}
            {preview.budgets?.length ?? 0} budgets to check; existing entries
            are kept.
          </Text>
          {preview.rows.slice(0, 5).map((row, i) => (
            <Text key={i} style={styles.rowMeta}>
              {row.date} · {row.description} · ₱{row.amount}
            </Text>
          ))}
          <Button
            disabled={
              busy ||
              (!preview.rows.length &&
                !preview.categories?.length &&
                !preview.budgets?.length)
            }
            label={busy ? 'Importing…' : 'Confirm import'}
            onPress={importRows}
          />
          <Button
            disabled={busy}
            label="Cancel import"
            onPress={() => setPreview(null)}
          />
        </View>
      )}
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: '#e9bd69', lineHeight: 22 }}
        >
          {message}
        </Text>
      ) : null}
      <Button
        disabled={busy}
        label="Delete all synced transactions"
        onPress={() =>
          Alert.alert(
            'Delete all synced transactions?',
            'Income and expense records will be permanently deleted. Pending uploads, budgets, categories and savings goals are kept.',
            [
              { text: 'Cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () =>
                  perform(async () => {
                    let deleted = 0;
                    try {
                      for (const row of useFinanceStore
                        .getState()
                        .transactions.filter(
                          (item) => item.syncState !== 'pending',
                        )) {
                        await deleteTransaction(row.id);
                        useFinanceStore
                          .getState()
                          .setTransactions(
                            useFinanceStore
                              .getState()
                              .transactions.filter(
                                (item) => item.id !== row.id,
                              ),
                          );
                        deleted++;
                      }
                      setMessage(`${deleted} transactions deleted.`);
                    } catch {
                      setMessage(
                        `${deleted} deleted. Remaining records are still shown; retry to continue.`,
                      );
                    }
                  }),
              },
            ],
          )
        }
      />
      <Button disabled={busy} label="Refresh account data" onPress={refresh} />
      <Button
        disabled={busy}
        label="Sign out"
        onPress={() =>
          Alert.alert(
            'Sign out?',
            'Pending uploads stay on this device and resume when you sign into the same account.',
            [
              { text: 'Cancel' },
              { text: 'Sign out', onPress: () => perform(clearAuthUser) },
            ],
          )
        }
      />
    </FinancePage>
  );
}
function Button({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, disabled && { opacity: 0.5 }]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}
