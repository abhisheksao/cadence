import { forwardRef } from 'react';
import { Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps } from 'react-native';

import { fontFamily } from '@/platform/font';

const base = fontFamily ? { fontFamily } : undefined;

/** React Native's Text with the platform font family (see src/platform/font.android.ts). */
export function Text({ style, ...props }: TextProps) {
  return <RNText {...props} style={[base, style]} />;
}

/** React Native's TextInput with the platform font family. */
export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput({ style, ...props }, ref) {
  return <RNTextInput ref={ref} {...props} style={[base, style]} />;
});
