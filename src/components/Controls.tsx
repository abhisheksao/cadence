import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import type { Status } from '@/engine/types';

export type SessionControls = {
  pause(): void;
  resume(): void;
  skip(): void;
  back(): void;
  stop(): void;
};

type ButtonProps = { label: string; text: string; onPress: () => void; primary?: boolean };

function ControlButton({ label, text, onPress, primary }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.button, primary && styles.primary, { opacity: pressed ? 0.75 : 1 }]}
    >
      <Text style={[styles.text, primary && styles.primaryText]}>{text}</Text>
    </Pressable>
  );
}

/** Pause/resume, back, skip and stop for a running or paused session (User Story 2). */
export function Controls({ status, controls }: { status: Status; controls: SessionControls }) {
  if (status !== 'running' && status !== 'paused') return null;
  return (
    <View style={styles.row}>
      <ControlButton label="Back" text="⏮" onPress={() => controls.back()} />
      {status === 'running' ? (
        <ControlButton label="Pause" text="Pause" onPress={() => controls.pause()} primary />
      ) : (
        <ControlButton label="Resume" text="Resume" onPress={() => controls.resume()} primary />
      )}
      <ControlButton label="Skip to next phase" text="⏭" onPress={() => controls.skip()} />
      <ControlButton label="Stop" text="Stop" onPress={() => controls.stop()} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  button: {
    minWidth: 64,
    minHeight: 56,
    borderRadius: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A313C',
  },
  primary: { backgroundColor: '#FF7A45', minWidth: 120 },
  text: { color: '#E6EDF3', fontSize: 20, fontWeight: '700' },
  primaryText: { color: '#0E1116' },
});
