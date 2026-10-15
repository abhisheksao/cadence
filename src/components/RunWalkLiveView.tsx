import { StyleSheet, View, useColorScheme } from 'react-native';

import { Text } from '@/components/Text';
import { formatClock, spokenDuration } from '@/format/clock';
import type { SessionState } from '@/session/controller';

/** The live workout: phase, round, time left, elapsed/total, next phase and paused badge (FR-017, US3). */
export function RunWalkLiveView({ state }: { state: SessionState }) {
  const dark = useColorScheme() === 'dark';
  const color = dark ? '#E6EDF3' : '#0E1116';
  const { phase, phaseRemainingMs, status, index, definition } = state;

  // Time left rounds up, so the clock reads 0:01 during the last second, never 0:00.
  const left = Math.ceil((phaseRemainingMs ?? 0) / 1_000);
  const elapsedSec = Math.floor(state.totalElapsedMs / 1_000);
  const totalSec = definition.phases.reduce((sum, p) => sum + (p.durationSec ?? 0), 0);
  const nextPhase = definition.phases[index + 1];

  const titleColor =
    phase?.kind === 'run'
      ? '#FF7A45'
      : phase?.kind === 'walk' || phase?.kind === 'warmup' || phase?.kind === 'cooldown'
        ? '#2EA043'
        : color;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: titleColor }]} accessibilityRole="header">
        {phase?.title ?? state.title}
      </Text>
      {phase?.subtitle ? <Text style={[styles.subtitle, { color }]}>{phase.subtitle}</Text> : null}
      <Text style={[styles.clock, { color }]} accessibilityLabel={`${spokenDuration(left)} left`}>
        {formatClock(left)}
      </Text>
      <Text style={[styles.elapsedTotal, { color }]}>
        {`${formatClock(elapsedSec)} / ${formatClock(totalSec)}`}
      </Text>
      {status === 'paused' ? <Text style={styles.badge}>Paused</Text> : null}
      {nextPhase && nextPhase.durationSec !== null ? (
        <Text style={[styles.next, { color }]}>
          {`Next: ${nextPhase.title} ${formatClock(nextPhase.durationSec)}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8 },
  title: { fontSize: 48, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 20, opacity: 0.7, textAlign: 'center' },
  clock: { fontSize: 80, fontWeight: '300', fontVariant: ['tabular-nums'] },
  elapsedTotal: { fontSize: 18, opacity: 0.7, fontVariant: ['tabular-nums'] },
  next: { fontSize: 16, opacity: 0.8 },
  badge: { color: '#FF7A45', fontSize: 18, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
});

