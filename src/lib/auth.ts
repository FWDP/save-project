import { Platform } from 'react-native';
import { createClient, type User } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
};
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const authConfigured = Boolean(url && key);
const storage = {
  getItem: async (name: string) =>
    Platform.OS === 'web'
      ? typeof window === 'undefined'
        ? null
        : window.localStorage.getItem(name)
      : SecureStore.getItemAsync(name),
  setItem: async (name: string, value: string) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined')
        window.localStorage.setItem(name, value);
    } else await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.removeItem(name);
    } else await SecureStore.deleteItemAsync(name);
  },
};
export const authClient = authConfigured
  ? createClient(url!, key!, {
      auth: {
        storage,
        flowType: 'pkce',
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
export function requireAuthClient() {
  if (!authClient)
    throw new Error(
      'Sign-in is not configured. Set the Supabase URL and publishable key.',
    );
  return authClient;
}
function profile(user: User): AuthUser {
  return {
    id: user.id,
    name:
      user.user_metadata?.name || user.user_metadata?.full_name || 'SAVE User',
    email: user.email ?? '',
    role: user.app_metadata?.role === 'admin' ? 'admin' : 'user',
  };
}
export async function getAuthUser(): Promise<AuthUser | null> {
  if (!authClient) return null;
  const { data } = await authClient.auth.getSession();
  return data.session ? profile(data.session.user) : null;
}
export async function accessToken(expectedOwner?: string) {
  const { data, error } = await requireAuthClient().auth.getSession();
  if (error || !data.session) throw new Error('Please sign in to continue.');
  if (expectedOwner && data.session.user.id !== expectedOwner)
    throw new Error('Account changed. Retry from your account.');
  return data.session.access_token;
}
export function authRedirect() {
  return Linking.createURL('/auth/callback');
}
export async function signInGoogle() {
  const redirectTo = authRedirect();
  const { data, error } = await requireAuthClient().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (Platform.OS === 'web') {
    window.location.assign(data.url);
    return;
  }
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') await finishAuth(result.url);
}
let exchange: Promise<void> | null = null;
export async function finishAuth(callback: string) {
  if (exchange) return exchange;
  exchange = (async () => {
    const parsed = new URL(callback);
    if (parsed.searchParams.has('error'))
      throw new Error(
        parsed.searchParams.get('error_description') || 'Sign-in failed.',
      );
    const code = parsed.searchParams.get('code');
    if (!code)
      throw new Error('This sign-in link is incomplete. Request a new one.');
    const { error } =
      await requireAuthClient().auth.exchangeCodeForSession(code);
    if (error) throw error;
  })();
  try {
    await exchange;
  } finally {
    exchange = null;
  }
}
export async function clearAuthUser() {
  if (authClient) {
    const { error } = await authClient.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }
  await storage.removeItem('save-auth-user');
}
