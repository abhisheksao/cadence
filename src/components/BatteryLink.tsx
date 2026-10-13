import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import { backgroundHost } from '@/platform/background';

/**
 * Offers the battery exemption again, for users who declined it at first (FR-017). Android only:
 * iOS has no such exemption.
 */
export function BatteryLink() {
  if (Platform.OS !== 'android') return null;
  const label = 'App stopping mid-session? Allow it to run in the background';
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => {
        void backgroundHost.requestBatteryExemption();
      }}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { color: '#FF7A45', fontSize: 15, textAlign: 'center', textDecorationLine: 'underline' },
});
