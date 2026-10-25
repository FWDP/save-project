import { useState } from 'react';
import { Pressable } from 'react-native';
import { Text, TextInput } from '@/components/accessible-text';
import { FinancePage, financePageStyles as styles } from '@/components/layout/finance-page';
import { requireAuthClient, getAuthUser } from '@/lib/auth';
import { useRouter } from 'expo-router';
export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (password.length < 12) throw new Error('Use at least 12 characters.');
      if (password !== confirm) throw new Error('Passwords do not match.');
      if (!(await getAuthUser())) throw new Error('Open a new reset link from your email first.');
      const { error } = await requireAuthClient().auth.updateUser({ password });
      if (error) throw error;
      setPassword(''); setConfirm(''); setMessage('Password updated.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update password.'); }
    finally { setBusy(false); }
  };
  return <FinancePage title="Reset password" subtitle="Choose a new password" showSync={false}>
    <TextInput accessibilityLabel="New password" placeholder="New password" placeholderTextColor="#a1afc3" style={[styles.card, { color: '#fff' }]} autoCapitalize="none" autoComplete="new-password" secureTextEntry={!visible} value={password} onChangeText={setPassword} />
    <TextInput accessibilityLabel="Confirm password" placeholder="Confirm password" placeholderTextColor="#a1afc3" style={[styles.card, { color: '#fff' }]} autoCapitalize="none" secureTextEntry={!visible} value={confirm} onChangeText={setConfirm} />
    <Pressable onPress={() => setVisible(!visible)}><Text style={styles.rowMeta}>{visible ? 'Hide password' : 'Show password'}</Text></Pressable>
    <Pressable disabled={busy} style={styles.primaryButton} onPress={save}><Text style={styles.primaryButtonText}>{busy ? 'Saving…' : 'Update password'}</Text></Pressable>
    <Text accessibilityLiveRegion="polite" style={styles.rowMeta}>{message}</Text>
    <Pressable onPress={() => router.replace('/')}><Text style={styles.rowMeta}>Continue to SAVE</Text></Pressable>
  </FinancePage>;
}
