import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { FINANCE_RESET_KEY, FINANCE_RESET_VERSION, isFinancialStorageKey, resetBrowserFinances } from '../../shared/finance-reset';

export async function resetDeviceFinancesOnce() {
  if (await AsyncStorage.getItem(FINANCE_RESET_KEY) === FINANCE_RESET_VERSION) return;
  const legacy = await import('./sqlite');
  legacy.initializeDatabase();
  legacy.clearAllFinancialData();
  const keys = (await AsyncStorage.getAllKeys()).filter(isFinancialStorageKey);
  if (keys.length) await AsyncStorage.multiRemove(keys);
  if (Platform.OS === 'web') {
    resetBrowserFinances(window.localStorage);
  } else {
    const { Directory, Paths } = await import('expo-file-system');
    for (const directory of [new Directory(Paths.document, 'receipts'), new Directory(Paths.cache, 'Camera'), new Directory(Paths.cache, 'ImageManipulator')]) {
      if (directory.exists) directory.delete();
    }
    const { deleteItemAsync } = await import('expo-secure-store');
    await deleteItemAsync('save.stellar.testnet.account');
  }
  // Write only after all cleanup succeeds so an interrupted reset retries safely.
  await AsyncStorage.setItem(FINANCE_RESET_KEY, FINANCE_RESET_VERSION);
}
