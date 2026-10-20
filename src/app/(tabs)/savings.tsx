import { DateField } from '@/components/date-field';
import { validDate } from '@/lib/finance';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    AppState,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';

import {
    FinancePage,
    financePageStyles as styles,
} from '@/components/layout/finance-page';
import {
    createSavingsGoal,
    deleteSavingsGoal,
    fetchSavingsGoals,
    type ApiSavingsGoal,
} from '@/lib/api';

function SavingsScreen() {
  const [goals, setGoals] = useState<ApiSavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    targetAmount: '',
    targetDate: '',
    asset: 'PHP',
  });
  const [message, setMessage] = useState<string | null>(null);
  const refreshInProgress = useRef(false);
  const isMounted = useRef(true);

  const loadGoals = useCallback(async () => {
    if (refreshInProgress.current) return;
    refreshInProgress.current = true;
    try {
      setLoading(true);
      const items = await fetchSavingsGoals();
      if (!isMounted.current) return;
      setGoals(items);
      setMessage(null);
    } catch {
      if (isMounted.current) setMessage('Savings API unavailable.');
    } finally {
      if (isMounted.current) setLoading(false);
      refreshInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    const initialRefresh = setTimeout(() => {
      if (isMounted.current) void loadGoals();
    }, 0);
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void loadGoals();
    }, 30_000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadGoals();
    });

    return () => {
      isMounted.current = false;
      clearTimeout(initialRefresh);
      clearInterval(interval);
      listener.remove();
    };
  }, [loadGoals]);

  const create = async () => {
    if (creating) return;
    if (form.targetDate && !validDate(form.targetDate))
      return setMessage('Choose a valid target date.');
    const targetAmount = Number(form.targetAmount);
    if (
      !form.name.trim() ||
      !Number.isFinite(targetAmount) ||
      targetAmount <= 0
    ) {
      return setMessage('Enter a valid goal name and positive target amount.');
    }

    try {
      setCreating(true);
      const goal = await createSavingsGoal({
        name: form.name.trim(),
        targetAmount,
        targetDate: form.targetDate || undefined,
        asset: form.asset,
        status: 'draft',
        network: 'testnet',
      });
      setGoals((items) => [goal, ...items]);
      setForm({ name: '', targetAmount: '', targetDate: '', asset: 'PHP' });
      setMessage(null);
    } catch {
      setMessage('Failed to create savings goal. Please retry.');
    } finally {
      setCreating(false);
    }
  };

  const removeGoal = (id: string, name: string) => {
    Alert.alert(
      'Delete savings goal?',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSavingsGoal(id);
              setGoals((prev) => prev.filter((g) => g.id !== id));
            } catch {
              Alert.alert('Error', 'Failed to delete goal.');
            }
          },
        },
      ],
    );
  };

  return (
    <FinancePage
      title="Savings Goals"
      subtitle="Plan and track your savings goals"
    >
      <Pressable
        style={styles.primaryButton}
        onPress={() => setShowForm(!showForm)}
      >
        <Text style={styles.primaryButtonText}>
          {showForm ? 'Close goal form' : 'Create savings goal'}
        </Text>
      </Pressable>
      {showForm && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>New savings goal</Text>
          <TextInput
            accessibilityLabel="Goal name"
            style={localStyles.input}
            placeholder="Goal name"
            placeholderTextColor="#a1afc3"
            value={form.name}
            onChangeText={(name) => setForm({ ...form, name })}
          />
          <TextInput
            accessibilityLabel="Target amount in PHP"
            style={localStyles.input}
            keyboardType="decimal-pad"
            placeholder="Target amount (PHP)"
            placeholderTextColor="#a1afc3"
            value={form.targetAmount}
            onChangeText={(targetAmount) => setForm({ ...form, targetAmount })}
          />
          <DateField
            label="Target date (optional)"
            value={form.targetDate}
            onChange={(targetDate) => setForm({ ...form, targetDate })}
          />
          <Pressable
            disabled={creating}
            style={styles.primaryButton}
            onPress={create}
          >
            <Text style={styles.primaryButtonText}>
              {creating ? 'Creating…' : 'Create goal'}
            </Text>
          </Pressable>
        </View>
      )}
      {message ? <Text style={{ color: '#ff8195' }}>{message}</Text> : null}
      <View style={styles.card}>
        <View style={localStyles.headerRow}>
          <Text style={styles.cardTitle}>
            Savings goals
          </Text>
          <Pressable onPress={loadGoals} style={localStyles.refreshButton}>
            <Text style={localStyles.refreshText}>
              {loading ? 'Refreshing…' : '↻ Refresh'}
            </Text>
          </Pressable>
        </View>

        {goals.map((goal) => {
            const percent = Math.min(
              Math.round(
                ((goal.fundedAmount || 0) / Math.max(goal.targetAmount, 1)) *
                  100,
              ),
              100,
            );
            const formatGoalAmount = (amount: number) =>
              new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

            return (
              <View key={goal.id} style={localStyles.goalCard}>
                <View style={styles.rowTop}>
                  <View style={localStyles.goalTitleWrap}>
                    <Text style={styles.rowTitle}>{goal.name}</Text>
                    <View style={localStyles.badgeRow}>
                      <View style={localStyles.statusBadge}>
                        <Text style={localStyles.statusBadgeText}>
                          {goal.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => removeGoal(goal.id, goal.name)}
                    hitSlop={8}
                    style={localStyles.deleteButton}
                  >
                    <Text style={localStyles.deleteButtonText}>✕</Text>
                  </Pressable>
                </View>

                <View style={localStyles.amountRow}>
                  <Text style={localStyles.fundedText}>
                    {formatGoalAmount(goal.fundedAmount)} / {formatGoalAmount(goal.targetAmount)}
                  </Text>
                  <Text style={localStyles.percentText}>{percent}% funded</Text>
                </View>

                <View style={localStyles.progressTrack}>
                  <View
                    style={[localStyles.progressFill, { width: `${percent}%` }]}
                  />
                </View>

                <View style={localStyles.metaRow}>
                  <Text style={styles.rowMeta}>
                    {goal.targetDate ? `Target: ${goal.targetDate}` : 'No deadline'}
                  </Text>
                </View>
              </View>
            );
          })}

        {!goals.length && !loading ? (
          <View style={{ paddingVertical: 12 }}>
            <Text style={styles.emptyTitle}>No savings goals yet</Text>
            <Text style={styles.emptyText}>
              Create your first savings goal above to start tracking progress.
            </Text>
          </View>
        ) : null}
      </View>
    </FinancePage>
  );
}

const localStyles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  refreshButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#17243b',
  },
  refreshText: {
    color: '#55a6ff',
    fontSize: 11,
    fontWeight: '600',
  },
  goalCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#17243b',
    gap: 6,
  },
  goalTitleWrap: {
    gap: 4,
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  statusBadge: {
    backgroundColor: '#1b2a44',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusBadgeText: {
    color: '#8bb9f8',
    fontSize: 9,
    fontWeight: '700',
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#261924',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#ff6b81',
    fontSize: 12,
    fontWeight: '700',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fundedText: {
    color: '#f4f7fb',
    fontSize: 13,
    fontWeight: '700',
  },
  percentText: {
    color: '#7d8ba6',
    fontSize: 11,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#17243b',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#55a6ff',
    borderRadius: 3,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    backgroundColor: '#081120',
    color: '#f4f7fb',
    borderRadius: 9,
    padding: 12,
    borderWidth: 1,
    borderColor: '#17243b',
  },
});

export default function ScopedPage() { return <><SavingsScreen /></>; }
