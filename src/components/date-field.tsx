import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { localDate, shiftMonth, validDate } from '@/lib/finance';
export function DateField({
  value,
  onChange,
  label = 'Date',
}: {
  value: string;
  onChange: (date: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(
    (validDate(value) ? value : localDate()).slice(0, 7),
  );
  const date = new Date(`${month}-01T12:00:00`);
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: '#e5ebf5', fontSize: 14, marginBottom: 8 }}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose ${label}`}
        onPress={() => setOpen(true)}
        style={{
          padding: 14,
          backgroundColor: '#081120',
          borderRadius: 9,
          borderWidth: 1,
          borderColor: '#31405a',
          minHeight: 48,
        }}
      >
        <Text style={{ color: '#f4f7fb', fontSize: 16 }}>
          {value || 'Choose date'}
        </Text>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: '#000b',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <View
            accessibilityViewIsModal
            style={{
              backgroundColor: '#111c31',
              padding: 16,
              borderRadius: 16,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Pressable
                accessibilityLabel="Previous month"
                onPress={() => setMonth(shiftMonth(month, -1))}
                style={{ padding: 16 }}
              >
                <Text style={{ color: '#75b6ff' }}>‹</Text>
              </Pressable>
              <Text style={{ color: '#f4f7fb', fontSize: 17 }}>
                {date.toLocaleDateString('en-PH', {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
              <Pressable
                accessibilityLabel="Next month"
                onPress={() => setMonth(shiftMonth(month, 1))}
                style={{ padding: 16 }}
              >
                <Text style={{ color: '#75b6ff' }}>›</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row' }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <Text
                  key={index}
                  style={{
                    width: '14.285%',
                    textAlign: 'center',
                    color: '#a1afc3',
                    paddingVertical: 10,
                  }}
                >
                  {day}
                </Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {Array.from({ length: date.getDay() + days }, (_, index) => {
                const day = index - date.getDay() + 1;
                const selected = `${month}-${String(day).padStart(2, '0')}`;
                return day < 1 ? (
                  <View key={index} style={{ width: '14.285%' }} />
                ) : (
                  <Pressable
                    key={index}
                    accessibilityRole="button"
                    accessibilityLabel={selected}
                    accessibilityState={{ selected: value === selected }}
                    onPress={() => {
                      onChange(selected);
                      setOpen(false);
                    }}
                    style={{
                      width: '14.285%',
                      minHeight: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 8,
                      backgroundColor:
                        value === selected ? '#264b78' : 'transparent',
                    }}
                  >
                    <Text style={{ color: '#f4f7fb', fontSize: 16 }}>
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => setOpen(false)}
              style={{ padding: 16, alignItems: 'center' }}
            >
              <Text style={{ color: '#75b6ff' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
