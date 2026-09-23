import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FinancePage } from '@/components/layout/finance-page';
import {
  authConfigured,
  authRedirect,
  requireAuthClient,
  signInGoogle,
} from '@/lib/auth';

export default function OnboardingScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const run = async (action: 'password' | 'magic' | 'google') => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const client = requireAuthClient();
      if (action === 'google') {
        await signInGoogle();
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        throw new Error('Enter a valid email address.');
      if (action === 'magic') {
        const { error } = await client.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: authRedirect() },
        });
        if (error) throw error;
        setMessage('Check your email. Open the sign-in link on this device.');
        return;
      }
      if (signup && password.length < 12)
        throw new Error('Use a password with at least 12 characters.');
      const { data, error } = signup
        ? await client.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: authRedirect() },
          })
        : await client.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
      if (error) throw error;
      if (data.session) router.replace('/');
      else
        setMessage('Check your email to confirm your account on this device.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Sign-in failed. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <FinancePage
      title="Welcome to SAVE"
      subtitle="Your spending, budgets, and goals in one place"
      showSync={false}
    >
      <View style={styles.card}>
        <Text style={styles.title}>
          {signup ? 'Create your account' : 'Sign in'}
        </Text>
        {!authConfigured && (
          <Text style={styles.message}>
            Account sign-in is awaiting provider configuration.
          </Text>
        )}
        <Text style={styles.label}>Email</Text>
        <TextInput
          accessibilityLabel="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          accessibilityLabel="Password"
          autoCapitalize="none"
          secureTextEntry
          autoComplete={signup ? 'new-password' : 'current-password'}
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
        <Pressable
          disabled={busy || !authConfigured}
          style={styles.primary}
          onPress={() => run('password')}
        >
          <Text style={styles.primaryText}>
            {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
          </Text>
        </Pressable>
        <Pressable
          disabled={busy || !authConfigured}
          style={styles.secondary}
          onPress={() => run('google')}
        >
          <Text style={styles.label}>Continue with Google</Text>
        </Pressable>
        <Pressable
          disabled={busy || !authConfigured}
          style={styles.secondary}
          onPress={() => run('magic')}
        >
          <Text style={styles.label}>Email me a sign-in link</Text>
        </Pressable>
        <Pressable
          disabled={busy}
          style={styles.secondary}
          onPress={() => setSignup(!signup)}
        >
          <Text style={styles.link}>
            {signup
              ? 'Already have an account? Sign in'
              : 'New to SAVE? Create an account'}
          </Text>
        </Pressable>
        {message ? (
          <Text accessibilityLiveRegion="polite" style={styles.message}>
            {message}
          </Text>
        ) : null}
      </View>
    </FinancePage>
  );
}
const styles = StyleSheet.create({
  card: { padding: 20, gap: 12, backgroundColor: '#0d1629', borderRadius: 16 },
  title: { color: '#f4f7fb', fontSize: 24, fontWeight: '800' },
  label: { color: '#e5ebf5', fontSize: 15 },
  input: {
    backgroundColor: '#081120',
    color: '#f4f7fb',
    borderWidth: 1,
    borderColor: '#31405a',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  primary: {
    backgroundColor: '#55a6ff',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryText: { color: '#07111f', fontWeight: '800', fontSize: 16 },
  secondary: { padding: 14, alignItems: 'center', minHeight: 48 },
  link: { color: '#75b6ff', fontSize: 14 },
  message: { color: '#e9bd69', fontSize: 14, lineHeight: 21 },
});
