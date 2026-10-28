import { Text, TextInput } from '@/components/accessible-text';
import { FinancePage } from '@/components/layout/finance-page';
import { SaveLogo } from '@/components/save-logo';
import {
    authConfigured,
    authRedirect,
    requireAuthClient,
    setPendingPostAuthRedirect,
    signInGoogle,
} from '@/lib/auth';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

export default function OnboardingScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const run = async (action: 'password' | 'magic' | 'google' | 'recover') => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const client = requireAuthClient();
      if (action === 'google') {
        if (signup) setPendingPostAuthRedirect('/');
        await signInGoogle(signup ? '/' : undefined);
        if (signup) router.replace('/');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        throw new Error('Enter a valid email address.');
      if (action === 'recover') {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: authRedirect('/reset-password'),
        });
        if (error) throw error;
        setMessage('Your email address is your SAVE user name. If this email has an account, a password reset link will arrive. Open it on this device.');
        return;
      }
      if (action === 'magic') {
        const { error } = await client.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: authRedirect(signup ? '/' : undefined),
          },
        });
        if (error) throw error;
        setMessage('Check your email. Open the sign-in link on this device.');
        return;
      }
      if (signup && password.length < 12)
        throw new Error('Use a password with at least 12 characters.');
      if (signup) setPendingPostAuthRedirect('/');
      const { data, error } = signup
        ? await client.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: authRedirect('/') },
          })
        : await client.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
      if (error) {
        setPendingPostAuthRedirect(null);
        throw error;
      }
      if (data.session) router.replace(signup ? '/' : '/');
      else
        setMessage('Check your email to confirm your account on this device.');
    } catch (error) {
      setPendingPostAuthRedirect(null);
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
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <SaveLogo size={88} />
        </View>
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
          secureTextEntry={!showPassword}
          autoComplete={signup ? 'new-password' : 'current-password'}
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          onPress={() => setShowPassword((visible) => !visible)}
          style={styles.passwordToggle}
        >
          <Text style={styles.link}>{showPassword ? 'Hide password' : 'Show password'}</Text>
        </Pressable>
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
        <Pressable disabled={busy || !authConfigured} style={styles.secondary} onPress={() => run('recover')}>
          <Text style={styles.link}>Retrieve Password/User Name</Text>
        </Pressable>
        <Text style={styles.message}>Your user name is the email address you registered with.</Text>
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
  passwordToggle: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 4 },
  message: { color: '#e9bd69', fontSize: 14, lineHeight: 21 },
});
