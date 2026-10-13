import { FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Controls } from '@/components/Controls';
import { DoneButton } from '@/components/DoneButton';
import { SessionView } from '@/components/SessionView';
import { formatClock } from '@/format/clock';
import { ROUTINE_MODE_ID, routineDefinition } from '@/modes/routine';
import { useRoutine } from '@/routine/useRoutine';
import { useSession } from '@/session/useSession';

/** Runs the morning routine: a start view, and a live view while a routine session runs. */
export default function RoutineScreen() {
  const { state, controller } = useSession();
  const { routine } = useRoutine();
  const dark = useColorScheme() === 'dark';
  const color = dark ? '#E6EDF3' : '#0E1116';

  const isRoutine = state?.definition.modeId === ROUTINE_MODE_ID;
  const live = isRoutine && (state.status === 'running' || state.status === 'paused');

  if (live) {
    return (
      <View style={styles.live}>
        <SessionView state={state} />
        <DoneButton size="large" onPress={() => controller.skip()} />
        <Controls status={state.status} controls={controller} />
      </View>
    );
  }

  // The definition gives the same titles ("Step N" for blank ones) the session will use.
  const definition = routineDefinition(routine);
  const totalSec = routine.steps.reduce((sum, s) => sum + (s.durationSec ?? 0), 0);

  return (
    <View style={styles.container}>
      <FlatList
        data={definition.phases}
        keyExtractor={(_, i) => routine.steps[i].id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={[styles.stepTitle, { color }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.duration, { color }]}>
              {item.durationSec === null ? 'untimed' : formatClock(item.durationSec)}
            </Text>
          </View>
        )}
      />
      <Text style={[styles.total, { color }]}>{`Total ${formatClock(totalSec)}`}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start"
        onPress={() => {
          controller.start(definition).catch((e: unknown) => console.warn('Could not start the routine', e));
        }}
        style={({ pressed }) => [styles.start, { opacity: pressed ? 0.8 : 1 }]}
      >
        <Text style={styles.startText}>Start</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  live: { flex: 1, padding: 24, gap: 24, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10 },
  stepTitle: { flex: 1, fontSize: 18 },
  duration: { fontSize: 16, opacity: 0.7, fontVariant: ['tabular-nums'] },
  total: { fontSize: 15, opacity: 0.7, textAlign: 'right' },
  start: { backgroundColor: '#FF7A45', borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  startText: { color: '#0E1116', fontSize: 20, fontWeight: '700' },
});
