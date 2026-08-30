import { Platform } from 'react-native';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
};

const AUTH_STORAGE_KEY = 'save-auth-user';

function readWebAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

function writeWebAuthUser(user: AuthUser | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!user) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export async function saveAuthUser(user: AuthUser) {
  if (Platform.OS === 'web') {
    writeWebAuthUser(user);
    return;
  }

  const { setItemAsync } = await import('expo-secure-store');
  await setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export async function getAuthUser(): Promise<AuthUser | null> {
  if (Platform.OS === 'web') {
    return readWebAuthUser();
  }

  const { getItemAsync } = await import('expo-secure-store');
  const raw = await getItemAsync(AUTH_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export async function clearAuthUser() {
  if (Platform.OS === 'web') {
    writeWebAuthUser(null);
    return;
  }

  const { deleteItemAsync } = await import('expo-secure-store');
  await deleteItemAsync(AUTH_STORAGE_KEY);
}
