import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { saveAuthUser, type AuthUser } from '@/lib/auth';

export default function OnboardingScreen() {
  const router = useRouter();
  const [name, setName] = useState('Marcus Lee');
  const [email, setEmail] = useState('marcus@save.app');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    setIsSubmitting(true);

    const user: AuthUser = {
      id: role === 'admin' ? 'usr_admin_1' : 'usr_2',
      name: name.trim() || 'SAVE User',
      email: email.trim() || 'user@save.app',
      role,
    };

    await saveAuthUser(user);
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Welcome</Text>
          <Text style={styles.title}>Set up your SAVE account</Text>
          <Text style={styles.subtitle}>Keep spending visible, synced, and protected.</Text>
        </View>

        <View style={styles.card}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor="#8aa3bf"
            style={styles.input}
          />

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#8aa3bf"
            style={styles.input}
          />

          <View style={styles.roleRow}>
            {(['user', 'admin'] as const).map((option) => (
              <Pressable
                key={option}
                onPress={() => setRole(option)}
                style={[styles.roleButton, role === option && styles.roleButtonActive]}>
                <Text style={styles.roleButtonText}>{option}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable disabled={isSubmitting} onPress={handleContinue} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{isSubmitting ? 'Loading...' : 'Continue'}</Text>
          </Pressable>

          <Pressable onPress={() => router.replace('/')} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Skip for now</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b1220',
  },
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  hero: {
    marginBottom: 18,
  },
  eyebrow: {
    color: '#7dd3fc',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    marginBottom: 8,
  },
  title: {
    color: '#f8fafc',
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#8aa3bf',
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    backgroundColor: '#121d2e',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1d2940',
    gap: 14,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1d2940',
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#f8fafc',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleButton: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1d2940',
    paddingVertical: 12,
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
  roleButtonText: {
    color: '#f8fafc',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  primaryButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1d2940',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: '#cbd5e1',
    fontWeight: '600',
  },
});
