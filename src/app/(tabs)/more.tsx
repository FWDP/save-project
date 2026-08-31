import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { FinancePage, financePageStyles as styles } from '@/components/layout/finance-page';

export default function MoreScreen() {
  const router = useRouter();
  return (
    <FinancePage title="More" subtitle="Reports, profile, and application controls">
      <View style={styles.card}>
        {[['Stellar Testnet', '/stellar'], ['Categories', '/categories'], ['Custom Fields', '/custom-fields'], ['Reports', '/reports'], ['Settings', '/settings']].map(([label, route]) => (
          <Pressable key={label} style={styles.row} onPress={() => router.push(route as '/reports')}>
            <View style={styles.rowTop}><Text style={styles.rowTitle}>{label}</Text><Text style={styles.rowValue}>›</Text></View>
          </Pressable>
        ))}
      </View>
    </FinancePage>
  );
}
