import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { FinancePage, financePageStyles as styles } from '@/components/layout/finance-page';
import {
  createSavingsGoal,
  deleteSavingsGoal,
  fetchSavingsGoals,
  type ApiSavingsGoal,
} from '@/lib/api';

export default function SavingsScreen() {
  const router = useRouter();
  const [goals, setGoals] = useState<ApiSavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    targetAmount: '',
    targetDate: '',
    asset: 'XLM',
  });
  const [message, setMessage] = useState<string | null>(null);

  const loadGoals = useCallback(async () => {
    try {
      setLoading(true);
      const items = await fetchSavingsGoals();
      setGoals(items);
      setMessage(null);
    } catch {
      setMessage('Savings API unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    fetchSavingsGoals()
      .then((items) => {
        if (!active) return;
        setGoals(items);
        setMessage(null);
      })
      .catch(() => {
        if (active) setMessage('Savings API unavailable.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const create = async () => {
    const targetAmount = Number(form.targetAmount);
    if (!form.name.trim() || !Number.isFinite(targetAmount) || targetAmount <= 0) {
      return setMessage('Enter a valid goal name and positive target amount.');
    }

    try {
      const goal = await createSavingsGoal({
        name: form.name.trim(),
        targetAmount,
        targetDate: form.targetDate || undefined,
        asset: form.asset,
        status: 'draft',
        network: 'testnet',
      });
      setGoals((items) => [goal, ...items]);
      setForm({ name: '', targetAmount: '', targetDate: '', asset: 'XLM' });
      setMessage(null);
    } catch {
      setMessage('Failed to create savings goal. API unavailable.');
    }
  };

  const removeGoal = (id: string, name: string) => {
    Alert.alert('Delete savings goal?', `Are you sure you want to delete "${name}"?`, [
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
    ]);
  };

  return (
    <FinancePage
      title="Savings Goals"
      subtitle="Smart contracts and off-chain vaults on Stellar testnet">
      <View style={localStyles.stellarBanner}>
        <View style={{ flex: 1 }}><Text style={localStyles.stellarTitle}>Stellar Testnet vault</Text><Text style={styles.rowMeta}>Link a watch-only account and prepare externally signed Soroban transactions.</Text></View>
        <Pressable style={localStyles.stellarButton} onPress={() => router.push('/stellar')}><Text style={localStyles.stellarButtonText}>Open</Text></Pressable>
      </View>
      <View style={styles.card}>
        <View style={localStyles.headerRow}>
          <Text style={styles.cardTitle}>Active Goals ({goals.length})</Text>
          <Pressable onPress={loadGoals} style={localStyles.refreshButton}>
            <Text style={localStyles.refreshText}>{loading ? 'Refreshing…' : '↻ Refresh'}</Text>
          </Pressable>
        </View>

        {goals.map((goal) => {
          const percent = Math.min(
            Math.round(((goal.fundedAmount || 0) / Math.max(goal.targetAmount, 1)) * 100),
            100,
          );
          const hasOnChainProof = Boolean(goal.contractId && goal.transactionHash);

          return (
            <View key={goal.id} style={localStyles.goalCard}>
              <View style={styles.rowTop}>
                <View style={localStyles.goalTitleWrap}>
                  <Text style={styles.rowTitle}>{goal.name}</Text>
                  <View style={localStyles.badgeRow}>
                    <View style={localStyles.statusBadge}>
                      <Text style={localStyles.statusBadgeText}>{goal.status.toUpperCase()}</Text>
                    </View>
                    <View style={localStyles.assetBadge}>
                      <Text style={localStyles.assetBadgeText}>{goal.asset}</Text>
                    </View>
                  </View>
                </View>
                <Pressable
                  onPress={() => removeGoal(goal.id, goal.name)}
                  hitSlop={8}
                  style={localStyles.deleteButton}>
                  <Text style={localStyles.deleteButtonText}>✕</Text>
                </Pressable>
              </View>

              <View style={localStyles.amountRow}>
                <Text style={localStyles.fundedText}>
                  {goal.fundedAmount.toLocaleString('en-US')} / {goal.targetAmount.toLocaleString('en-US')} {goal.asset}
                </Text>
                <Text style={localStyles.percentText}>{percent}% funded</Text>
              </View>

              <View style={localStyles.progressTrack}>
                <View style={[localStyles.progressFill, { width: `${percent}%` }]} />
              </View>

              <View style={localStyles.metaRow}>
                <Text style={styles.rowMeta}>
                  {goal.targetDate ? `Target: ${goal.targetDate}` : 'No deadline'} · Stellar {goal.network ?? 'testnet'}
                </Text>
                {goal.contractId ? (
                  <Text numberOfLines={1} style={localStyles.contractText}>
                    Vault: {goal.contractId.slice(0, 8)}...
                  </Text>
                ) : (
                  <Text style={localStyles.draftNote}>Off-chain draft</Text>
                )}
              </View>

              <View
                style={[
                  localStyles.fundingState,
                  hasOnChainProof ? localStyles.fundingVerified : localStyles.fundingDraft,
                ]}>
                <Text
                  style={
                    hasOnChainProof
                      ? localStyles.fundingVerifiedTitle
                      : localStyles.fundingDraftTitle
                  }>
                  {hasOnChainProof ? '✓ Funding verified on Stellar' : 'Tracker only · no funds held'}
                </Text>
                <Text style={localStyles.fundingStateText}>
                  {hasOnChainProof
                    ? 'This amount has an on-chain transaction proof.'
                    : 'Saving this draft does not transfer XLM. Use the Stellar vault to fund a real goal.'}
                </Text>
              </View>

              <Pressable
                style={hasOnChainProof ? localStyles.proofButton : localStyles.fundButton}
                onPress={() => {
                  if (hasOnChainProof && goal.transactionHash) {
                    void Linking.openURL(
                      `https://stellar.expert/explorer/testnet/tx/${goal.transactionHash}`,
                    );
                  } else {
                    router.push('/stellar');
                  }
                }}>
                <Text
                  style={
                    hasOnChainProof
                      ? localStyles.proofButtonText
                      : localStyles.fundButtonText
                  }>
                  {hasOnChainProof ? 'View Transaction Proof' : 'Open Stellar Vault to Fund'}
                </Text>
              </Pressable>
            </View>
          );
        })}

        {!goals.length && !loading ? (
          <View style={{ paddingVertical: 12 }}>
            <Text style={styles.emptyTitle}>No savings goals yet</Text>
            <Text style={styles.emptyText}>
              Create your first savings goal below to track target funds on the Stellar network.
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create New Goal</Text>
        <TextInput
          style={localStyles.input}
          placeholder="Goal name (e.g., Emergency Fund)"
          placeholderTextColor="#65738c"
          value={form.name}
          onChangeText={(value) => setForm((c) => ({ ...c, name: value }))}
        />

        <View style={localStyles.formRow}>
          <TextInput
            style={[localStyles.input, { flex: 1 }]}
            placeholder="Target amount"
            placeholderTextColor="#65738c"
            keyboardType="decimal-pad"
            value={form.targetAmount}
            onChangeText={(value) => setForm((c) => ({ ...c, targetAmount: value }))}
          />
          <View style={localStyles.assetPicker}>
            {['XLM', 'USDC'].map((asset) => (
              <Pressable
                key={asset}
                onPress={() => setForm((c) => ({ ...c, asset }))}
                style={[
                  localStyles.assetChoice,
                  form.asset === asset && localStyles.assetChoiceActive,
                ]}>
                <Text
                  style={[
                    localStyles.assetChoiceText,
                    form.asset === asset && localStyles.assetChoiceTextActive,
                  ]}>
                  {asset}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <TextInput
          style={localStyles.input}
          placeholder="Target date (YYYY-MM-DD, optional)"
          placeholderTextColor="#65738c"
          value={form.targetDate}
          onChangeText={(value) => setForm((c) => ({ ...c, targetDate: value }))}
        />

        {message ? <Text style={[styles.rowMeta, { color: '#ff8b9c' }]}>{message}</Text> : null}

        <Pressable style={styles.primaryButton} onPress={create}>
          <Text style={styles.primaryButtonText}>Save Goal Draft</Text>
        </Pressable>
      </View>
    </FinancePage>
  );
}

const localStyles = StyleSheet.create({
  stellarBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#10233a', borderWidth: 1, borderColor: '#275382', borderRadius: 12, padding: 13 },
  stellarTitle: { color: '#72b7ff', fontWeight: '800', fontSize: 13 },
  stellarButton: { backgroundColor: '#5ca9ff', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  stellarButtonText: { color: '#07111f', fontWeight: '800' },
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
  assetBadge: {
    backgroundColor: '#16312a',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  assetBadgeText: {
    color: '#34d399',
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
  contractText: {
    color: '#a78bfa',
    fontSize: 10,
    fontWeight: '600',
  },
  draftNote: {
    color: '#65738c',
    fontSize: 10,
    fontStyle: 'italic',
  },
  fundingState: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 9,
    gap: 3,
  },
  fundingDraft: {
    backgroundColor: '#171c29',
    borderColor: '#343d50',
  },
  fundingVerified: {
    backgroundColor: '#0d2925',
    borderColor: '#226a57',
  },
  fundingDraftTitle: {
    color: '#f0bd62',
    fontSize: 11,
    fontWeight: '800',
  },
  fundingVerifiedTitle: {
    color: '#38d695',
    fontSize: 11,
    fontWeight: '800',
  },
  fundingStateText: {
    color: '#8e9ab0',
    fontSize: 10,
    lineHeight: 15,
  },
  fundButton: {
    backgroundColor: '#5ca9ff',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  fundButtonText: {
    color: '#07111f',
    fontSize: 11,
    fontWeight: '800',
  },
  proofButton: {
    borderWidth: 1,
    borderColor: '#2d745f',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  proofButtonText: {
    color: '#43d79b',
    fontSize: 11,
    fontWeight: '800',
  },
  input: {
    backgroundColor: '#081120',
    color: '#f4f7fb',
    borderRadius: 9,
    padding: 12,
    borderWidth: 1,
    borderColor: '#17243b',
  },
  formRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  assetPicker: {
    flexDirection: 'row',
    backgroundColor: '#081120',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#17243b',
    padding: 3,
    gap: 4,
  },
  assetChoice: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 6,
  },
  assetChoiceActive: {
    backgroundColor: '#1c3458',
  },
  assetChoiceText: {
    color: '#65738c',
    fontSize: 12,
    fontWeight: '700',
  },
  assetChoiceTextActive: {
    color: '#55a6ff',
  },
});
