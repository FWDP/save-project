import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
export type TextSize = 'Small' | 'Medium' | 'Large';
export const textScales = { Small: 0.9, Medium: 1, Large: 1.25 };
export const usePreferences = create<{ textSize: TextSize; setTextSize: (size: TextSize) => Promise<void>; load: () => Promise<void> }>((set) => ({
  textSize: 'Medium',
  setTextSize: async (textSize) => {
    await AsyncStorage.setItem('save.text-size', textSize);
    set({ textSize });
  },
  load: async () => {
    const value = await AsyncStorage.getItem('save.text-size');
    if (value === 'Small' || value === 'Medium' || value === 'Large') set({ textSize: value });
  },
}));
