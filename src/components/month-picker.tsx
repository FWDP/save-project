import { Pressable, StyleSheet, Text, View } from 'react-native';
import { shiftMonth } from '@/lib/finance';
import { useFinanceStore } from '@/store/finance-store';

export function MonthPicker() {
  const { selectedMonth, setSelectedMonth } = useFinanceStore();
  const label = new Date(`${selectedMonth}-15T12:00:00`).toLocaleDateString(
    'en-PH',
    { month: 'long', year: 'numeric' },
  );
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        style={styles.button}
        onPress={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
      >
        <Text style={styles.arrow}>‹</Text>
      </Pressable>
      <Text accessibilityLiveRegion="polite" style={styles.label}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next month"
        style={styles.button}
        onPress={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
      >
        <Text style={styles.arrow}>›</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111c31',
    borderRadius: 12,
  },
  button: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: { color: '#75b6ff', fontSize: 28 },
  label: { color: '#f4f7fb', fontSize: 16, fontWeight: '700' },
});
