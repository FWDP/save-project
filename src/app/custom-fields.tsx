import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FinancePage, financePageStyles as styles } from '@/components/layout/finance-page';

const STORAGE_KEY = 'save_custom_fields_v1';
const DEFAULT_FIELDS = ['Project', 'Client', 'Tax ID', 'Invoice #'];

async function loadSavedFields(): Promise<string[]> {
  try {
    if (Platform.OS === 'web') {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : DEFAULT_FIELDS;
    }
    const { getItemAsync } = await import('expo-secure-store');
    const raw = await getItemAsync(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_FIELDS;
  } catch {
    return DEFAULT_FIELDS;
  }
}

async function saveFields(fields: string[]) {
  try {
    const raw = JSON.stringify(fields);
    if (Platform.OS === 'web') {
      window.localStorage.setItem(STORAGE_KEY, raw);
      return;
    }
    const { setItemAsync } = await import('expo-secure-store');
    await setItemAsync(STORAGE_KEY, raw);
  } catch {
    // Ignore write errors
  }
}

export default function CustomFieldsScreen() {
  const [fields, setFields] = useState<string[]>([]);
  const [name, setName] = useState('');

  useEffect(() => {
    void loadSavedFields().then(setFields);
  }, []);

  const addField = (fieldName: string) => {
    const trimmed = fieldName.trim();
    if (!trimmed || fields.includes(trimmed)) return;
    const next = [...fields, trimmed];
    setFields(next);
    void saveFields(next);
    setName('');
  };

  const removeField = (fieldName: string) => {
    Alert.alert('Remove custom field?', `Remove "${fieldName}" from custom fields list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          const next = fields.filter((f) => f !== fieldName);
          setFields(next);
          void saveFields(next);
        },
      },
    ]);
  };

  return (
    <FinancePage title="Custom Fields" subtitle="Metadata and tags for financial records">
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Active Fields ({fields.length})</Text>
        {fields.map((field) => (
          <View key={field} style={styles.row}>
            <Text style={styles.rowTitle}>{field}</Text>
            <Pressable
              onPress={() => removeField(field)}
              hitSlop={8}
              style={localStyles.removeButton}>
              <Text style={localStyles.removeButtonText}>✕</Text>
            </Pressable>
          </View>
        ))}
        {!fields.length ? (
          <Text style={styles.emptyText}>No custom fields configured yet.</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add Custom Field</Text>
        <TextInput
          style={{
            backgroundColor: '#081120',
            color: '#f4f7fb',
            borderRadius: 9,
            padding: 12,
            borderWidth: 1,
            borderColor: '#17243b',
          }}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Project, Vendor ID, Department"
          placeholderTextColor="#65738c"
        />
        <Pressable style={styles.primaryButton} onPress={() => addField(name)}>
          <Text style={styles.primaryButtonText}>Add Custom Field</Text>
        </Pressable>
        <Text style={styles.rowMeta}>
          Custom fields appear as optional metadata inputs when creating expenses and income.
        </Text>
      </View>
    </FinancePage>
  );
}

const localStyles = StyleSheet.create({
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#261924',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#ff6b81',
    fontSize: 12,
    fontWeight: '700',
  },
});
