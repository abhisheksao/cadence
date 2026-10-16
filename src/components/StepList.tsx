import { StyleSheet, View, useColorScheme } from 'react-native';

import { Text } from '@/components/Text';
import type { Phase } from '@/engine/types';
import { formatClock } from '@/format/clock';

type StepState = 'done' | 'current' | 'upcoming';

type Props = { steps: Phase[]; currentIndex: number; finished: boolean };

const MARK: Record<StepState, string> = { done: '✓', current: '▶', upcoming: '' };

/** The routine's steps, marked done, current, or upcoming (FR-018). */
export function StepList({ steps, currentIndex, finished }: Props) {
  const dark = useColorScheme() === 'dark';
  const color = dark ? '#E6EDF3' : '#0E1116';

  return (
    <View style={styles.list}>
      {steps.map((step, i) => {
        const state: StepState = finished || i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming';
        const duration = step.durationSec === null ? 'untimed' : formatClock(step.durationSec);
        return (
          <View
            key={i}
            accessible
            accessibilityLabel={`${step.title}, ${duration}, ${state}`}
            style={[styles.row, state === 'current' && styles.current]}
          >
            <Text style={[styles.mark, { color }]}>{MARK[state]}</Text>
            <Text
              numberOfLines={1}
              style={[styles.title, { color }, state === 'done' && styles.done, state === 'current' && styles.bold]}
            >
              {step.title}
            </Text>
            <Text style={[styles.duration, { color }, state === 'done' && styles.done]}>{duration}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 4, alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  current: { backgroundColor: '#FF7A4526' },
  mark: { width: 18, fontSize: 14, textAlign: 'center' },
  title: { flex: 1, fontSize: 16 },
  bold: { fontWeight: '700' },
  done: { opacity: 0.45 },
  duration: { fontSize: 14, opacity: 0.7, fontVariant: ['tabular-nums'] },
});
