import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Alert, AppState, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FinancePage } from '@/components/layout/finance-page';
import {
  fetchStellarNetwork, fetchStellarPayments, fetchStellarSigningRequest, fetchVaultGoals,
  linkStellarAccount, prepareVaultInvocation, submitStellarTransaction, type StellarNetworkStatus, type StellarPortfolio,
  type StellarSigningRequest, type StellarVaultEvent, type StellarVaultGoal, type StellarVaultGoalsResponse,
} from '@/lib/api';
import {
  createStellarWalletPairing,
  disconnectStellarWallet,
  restoreStellarWalletSession,
  signStellarXdr,
  subscribeStellarWalletSession,
  walletConnectConfiguration,
  type StellarWalletConnectSession,
} from '@/lib/wallet-connect';

const ACCOUNT_KEY = 'save.stellar.testnet.account';
const STROOPS_PER_XLM = 10_000_000n;
const newIdempotencyKey = (action: string) => `${action}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const saveAccount = async (address: string) => {
  if (Platform.OS === 'web') { if (typeof window !== 'undefined') window.localStorage.setItem(ACCOUNT_KEY, address); return; }
  const { setItemAsync } = await import('expo-secure-store'); await setItemAsync(ACCOUNT_KEY, address);
};
const loadAccount = async () => {
  if (Platform.OS === 'web') return typeof window === 'undefined' ? null : window.localStorage.getItem(ACCOUNT_KEY);
  const { getItemAsync } = await import('expo-secure-store'); return getItemAsync(ACCOUNT_KEY);
};
const xlmToAtomic = (value: string) => {
  if (!/^\d+(\.\d{1,7})?$/.test(value.trim())) throw new Error('Enter an XLM amount with no more than 7 decimal places.');
  const [whole, fraction = ''] = value.trim().split('.');
  const amount = BigInt(whole) * STROOPS_PER_XLM + BigInt(fraction.padEnd(7, '0'));
  if (amount <= 0n) throw new Error('Amount must be greater than zero.');
  return amount.toString();
};
const atomicToXlm = (value: string) => {
  const atomic = BigInt(value || '0');
  const whole = atomic / STROOPS_PER_XLM;
  const fraction = (atomic % STROOPS_PER_XLM).toString().padStart(7, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
};
const eventField = (event: StellarVaultEvent | undefined, field: string) => {
  if (!event?.value || typeof event.value !== 'object' || Array.isArray(event.value)) {
    return undefined;
  }
  const value = (event.value as Record<string, unknown>)[field];
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint'
    ? String(value)
    : undefined;
};
const fundingStatusCopy = (status: StellarSigningRequest['status']) => {
  if (status === 'success') return 'Funded successfully · confirmed on Stellar Testnet';
  if (status === 'failed') return 'Not funded · the transaction failed or expired';
  if (status === 'prepared') return 'Not funded yet · waiting for wallet approval';
  return 'Submitted · waiting for Stellar ledger confirmation';
};
type VaultIntent = Omit<Parameters<typeof prepareVaultInvocation>[0], 'idempotencyKey'>;

export default function StellarScreen() {
  const [network, setNetwork] = useState<StellarNetworkStatus | null>(null);
  const [portfolio, setPortfolio] = useState<StellarPortfolio | null>(null);
  const [vault, setVault] = useState<StellarVaultGoalsResponse | null>(null);
  const [payments, setPayments] = useState<Awaited<ReturnType<typeof fetchStellarPayments>>>([]);
  const [address, setAddress] = useState('');
  const [targetXlm, setTargetXlm] = useState('1');
  const [targetDate, setTargetDate] = useState('');
  const [contributions, setContributions] = useState<Record<string, string>>({});
  const [withdrawals, setWithdrawals] = useState<Record<string, string>>({});
  const [request, setRequest] = useState<StellarSigningRequest | null>(null);
  const [lastIntent, setLastIntent] = useState<VaultIntent | null>(null);
  const [walletSession, setWalletSession] = useState<StellarWalletConnectSession | null>(null);
  const [pairingUri, setPairingUri] = useState<string | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const walletConfig = useMemo(() => walletConnectConfiguration(), []);

  const loadVault = useCallback(async (owner: string) => { const result = await fetchVaultGoals(owner); setVault(result); return result; }, []);
  const connect = useCallback(async (nextAddress: string) => {
    if (!nextAddress.trim()) return;
    setBusy('account');
    try {
      const linked = await linkStellarAccount(nextAddress.trim());
      setPortfolio(linked); setAddress(linked.address); setMessage(null); await saveAccount(linked.address);

      const [activityResult, vaultResult] = await Promise.allSettled([
        fetchStellarPayments(linked.address),
        loadVault(linked.address),
      ]);
      if (activityResult.status === 'fulfilled') setPayments(activityResult.value);

      const unavailable: string[] = [];
      if (activityResult.status === 'rejected') unavailable.push('payment history');
      if (vaultResult.status === 'rejected') unavailable.push('Soroban vault');
      if (unavailable.length) {
        setMessage(`Wallet connected. ${unavailable.join(' and ')} could not refresh yet.`);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to link Testnet account.'); }
    finally { setBusy(null); }
  }, [loadVault]);

  const refreshRequest = useCallback(async () => {
    if (!request) return;
    try {
      const updated = await fetchStellarSigningRequest(request.idempotencyKey); setRequest(updated);
      if (updated.status === 'success' && portfolio) {
        const [linked, activity] = await Promise.all([linkStellarAccount(portfolio.address), fetchStellarPayments(portfolio.address), loadVault(portfolio.address)]);
        setPortfolio(linked); setPayments(activity); setMessage(`${updated.action.replaceAll('_', ' ')} confirmed on Stellar Testnet.`);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to refresh transaction status.'); }
  }, [loadVault, portfolio, request]);

  useEffect(() => {
    void fetchStellarNetwork().then(setNetwork).catch(() => setMessage('Stellar Testnet RPC is unavailable.'));
    void Promise.all([restoreStellarWalletSession(), loadAccount()])
      .then(([session, saved]) => {
        if (session) setWalletSession(session);
        const account = session?.address ?? saved;
        if (account) void connect(account);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to restore wallet session.'));
  }, [connect]);
  useEffect(() => subscribeStellarWalletSession((reason) => {
    setWalletSession(null);
    setPairingUri(null);
    setMessage(reason);
  }), []);
  useEffect(() => {
    if (!request || !['prepared', 'submitted', 'pending'].includes(request.status)) return;
    const timer = setInterval(() => void refreshRequest(), 3_000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refreshRequest(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [refreshRequest, request]);

  const connectFreighter = useCallback(async () => {
    setWalletBusy(true);
    setMessage(null);
    try {
      const pairing = await createStellarWalletPairing();
      setPairingUri(pairing.uri);
      await Clipboard.setStringAsync(pairing.uri);
      setMessage('WalletConnect pairing copied. Approve the Testnet session in Freighter Mobile.');
      try {
        await Linking.openURL(pairing.freighterDeepLink);
      } catch {
        setMessage('Could not open Freighter automatically. Open Freighter, choose WalletConnect, and paste the copied pairing URI.');
      }
      const session = await pairing.approval();
      setWalletSession(session);
      setPairingUri(null);
      await connect(session.address);
      setMessage(`Wallet connected through ${session.walletName}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Freighter connection failed.');
    } finally {
      setWalletBusy(false);
    }
  }, [connect]);

  const disconnectFreighter = useCallback(async () => {
    if (!walletSession) return;
    setWalletBusy(true);
    try {
      await disconnectStellarWallet(walletSession);
      setWalletSession(null);
      setPairingUri(null);
      setMessage('Freighter disconnected. The public account remains available in watch-only mode.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to disconnect Freighter.');
    } finally {
      setWalletBusy(false);
    }
  }, [walletSession]);

  const copyPairingUri = useCallback(async () => {
    if (!pairingUri) return;
    await Clipboard.setStringAsync(pairingUri);
    setMessage('WalletConnect pairing URI copied. Paste it into Freighter Mobile.');
  }, [pairingUri]);

  const signWithFreighter = useCallback(async (prepared: StellarSigningRequest) => {
    if (!walletSession || !portfolio) throw new Error('Connect the matching Freighter Testnet account first.');
    setBusy(`sign-${prepared.idempotencyKey}`);
    try {
      const signatureRequest = signStellarXdr(walletSession, prepared.unsignedXdr, portfolio.address);
      void Linking.openURL('freighterwallet://').catch(() => undefined);
      const signedXdr = await signatureRequest;
      await submitStellarTransaction({
        signedXdr,
        kind: prepared.kind,
        idempotencyKey: prepared.idempotencyKey,
      });
      const updated = await fetchStellarSigningRequest(prepared.idempotencyKey);
      setRequest(updated);
      setMessage('Freighter signed the transaction. Waiting for Stellar ledger confirmation.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Freighter signing failed.');
    } finally {
      setBusy(null);
    }
  }, [portfolio, walletSession]);

  const copyUnsignedXdr = useCallback(async (prepared: StellarSigningRequest) => {
    await Clipboard.setStringAsync(prepared.unsignedXdr);
    setMessage('Unsigned Testnet XDR copied for manual wallet or Stellar Laboratory testing.');
  }, []);

  const prepareIntent = useCallback(async (intent: VaultIntent) => {
    setBusy(`${intent.action}-${intent.goalId ?? 'new'}`);
    try {
      const prepared = await prepareVaultInvocation({ ...intent, idempotencyKey: newIdempotencyKey(intent.action) });
      setRequest(prepared); setLastIntent(intent); setMessage(null);
      const buttons = walletSession && portfolio?.address === walletSession.address
        ? [
            { text: 'Cancel', style: 'cancel' as const },
            { text: 'SEP-7 fallback', onPress: () => void Linking.openURL(prepared.signingUrl).catch(() => void copyUnsignedXdr(prepared)) },
            { text: 'Approve in Freighter', onPress: () => void signWithFreighter(prepared) },
          ]
        : [
            { text: 'Cancel', style: 'cancel' as const },
            { text: 'Copy XDR', onPress: () => void copyUnsignedXdr(prepared) },
            { text: 'Open SEP-7 Wallet', onPress: () => void Linking.openURL(prepared.signingUrl).catch(() => void copyUnsignedXdr(prepared)) },
          ];
      Alert.alert(
        'External wallet approval required',
        `${prepared.action.replaceAll('_', ' ')} was simulated for Stellar Testnet. Fee: ${prepared.fee ?? '—'} stroops. Review every field before signing.`,
        buttons,
      );
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to prepare vault transaction.'); }
    finally { setBusy(null); }
  }, [copyUnsignedXdr, portfolio, signWithFreighter, walletSession]);

  const createGoal = async () => {
    if (!portfolio || !network) return;
    try {
      const deadline = targetDate.trim() ? Math.floor(new Date(`${targetDate.trim()}T23:59:59Z`).getTime() / 1000) : undefined;
      if (deadline !== undefined && (!Number.isFinite(deadline) || deadline <= Date.now() / 1000)) throw new Error('Target date must be a future YYYY-MM-DD date.');
      await prepareIntent({ source: portfolio.address, owner: portfolio.address, action: 'create_goal', assetContractId: network.xlmSacId, targetAmount: xlmToAtomic(targetXlm), targetDate: deadline?.toString() });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Invalid goal details.'); }
  };
  const actOnGoal = async (goal: StellarVaultGoal, action: VaultIntent['action']) => {
    if (!portfolio) return;
    try {
      const amount = action === 'contribute' ? xlmToAtomic(contributions[goal.id] ?? '') : action === 'withdraw' ? xlmToAtomic(withdrawals[goal.id] ?? '') : undefined;
      await prepareIntent({ source: portfolio.address, action, goalId: goal.id, contributor: action === 'contribute' ? portfolio.address : undefined, amount });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Invalid transaction details.'); }
  };
  const xlmBalance = useMemo(() => portfolio?.balances.find((balance) => balance.asset === 'XLM')?.balance ?? '0', [portfolio]);

  return <FinancePage title="Stellar Savings" subtitle="Real Testnet funding with Soroban-verified goals">
    <View style={styles.notice}><Text style={styles.noticeTitle}>Non-custodial Testnet flow</Text><Text style={styles.help}>SAVE prepares transactions and tracks their public proof. Your external wallet remains the only user-transaction signer.</Text></View>
    <View style={styles.card}>
      <View style={styles.row}><Text style={styles.title}>Network</Text><Text style={[styles.badge, network && styles.online]}>{network ? `LIVE · ledger ${network.latestLedger}` : 'UNAVAILABLE'}</Text></View>
      <Text style={styles.help}>Stellar Testnet · Protocol {network?.protocolVersion ?? '—'} · Asset: XLM</Text>
      <Text numberOfLines={1} style={styles.mono}>Vault: {network?.vaultContractId ?? 'Not configured'}</Text>
      <Text style={styles.help}>Wallet callback: {network?.sep7.callbackEnabled ? 'enabled' : 'wallet submits directly'} · SEP-7 request signer: {network?.sep7.requestSigningPublicKey ? 'loaded' : 'not configured'}</Text>
    </View>
    <View style={[styles.card, walletSession && styles.confirmedCard]}>
      <View style={styles.row}><Text style={styles.title}>Freighter Mobile signer</Text><Text style={[styles.badge, walletSession && styles.online]}>{walletSession ? 'CONNECTED' : walletConfig.configured ? 'READY' : 'SETUP REQUIRED'}</Text></View>
      <Text style={styles.help}>WalletConnect signs the prepared Testnet XDR in Freighter. SAVE never receives your secret key.</Text>
      {!walletConfig.configured ? <View style={styles.setupNotice}><Text style={styles.preparedStatus}>WalletConnect configuration required</Text><Text style={styles.help}>Set EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID in the root .env, then restart Expo. A custom metadata URL is optional.</Text></View> : null}
      {walletConfig.configured && walletConfig.usingDefaultMetadata ? <Text style={styles.help}>Using the SAVE GitHub repository as temporary WalletConnect metadata.</Text> : null}
      {walletSession ? <><Text style={styles.success}>✓ {walletSession.walletName}</Text><Text numberOfLines={1} style={styles.mono}>{walletSession.address}</Text><Pressable disabled={walletBusy} style={styles.secondary} onPress={() => void disconnectFreighter()}><Text style={styles.secondaryText}>{walletBusy ? 'Disconnecting…' : 'Disconnect Freighter'}</Text></Pressable></> : <Pressable disabled={walletBusy || !walletConfig.configured} style={[styles.primary, (!walletConfig.configured || walletBusy) && styles.disabled]} onPress={() => void connectFreighter()}><Text style={styles.primaryText}>{walletBusy ? 'Waiting for Freighter approval…' : 'Connect Freighter Mobile'}</Text></Pressable>}
      {pairingUri ? <View style={styles.actionRow}><Pressable style={styles.secondary} onPress={() => void copyPairingUri()}><Text style={styles.secondaryText}>Copy Pairing URI</Text></Pressable><Pressable style={styles.secondary} onPress={() => void Linking.openURL(`freighterwallet://wc-redirect?uri=${encodeURIComponent(pairingUri)}`)}><Text style={styles.secondaryText}>Open Freighter</Text></Pressable></View> : null}
    </View>
    <View style={styles.card}>
      <Text style={styles.title}>Watch-only Testnet account</Text>
      <TextInput value={address} onChangeText={setAddress} autoCapitalize="characters" autoCorrect={false} style={styles.input} placeholder="G… public address" placeholderTextColor="#64728a" />
      <Pressable disabled={busy === 'account'} style={styles.primary} onPress={() => void connect(address)}><Text style={styles.primaryText}>{busy === 'account' ? 'Loading…' : 'Link Watch-Only Account'}</Text></Pressable>
      {portfolio ? <><View style={styles.divider} /><Text numberOfLines={1} style={styles.mono}>{portfolio.address}</Text><View style={styles.row}><Text style={styles.help}>Available Testnet XLM</Text><Text style={styles.value}>{xlmBalance}</Text></View></> : null}
    </View>
    {portfolio && network ? <View style={styles.card}>
      <Text style={styles.title}>Create on-chain savings goal</Text><Text style={styles.help}>Designated test asset: native XLM SAC. Private labels and financial records remain off-chain.</Text>
      <TextInput value={targetXlm} onChangeText={setTargetXlm} style={styles.input} placeholder="Target XLM, e.g. 1" placeholderTextColor="#64728a" keyboardType="decimal-pad" />
      <TextInput value={targetDate} onChangeText={setTargetDate} style={styles.input} placeholder="Optional target date YYYY-MM-DD" placeholderTextColor="#64728a" />
      <Pressable disabled={busy === 'create_goal-new'} style={styles.primary} onPress={() => void createGoal()}><Text style={styles.primaryText}>{busy === 'create_goal-new' ? 'Simulating…' : 'Create Goal in External Wallet'}</Text></Pressable>
    </View> : null}
    {request ? <View style={[styles.card, request.status === 'failed' && styles.failedCard, request.status === 'success' && styles.confirmedCard]}>
      <View style={styles.row}><Text style={styles.title}>{request.action === 'contribute' ? 'Funding confirmation' : 'Latest transaction'}</Text><Text style={[styles.status, statusColor(request.status)]}>{request.status.toUpperCase()}</Text></View>
      <View style={[styles.confirmationBanner, confirmationBannerStyle(request.status)]}>
        <Text style={[styles.confirmationTitle, statusColor(request.status)]}>
          {request.action === 'contribute'
            ? fundingStatusCopy(request.status)
            : `${request.action.replaceAll('_', ' ')} ${request.status}`}
        </Text>
        {request.action === 'contribute' && lastIntent?.amount ? <Text style={styles.confirmationAmount}>{atomicToXlm(lastIntent.amount)} XLM · Goal #{lastIntent.goalId}</Text> : null}
      </View>
      <Text style={styles.help}>{request.action.replaceAll('_', ' ')} · fee {request.fee ?? '—'} stroops</Text><Text numberOfLines={1} style={styles.mono}>{request.hash}</Text>
      {request.error ? <Text style={styles.error}>{request.error}</Text> : null}
      <View style={styles.actionRow}><Pressable style={styles.secondary} onPress={() => void refreshRequest()}><Text style={styles.secondaryText}>Refresh Status</Text></Pressable>{request.status !== 'prepared' ? <Pressable style={styles.secondary} onPress={() => void Linking.openURL(request.explorerUrl)}><Text style={styles.secondaryText}>Explorer Proof</Text></Pressable> : null}</View>
      {request.status === 'prepared' ? <View style={styles.actionRow}>{walletSession && portfolio?.address === walletSession.address ? <Pressable disabled={busy === `sign-${request.idempotencyKey}`} style={styles.primaryAction} onPress={() => void signWithFreighter(request)}><Text style={styles.primaryText}>{busy === `sign-${request.idempotencyKey}` ? 'Waiting for Freighter…' : 'Approve in Freighter'}</Text></Pressable> : null}<Pressable style={styles.secondary} onPress={() => void copyUnsignedXdr(request)}><Text style={styles.secondaryText}>Copy XDR</Text></Pressable></View> : null}
      {request.status === 'failed' && lastIntent ? <Pressable style={styles.primary} onPress={() => void prepareIntent(lastIntent)}><Text style={styles.primaryText}>Prepare Fresh Retry</Text></Pressable> : null}
    </View> : null}
    {portfolio ? <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Soroban goals</Text><Pressable onPress={() => void loadVault(portfolio.address)}><Text style={styles.link}>Refresh</Text></Pressable></View> : null}
    {vault?.goals.map((goal) => {
      const target = BigInt(goal.targetAmount || '0'); const balance = BigInt(goal.balance || '0');
      const progress = target > 0n ? Math.min(Number((balance * 10000n) / target) / 100, 100) : 0;
      const goalEvents = vault.events.filter((item) => item.goalId === goal.id);
      const event = [...goalEvents].reverse().find((item) => item.successful);
      const contributionEvent = [...goalEvents].reverse().find((item) => item.successful && item.type.toLowerCase().includes('contribution'));
      return <GoalCard key={goal.id} goal={goal} event={event} contributionEvent={contributionEvent} ledgerVerified={vault.ledgerVerified} progress={progress} contribution={contributions[goal.id] ?? ''} withdrawal={withdrawals[goal.id] ?? ''} busy={busy}
        onContributionChange={(value) => setContributions((current) => ({ ...current, [goal.id]: value }))}
        onWithdrawalChange={(value) => setWithdrawals((current) => ({ ...current, [goal.id]: value }))}
        onAction={(action) => void actOnGoal(goal, action)} />;
    })}
    {portfolio && vault && !vault.goals.length ? <View style={styles.card}><Text style={styles.help}>No Soroban goals yet. Create one above, approve it in your wallet, then refresh.</Text></View> : null}
    {portfolio && payments.length ? <View style={styles.card}><Text style={styles.title}>Recent account activity</Text>{payments.slice(0, 5).map((payment) => <Pressable key={payment.id} onPress={() => void Linking.openURL(payment.explorerUrl)} style={styles.activity}><View><Text style={styles.activityTitle}>{payment.type.replaceAll('_', ' ')}</Text><Text style={styles.help}>{payment.createdAt}</Text></View><Text style={styles.activityAmount}>{payment.amount ?? '—'} {payment.asset ?? ''}</Text></Pressable>)}</View> : null}
    {message ? <Text style={message.includes('confirmed') || message.includes('connected') || message.includes('copied') ? styles.success : styles.error}>{message}</Text> : null}
  </FinancePage>;
}

function GoalCard(props: { goal: StellarVaultGoal; event?: StellarVaultEvent; contributionEvent?: StellarVaultEvent; ledgerVerified: boolean; progress: number; contribution: string; withdrawal: string; busy: string | null; onContributionChange: (value: string) => void; onWithdrawalChange: (value: string) => void; onAction: (action: VaultIntent['action']) => void }) {
  const { goal, event, contributionEvent } = props;
  const balance = BigInt(goal.balance || '0');
  const target = BigInt(goal.targetAmount || '0');
  const fundingState = balance === 0n ? 'NOT FUNDED' : balance >= target ? 'TARGET REACHED' : 'PARTIALLY FUNDED';
  const lastContribution = eventField(contributionEvent, 'amount');
  return <View style={styles.card}>
    <View style={styles.row}><Text style={styles.title}>Goal #{goal.id}</Text><Text style={styles.status}>{goal.status}</Text></View>
    <View style={styles.verifiedBalance}>
      <View style={styles.row}><Text style={styles.verifiedLabel}>{props.ledgerVerified ? '✓ LIVE SOROBAN BALANCE' : 'BALANCE UNVERIFIED'}</Text><Text style={[styles.fundingBadge, balance > 0n && styles.fundingBadgeActive]}>{fundingState}</Text></View>
      <Text style={styles.balanceAmount}>{atomicToXlm(goal.balance)} XLM funded</Text>
      <Text style={styles.help}>This is the vault contract balance, not a locally entered amount.</Text>
    </View>
    <View style={styles.row}><Text style={styles.help}>Progress toward target</Text><Text style={styles.value}>{props.progress.toFixed(1)}%</Text></View>
    <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${props.progress}%` }]} /></View>
    <Text style={styles.help}>Target {atomicToXlm(goal.targetAmount)} XLM{goal.targetDate ? ` · ${new Date(Number(goal.targetDate) * 1000).toLocaleDateString()}` : ''}</Text>
    {contributionEvent ? <Pressable onPress={() => void Linking.openURL(contributionEvent.explorerUrl)} style={styles.contributionProof}><Text style={styles.confirmedProofTitle}>✓ Last funding confirmed{lastContribution ? ` · ${atomicToXlm(lastContribution)} XLM` : ''}</Text><Text style={styles.help}>Ledger {contributionEvent.ledger}{contributionEvent.ledgerClosedAt ? ` · ${new Date(contributionEvent.ledgerClosedAt).toLocaleString()}` : ''}</Text><Text numberOfLines={1} style={styles.mono}>{contributionEvent.txHash}</Text><Text style={styles.proofLink}>View transaction proof →</Text></Pressable> : balance > 0n ? <Text style={styles.help}>The balance is verified, but its contribution event is outside the current event window.</Text> : null}
    {event ? <Pressable onPress={() => void Linking.openURL(event.explorerUrl)} style={styles.proof}><Text style={styles.proofTitle}>Latest proof · {event.type.replaceAll('_', ' ')}</Text><Text numberOfLines={1} style={styles.mono}>{event.txHash}</Text></Pressable> : null}
    {goal.status === 'Active' ? <><TextInput value={props.contribution} onChangeText={props.onContributionChange} style={styles.input} placeholder="Contribution in XLM" placeholderTextColor="#64728a" keyboardType="decimal-pad" /><Pressable disabled={props.busy === `contribute-${goal.id}`} style={styles.primary} onPress={() => props.onAction('contribute')}><Text style={styles.primaryText}>Fund Goal with Testnet XLM</Text></Pressable><View style={styles.actionRow}><Pressable style={styles.secondary} onPress={() => props.onAction('complete_goal')}><Text style={styles.secondaryText}>Complete</Text></Pressable><Pressable style={styles.danger} onPress={() => props.onAction('cancel_goal')}><Text style={styles.dangerText}>Cancel & Refund</Text></Pressable></View></> : null}
    {goal.status === 'Completed' && BigInt(goal.balance) > 0n ? <><TextInput value={props.withdrawal} onChangeText={props.onWithdrawalChange} style={styles.input} placeholder="Withdrawal in XLM" placeholderTextColor="#64728a" keyboardType="decimal-pad" /><Pressable style={styles.primary} onPress={() => props.onAction('withdraw')}><Text style={styles.primaryText}>Withdraw to Owner Wallet</Text></Pressable></> : null}
  </View>;
}

const statusColor = (status: StellarSigningRequest['status']) => status === 'success' ? styles.successStatus : status === 'failed' ? styles.failedStatus : status === 'prepared' ? styles.preparedStatus : styles.pendingStatus;
const confirmationBannerStyle = (status: StellarSigningRequest['status']) => status === 'success' ? styles.confirmationSuccess : status === 'failed' ? styles.confirmationFailed : status === 'prepared' ? styles.confirmationPrepared : styles.confirmationPending;
const styles = StyleSheet.create({
  card: { backgroundColor: '#0d1629', borderWidth: 1, borderColor: '#1c2941', borderRadius: 12, padding: 15, gap: 11 }, failedCard: { borderColor: '#6d2c3a' }, confirmedCard: { borderColor: '#226a57' },
  notice: { backgroundColor: '#10233a', borderWidth: 1, borderColor: '#275382', borderRadius: 12, padding: 15 }, noticeTitle: { color: '#72b7ff', fontWeight: '800', marginBottom: 6 },
  title: { color: '#f2f6fb', fontWeight: '800', fontSize: 14 }, sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 }, sectionTitle: { color: '#f2f6fb', fontWeight: '800', fontSize: 17 },
  help: { color: '#8d99ad', fontSize: 11, lineHeight: 17 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, actionRow: { flexDirection: 'row', gap: 9 },
  badge: { color: '#ff788c', fontSize: 9, fontWeight: '800' }, online: { color: '#24ce88' }, status: { color: '#72b7ff', fontSize: 10, fontWeight: '800' }, preparedStatus: { color: '#f4be4f' }, pendingStatus: { color: '#72b7ff' }, successStatus: { color: '#24ce88' }, failedStatus: { color: '#ff788c' },
  mono: { color: '#8ca0bd', fontSize: 9, fontFamily: 'monospace' }, value: { color: '#f3f7fc', fontWeight: '800', fontSize: 12 }, input: { backgroundColor: '#081120', borderWidth: 1, borderColor: '#26354e', borderRadius: 9, padding: 12, color: '#f1f5fa' },
  primary: { backgroundColor: '#5ca9ff', borderRadius: 9, padding: 13, alignItems: 'center' }, primaryAction: { flex: 1, backgroundColor: '#5ca9ff', borderRadius: 9, padding: 11, alignItems: 'center' }, primaryText: { color: '#07111f', fontWeight: '800', fontSize: 12 }, secondary: { flex: 1, borderWidth: 1, borderColor: '#315277', borderRadius: 9, padding: 11, alignItems: 'center' }, secondaryText: { color: '#82bcfa', fontWeight: '700', fontSize: 11 }, danger: { flex: 1, borderWidth: 1, borderColor: '#623141', borderRadius: 9, padding: 11, alignItems: 'center' }, dangerText: { color: '#ff8798', fontWeight: '700', fontSize: 11 }, disabled: { opacity: 0.45 }, setupNotice: { backgroundColor: '#2a2415', borderWidth: 1, borderColor: '#665326', borderRadius: 8, padding: 10, gap: 4 },
  divider: { height: 1, backgroundColor: '#223149' }, progressTrack: { height: 7, borderRadius: 5, backgroundColor: '#192640', overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 5, backgroundColor: '#5ca9ff' }, proof: { backgroundColor: '#0a2034', borderRadius: 8, padding: 10, gap: 4 }, proofTitle: { color: '#57a8f5', fontSize: 10, fontWeight: '700', textTransform: 'capitalize' }, link: { color: '#66adf8', fontWeight: '700', fontSize: 12 },
  activity: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1a2740', paddingVertical: 9 }, activityTitle: { color: '#dfe7f3', textTransform: 'capitalize', fontSize: 11 }, activityAmount: { color: '#64adff', fontWeight: '700', fontSize: 11 }, error: { color: '#ff788c', fontSize: 11, lineHeight: 17 }, success: { color: '#24ce88', fontSize: 11, lineHeight: 17 },
  confirmationBanner: { borderRadius: 9, borderWidth: 1, padding: 11, gap: 4 }, confirmationSuccess: { backgroundColor: '#0d2925', borderColor: '#226a57' }, confirmationFailed: { backgroundColor: '#2a151c', borderColor: '#6d2c3a' }, confirmationPrepared: { backgroundColor: '#2a2415', borderColor: '#665326' }, confirmationPending: { backgroundColor: '#10233a', borderColor: '#275382' }, confirmationTitle: { fontSize: 11, fontWeight: '800' }, confirmationAmount: { color: '#f1f6fb', fontSize: 16, fontWeight: '900' },
  verifiedBalance: { backgroundColor: '#0a2034', borderWidth: 1, borderColor: '#275382', borderRadius: 9, padding: 11, gap: 5 }, verifiedLabel: { color: '#61b1ff', fontSize: 9, fontWeight: '900' }, fundingBadge: { color: '#8d99ad', fontSize: 8, fontWeight: '900' }, fundingBadgeActive: { color: '#35d394' }, balanceAmount: { color: '#f4f8fc', fontSize: 20, fontWeight: '900' }, contributionProof: { backgroundColor: '#0d2925', borderWidth: 1, borderColor: '#226a57', borderRadius: 9, padding: 11, gap: 4 }, confirmedProofTitle: { color: '#38d695', fontSize: 11, fontWeight: '800' }, proofLink: { color: '#5ee0aa', fontSize: 10, fontWeight: '700', marginTop: 2 },
});
