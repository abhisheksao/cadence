import { router } from 'expo-router';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Controls } from '@/components/Controls';
import { DoneButton } from '@/components/DoneButton';
import { SessionView } from '@/components/SessionView';
import { StepList } from '@/components/StepList';
import { formatClock } from '@/format/clock';
import { ROUTINE_MODE_ID, routineDefinition } from '@/modes/routine';
import { useRoutine } from '@/routine/useRoutine';
import { useKeepScreenOn } from '@/session/useKeepScreenOn';
import { useSession } from '@/session/useSession';

/**
 * Runs the morning routine. Shows the live session while a routine session runs or is paused,
 * an "All done"/"Stopped" view after one, and otherwise the routine with Start and Edit.
 * Sessions of other modes never take over this screen (clarification Q5).
 */
export default function RoutineScreen() {
  const { state, controller } = useSession();
  const { routine } = useRoutine();
  const dark = useColorScheme() === 'dark';
  const color = dark ? '#E6EDF3' : '#0E1116';

  const session = state?.definition.modeId === ROUTINE_MODE_ID ? state : null;
  useKeepScreenOn(session?.definition, session?.status);

  // The definition gives the same titles ("Step N" for blank ones) the session will use.
  const definition = routineDefinition(routine);
  const start = () => {
    controller.start(definition).catch((e: unknown) => console.warn('Could not start the routine', e));
  };

  if (session && (session.status === 'running' || session.status === 'paused')) {
    const untimed = session.phase?.durationSec === null;
    return (
      <ScrollView contentContainerStyle={styles.live}>
        <SessionView state={session} />
        <DoneButton size={untimed ? 'large' : 'compact'} onPress={() => controller.skip()} />
        <Controls status={session.status} controls={controller} />
        <StepList steps={session.definition.phases} currentIndex={session.index} finished={false} />
      </ScrollView>
    );
  }

  const ended = session && (session.status === 'done' || session.status === 'stopped');
  const totalSec = routine.steps.reduce((sum, s) => sum + (s.durationSec ?? 0), 0);

  return (
    <View style={styles.container}>
      {ended ? (
        <View style={styles.ended}>
          <Text style={[styles.endedTitle, { color }]} accessibilityRole="header">
            {session.status === 'done' ? 'All done' : 'Stopped'}
          </Text>
          <StepList steps={session.definition.phases} currentIndex={session.index} finished={session.status === 'done'} />
        </View>
      ) : (
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
      )}
      <View style={styles.footer}>
        <Text style={[styles.total, { color }]}>{`Total ${formatClock(totalSec)}`}</Text>
        {/* Only reachable when no routine session is live (FR-007). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit"
          onPress={() => router.push('/routine/edit')}
          hitSlop={8}
          style={({ pressed }) => [styles.edit, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ended ? 'Start again' : 'Start'}
        onPress={start}
        style={({ pressed }) => [styles.start, { opacity: pressed ? 0.8 : 1 }]}
      >
        <Text style={styles.startText}>{ended ? 'Start again' : 'Start'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  live: { padding: 24, gap: 24, alignItems: 'center' },
  ended: { flex: 1, gap: 16 },
  endedTitle: { fontSize: 32, fontWeight: '700', textAlign: 'center', paddingTop: 8 },
  list: { gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10 },
  stepTitle: { flex: 1, fontSize: 18 },
  duration: { fontSize: 16, opacity: 0.7, fontVariant: ['tabular-nums'] },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  total: { fontSize: 15, opacity: 0.7 },
  edit: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#2A313C' },
  editText: { color: '#E6EDF3', fontSize: 16, fontWeight: '700' },
  start: { backgroundColor: '#FF7A45', borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  startText: { color: '#0E1116', fontSize: 20, fontWeight: '700' },
});
