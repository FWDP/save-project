import { Text, View } from 'react-native';
import { FinancePage, financePageStyles as styles } from '@/components/layout/finance-page';

export function SavingsPaused() {
  return (
    <FinancePage title="Savings Goals" subtitle="Savings integration is temporarily paused">
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Savings vaults are paused</Text>
        <Text style={styles.rowMeta}>
          Wallet connections and Testnet savings goals are currently unavailable.
          Your existing goals have been preserved.
        </Text>
      </View>
    </FinancePage>
  );
}
