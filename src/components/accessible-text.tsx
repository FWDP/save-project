import { forwardRef } from 'react';
import { Text as NativeText, TextInput as NativeTextInput, StyleSheet, type TextProps, type TextInputProps, type TextStyle } from 'react-native';
import { textScales, usePreferences } from '@/store/preferences-store';
function useTextStyle(style: TextProps['style'] | TextInputProps['style']): TextStyle {
  const scale = textScales[usePreferences(state => state.textSize)];
  const flat = StyleSheet.flatten(style) || {};
  return { fontSize: (flat.fontSize || 14) * scale, ...(flat.lineHeight ? { lineHeight: flat.lineHeight * scale } : {}) };
}
export const Text = forwardRef<NativeText, TextProps>(function Text({ style, ...props }, ref) {
  const scaled = useTextStyle(style);
  return <NativeText {...props} ref={ref} style={[style, scaled]} />;
});
export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function TextInput({ style, ...props }, ref) {
  const scaled = useTextStyle(style);
  return <NativeTextInput {...props} ref={ref} style={[style, scaled]} />;
});
