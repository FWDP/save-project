import { Text } from '@/components/accessible-text';
import { useRefreshFinance } from '@/components/providers/finance-data-provider';
import { getDatabaseSyncSettings, setDatabaseSyncEnabled, syncLocalFinances } from '@/lib/local-finance';
import { FinanceSyncConflict, type ConflictChoice, type SyncSettings } from '../../shared/finance-sync';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';

export function DatabaseSyncSettings() {
  const [settings, setSettings] = useState<SyncSettings>({ enabled: false });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const mounted = useRef(false);
  const working = useRef(false);
  const refresh = useRefreshFinance();
  useEffect(() => {
    mounted.current = true;
    void getDatabaseSyncSettings().then(value => { if (mounted.current) { setSettings(value); setReady(true); } }).catch(() => { if (mounted.current) setMessage('Could not read sync settings.'); });
    return () => { mounted.current = false; };
  }, []);
  const run = async (enabled: boolean, choice?: ConflictChoice) => {
    if (working.current) return;
    working.current = true;
    setBusy(true); setMessage(''); setConflict(false);
    try {
      const preference = await setDatabaseSyncEnabled(enabled);
      if (mounted.current) setSettings(preference);
      if (enabled) {
        const result = await syncLocalFinances(choice);
        await refresh();
        if (mounted.current) { setSettings(result); setMessage('Uploaded and downloaded financial records. Receipt photos stayed on this device.'); }
      } else if (mounted.current) setMessage('Sync is off on this device. Existing database copies remain stored.');
    } catch (error) {
      if (mounted.current) {
        setConflict(error instanceof FinanceSyncConflict);
        setMessage(error instanceof Error ? error.message : 'Sync failed. Your local records are still saved.');
      }
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const toggle = (enabled: boolean) => {
    if (!enabled) { void run(false); return; }
    Alert.alert('Enable database sync?', 'Transactions, budgets, categories and savings goals will be uploaded to your account database and downloaded to this device. Photos stay local. After enabling, use Sync now to exchange later changes. Turning this off will not delete existing database copies.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Enable and sync', onPress: () => { void run(true); } },
    ]);
  };
  return <View style={{ padding: 16, gap: 12, borderWidth: 1, borderColor: '#26354e', borderRadius: 12 }}>
    <Text style={{ color: '#f4f7fb', fontWeight: '700', fontSize: 18 }}>Optional database sync</Text>
    <Text style={{ color: '#aeb9cb' }}>Off by default. When enabled, Sync now uploads and downloads transactions, budgets, categories and savings goals. Receipt photos stay on this device. Changes remain local until you sync.</Text>
    <Switch accessibilityLabel="Enable database sync" value={settings.enabled} disabled={!ready || busy} onValueChange={toggle} />
    {settings.enabled && <Pressable accessibilityRole="button" disabled={busy || !ready} onPress={() => { void run(true); }}><Text style={{ color: '#75b6ff' }}>{busy ? 'Syncing…' : 'Sync now'}</Text></Pressable>}
    {settings.lastSyncedAt && <Text style={{ color: '#aeb9cb' }}>Last successful sync: {new Date(settings.lastSyncedAt).toLocaleString()}</Text>}
    {message ? <Text accessibilityLiveRegion="polite" style={{ color: '#e9bd69' }}>{message}</Text> : null}
    {conflict && <><Text style={{ color: '#aeb9cb' }}>Choose which side to keep for conflicting edits or deletions. Other records will be merged.</Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void run(true, 'device'); }}><Text style={{ color: '#75b6ff' }}>Keep device versions for conflicts</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void run(true, 'database'); }}><Text style={{ color: '#75b6ff' }}>Keep database versions for conflicts</Text></Pressable></>}
  </View>;
}
