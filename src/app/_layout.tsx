import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { FinanceDataProvider } from '@/components/providers/finance-data-provider';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <FinanceDataProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#070d1a' } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="expense-add" />
          <Stack.Screen name="receipt-camera" options={{ presentation: 'fullScreenModal' }} />
        </Stack>
      </FinanceDataProvider>
    </ThemeProvider>
  );
}
