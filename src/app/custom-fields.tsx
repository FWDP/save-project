import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { FinancePage, financePageStyles as styles } from '@/components/layout/finance-page';

export default function CustomFieldsScreen() {
  const [fields, setFields] = useState<string[]>([]); const [name, setName] = useState('');
  return <FinancePage title="Custom Fields" subtitle="Additional metadata for financial records"><View style={styles.card}>{fields.map((field) => <View key={field} style={styles.row}><Text style={styles.rowTitle}>{field}</Text></View>)}{!fields.length ? <Text style={styles.emptyText}>No custom fields on this device yet.</Text> : null}</View><View style={styles.card}><Text style={styles.cardTitle}>Add local test field</Text><TextInput style={{ backgroundColor: '#081120', color: '#f4f7fb', borderRadius: 9, padding: 12 }} value={name} onChangeText={setName} placeholder="Field name" placeholderTextColor="#65738c" /><Pressable style={styles.primaryButton} onPress={() => { if (name.trim() && !fields.includes(name.trim())) { setFields((value) => [...value, name.trim()]); setName(''); } }}><Text style={styles.primaryButtonText}>Add field</Text></Pressable><Text style={styles.rowMeta}>This page is locally testable; server persistence will be added with the durable data phase.</Text></View></FinancePage>;
}
