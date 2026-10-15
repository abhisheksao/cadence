import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, useColorScheme } from 'react-native';

import { Text } from '@/components/Text';
import { formatClock, spokenDuration } from '@/format/clock';
import type { SessionState } from '@/session/controller';

/**
 * Visual breathing pacer and session status: expanding/contracting circle,
 * phase title, cycle counter, and countdown clock.
 */
export function BreatheLiveView({ state }: { state: SessionState }) {
  const dark = useColorScheme() === 'dark';
  const color = dark ? '#E6EDF3' : '#0E1116';
  const { phase, phaseRemainingMs, status, definition } = state;

  const left = Math.ceil((phaseRemainingMs ?? 0) / 1_000);
  const elapsedSec = Math.floor(state.totalElapsedMs / 1_000);
  const totalSec = definition.phases.reduce((sum, p) => sum + (p.durationSec ?? 0), 0);

  const [scale] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    if (status !== 'running') {
      scale.stopAnimation();
      return;
    }

    const duration = Math.max(100, phaseRemainingMs ?? 1_000);

    if (phase?.kind === 'inhale') {
      Animated.timing(scale, {
        toValue: 1.0,
        duration,
        useNativeDriver: true,
      }).start();
    } else if (phase?.kind === 'exhale') {
      Animated.timing(scale, {
        toValue: 0.4,
        duration,
        useNativeDriver: true,
      }).start();
    } else if (phase?.kind === 'hold') {
      scale.setValue(1.0);
    } else if (phase?.kind === 'post-hold') {
      scale.setValue(0.4);
    }
  }, [phase?.kind, status, phaseRemainingMs, scale]);

  const circleBg = dark ? '#1E3A5F' : '#E0F2FE';
  const circleBorder = dark ? '#38BDF8' : '#0284C7';

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color }]} accessibilityRole="header">
        {phase?.title ?? state.title}
      </Text>
      {phase?.subtitle ? <Text style={[styles.subtitle, { color }]}>{phase.subtitle}</Text> : null}

      <View style={styles.pacerContainer}>
        <Animated.View
          testID="breath-pacer"
          style={[
            styles.pacerCircle,
            {
              backgroundColor: circleBg,
              borderColor: circleBorder,
              transform: [{ scale }],
            },
          ]}
        />
        <View style={styles.clockOverlay}>
          <Text style={[styles.clock, { color }]} accessibilityLabel={`${spokenDuration(left)} left`}>
            {formatClock(left)}
          </Text>
        </View>
      </View>

      <Text style={[styles.elapsedTotal, { color }]}>
        {`${formatClock(elapsedSec)} / ${formatClock(totalSec)}`}
      </Text>
      {status === 'paused' ? <Text style={styles.badge}>Paused</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 12 },
  title: { fontSize: 48, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 20, opacity: 0.7, textAlign: 'center' },
  pacerContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  pacerCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
  },
  clockOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  clock: { fontSize: 52, fontWeight: '300', fontVariant: ['tabular-nums'] },
  elapsedTotal: { fontSize: 18, opacity: 0.7, fontVariant: ['tabular-nums'] },
  badge: { color: '#FF7A45', fontSize: 18, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
});
