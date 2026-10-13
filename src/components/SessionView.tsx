import { StyleSheet, Text, View, useColorScheme } from 'react-native';

import { formatClock, spokenDuration } from '@/format/clock';
import type { SessionState } from '@/session/controller';

/** Phase title, subtitle, and time left (or elapsed, for untimed phases) (FR-021). */
export function SessionView({ state }: { state: SessionState }) {
  const dark = useColorScheme() === 'dark';
  const color = dark ? '#E6EDF3' : '#0E1116';
  const { phase, phaseRemainingMs, phaseElapsedMs, status } = state;

  // Time left rounds up, so the clock reads 0:01 during the last second, never 0:00.
  const timed = phaseRemainingMs !== null;
  const seconds = timed ? Math.ceil(phaseRemainingMs / 1_000) : Math.floor(phaseElapsedMs / 1_000);
  const clockLabel = `${spokenDuration(seconds)} ${timed ? 'left' : 'elapsed'}`;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color }]} accessibilityRole="header">
        {phase?.title ?? state.title}
      </Text>
      {phase?.subtitle ? <Text style={[styles.subtitle, { color }]}>{phase.subtitle}</Text> : null}
      <Text style={[styles.clock, { color }]} accessibilityLabel={clockLabel}>
        {formatClock(seconds)}
      </Text>
      {status === 'paused' ? <Text style={styles.badge}>Paused</Text> : null}
      {status === 'done' ? <Text style={styles.badge}>Done</Text> : null}
      {status === 'stopped' ? <Text style={styles.badge}>Stopped</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8 },
  title: { fontSize: 32, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 18, opacity: 0.7, textAlign: 'center' },
  clock: { fontSize: 72, fontWeight: '300', fontVariant: ['tabular-nums'] },
  badge: { color: '#FF7A45', fontSize: 18, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
});
