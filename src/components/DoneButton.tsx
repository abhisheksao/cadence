import { Pressable, StyleSheet, Text } from 'react-native';

type Props = { onPress: () => void; size: 'large' | 'compact' };

/** Ends the current step and starts the next one (FR-014). Large on untimed steps. */
export function DoneButton({ onPress, size }: Props) {
  const large = size === 'large';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Done"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.base, large ? styles.large : styles.compact, { opacity: pressed ? 0.8 : 1 }]}
    >
      <Text style={[styles.text, large && styles.largeText]}>Done</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: '#FF7A45', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  large: { alignSelf: 'stretch', minHeight: 88 },
  compact: { minHeight: 48, paddingHorizontal: 28 },
  text: { color: '#0E1116', fontSize: 18, fontWeight: '700' },
  largeText: { fontSize: 28 },
});
