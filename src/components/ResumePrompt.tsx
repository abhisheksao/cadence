import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { formatClock, formatTimeOfDay } from '@/format/clock';
import type { RecoveryResult } from '@/session/types';

type Props = {
  result: Exclude<RecoveryResult, { kind: 'none' }>;
  onResume: () => void;
  onDiscard: () => void;
  /** Acknowledges an interrupted note. */
  onDismiss: () => void;
};

/** Offers Resume/Discard for a killed session, or says it could not be resumed (FR-024, FR-025). */
export function ResumePrompt({ result, onResume, onDiscard, onDismiss }: Props) {
  const dark = useColorScheme() === 'dark';
  const color = dark ? '#E6EDF3' : '#0E1116';
  const background = dark ? '#1A1F27' : '#FFFFFF';

  if (result.kind === 'interrupted') {
    return (
      <View style={[styles.card, { backgroundColor: background }]}>
        <Text style={[styles.body, { color }]}>
          {`Your session '${result.title}' was interrupted at ${formatTimeOfDay(result.at)}`}
        </Text>
        <View style={styles.row}>
          <Button label="OK" onPress={onDismiss} primary />
        </View>
      </View>
    );
  }

  const { definition, index, phaseElapsedMs, paused } = result.assessment;
  const phase = definition.phases[index];
  const position =
    phase.durationSec === null
      ? `${formatClock(phaseElapsedMs / 1_000)} elapsed`
      : `${formatClock(Math.ceil((phase.durationSec * 1_000 - phaseElapsedMs) / 1_000))} left`;
  const detail = [phase.title, position, paused ? 'Paused' : null].filter(Boolean).join(' · ');

  return (
    <View style={[styles.card, { backgroundColor: background }]}>
      <Text style={[styles.title, { color }]} accessibilityRole="header">
        {`Resume ${definition.title}?`}
      </Text>
      <Text style={[styles.body, { color }]}>{detail}</Text>
      <View style={styles.row}>
        <Button label="Discard" onPress={onDiscard} />
        <Button label="Resume" onPress={onResume} primary />
      </View>
    </View>
  );
}

function Button({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, primary && styles.primary, { opacity: pressed ? 0.8 : 1 }]}
    >
      <Text style={[styles.buttonText, primary && styles.primaryText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 24, gap: 12, width: '100%', maxWidth: 420 },
  title: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 17, opacity: 0.85 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  button: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#2A313C' },
  primary: { backgroundColor: '#FF7A45' },
  buttonText: { color: '#E6EDF3', fontSize: 16, fontWeight: '700' },
  primaryText: { color: '#0E1116' },
});
