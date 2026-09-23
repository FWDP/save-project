import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, View, ActivityIndicator } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { authClient, getAuthUser } from '@/lib/auth';
import { useFinanceStore } from '@/store/finance-store';
import { useExpenseDraftStore } from '@/store/expense-draft-store';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { FinanceDataProvider } from '@/components/providers/finance-data-provider';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const currentAccount = useRef<string | null | undefined>(undefined);
  const [account, setAccount] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const change = (id: string | null) => {
      if (!alive || currentAccount.current === id) return;
      currentAccount.current = id;
      useFinanceStore.getState().reset();
      useExpenseDraftStore.getState().resetDraft();
      setAccount(id);
    };
    void getAuthUser()
      .then((user) => {
        if (currentAccount.current === undefined) change(user?.id ?? null);
      })
      .catch(() => change(null));
    const subscription = authClient?.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT')
          change(session?.user.id ?? null);
      },
    );
    return () => {
      alive = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, []);
  if (account === undefined)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#070d1a',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator />
      </View>
    );

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <FinanceDataProvider key={account ?? 'signed-out'} userId={account}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#070d1a' },
          }}
        >
          <Stack.Protected guard={Boolean(account)}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="transactions" />
            <Stack.Screen name="transaction-detail" />
            <Stack.Screen name="reports" />
            <Stack.Screen name="categories" />
            <Stack.Screen name="custom-fields" />
            <Stack.Screen name="stellar" />
            <Stack.Screen name="receipt" />
            <Stack.Screen name="expense-add" />
            <Stack.Screen
              name="receipt-camera"
              options={{ presentation: 'fullScreenModal' }}
            />
          </Stack.Protected>
          <Stack.Protected guard={!account}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>
          <Stack.Screen name="auth/callback" />
        </Stack>
      </FinanceDataProvider>
    </ThemeProvider>
  );
}
