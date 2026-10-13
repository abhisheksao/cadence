import { Pressable, ScrollView, StyleSheet, View, useColorScheme } from 'react-native';

import { Text } from '@/components/Text';
import { Controls } from '@/components/Controls';
import { RunWalkLiveView } from '@/components/RunWalkLiveView';
import { formatClock } from '@/format/clock';
import { RUN_WALK_MODE_ID, runWalkDefinition } from '@/modes/runWalk';
import { useRunWalk } from '@/runWalk/useRunWalk';
import { useSession } from '@/session/useSession';

/**
 * Runs the run / walk workout. Shows the live workout while a run-walk session runs or is
 * paused, and otherwise the settings with Start. Sessions of other modes never take over this
 * screen (FR-020).
 */
export default function RunWalkScreen() {
  const { state, controller } = useSession();
  const { settings } = useRunWalk();
  const dark = useColorScheme() === 'dark';
  const color = dark ? '#E6EDF3' : '#0E1116';

  const session = state?.definition.modeId === RUN_WALK_MODE_ID ? state : null;

  if (session && (session.status === 'running' || session.status === 'paused')) {
    return (
      <ScrollView contentContainerStyle={styles.live}>
        <RunWalkLiveView state={session} />
        <Controls status={session.status} controls={controller} />
      </ScrollView>
    );
  }

  const definition = runWalkDefinition(settings);
  const totalSec = definition.phases.reduce((sum, p) => sum + (p.durationSec ?? 0), 0);
  const start = () => {
    controller.start(definition).catch((e: unknown) => console.warn('Could not start the workout', e));
  };

  return (
    <View style={styles.container}>
      <View style={styles.settings} />
      <Text style={[styles.total, { color }]}>{`Total ${formatClock(totalSec)}`}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start"
        onPress={start}
        style={({ pressed }) => [styles.start, { opacity: pressed ? 0.8 : 1 }]}
      >
        <Text style={styles.startText}>Start</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  live: { padding: 24, gap: 32, alignItems: 'center' },
  settings: { flex: 1 },
  total: { fontSize: 15, opacity: 0.7, textAlign: 'center' },
  start: { backgroundColor: '#FF7A45', borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  startText: { color: '#0E1116', fontSize: 20, fontWeight: '700' },
});
