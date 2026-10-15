import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';

import { Text } from '@/components/Text';

export type StepperProps = {
  label: string;
  value: string;
  onChange: (dir: 1 | -1) => void;
  canDecrease: boolean;
  canIncrease: boolean;
};

/** A label with − and + buttons to adjust a setting (FR-004, US2). */
export function Stepper({ label, value, onChange, canDecrease, canIncrease }: StepperProps) {
  const dark = useColorScheme() === 'dark';
  const color = dark ? '#E6EDF3' : '#0E1116';
  const btnBg = dark ? '#2A313C' : '#E2E7ED';
  const btnColor = dark ? '#E6EDF3' : '#0E1116';

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color }]}>{label}</Text>
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          accessibilityState={{ disabled: !canDecrease }}
          disabled={!canDecrease}
          onPress={() => onChange(-1)}
          hitSlop={8}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: btnBg, opacity: !canDecrease ? 0.35 : pressed ? 0.75 : 1 },
          ]}
        >
          <Text style={[styles.buttonText, { color: btnColor }]}>−</Text>
        </Pressable>
        <Text style={[styles.value, { color }]}>{value}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          accessibilityState={{ disabled: !canIncrease }}
          disabled={!canIncrease}
          onPress={() => onChange(1)}
          hitSlop={8}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: btnBg, opacity: !canIncrease ? 0.35 : pressed ? 0.75 : 1 },
          ]}
        >
          <Text style={[styles.buttonText, { color: btnColor }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 24,
  },
  value: {
    minWidth: 56,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
