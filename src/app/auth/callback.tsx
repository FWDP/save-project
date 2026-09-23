import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { finishAuth, getAuthUser, authRedirect } from '@/lib/auth';
export default function AuthCallback() {
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();
  const router = useRouter();
  const [message, setMessage] = useState('Completing sign-in…');
  useEffect(() => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params))
      if (typeof value === 'string') query.set(key, value);
    void (async () => {
      if (!(await getAuthUser()))
        await finishAuth(`${authRedirect()}?${query}`);
      router.replace('/');
    })().catch((error) =>
      setMessage(error.message || 'Sign-in failed. Please request a new link.'),
    );
  }, [params.code, params.error, params.error_description, router]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 24 }}>
      <Text style={{ color: '#f4f7fb' }}>{message}</Text>
      <Pressable onPress={() => router.replace('/onboarding')}>
        <Text style={{ color: '#75b6ff' }}>Back to sign in</Text>
      </Pressable>
    </View>
  );
}
