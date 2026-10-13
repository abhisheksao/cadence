import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Controls } from '@/components/Controls';
import type { Status } from '@/engine/types';
import { sampleDefinition } from '@/modes/sample';
import { useSession } from '@/session/useSession';

const STATUS_LABEL: Record<Status, string> = {
  idle: 'Ready',
  running: 'Running',
  paused: 'Paused',
  done: 'Done',
  stopped: 'Stopped',
};

/** Runs the sample session (quickstart.md). Fleshed out in User Stories 2 and 5. */
export default function SampleScreen() {
  const { state, controller } = useSession();
  const dark = useColorScheme() === 'dark';
  const color = dark ? '#E6EDF3' : '#0E1116';

  return (
    <View style={styles.container}>
      <Text style={[styles.phase, { color }]}>{state?.phase?.title ?? 'Sample session'}</Text>
      <Text style={[styles.status, { color }]}>{STATUS_LABEL[state?.status ?? 'idle']}</Text>
      {state ? <Controls status={state.status} controls={controller} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start sample"
        onPress={() => {
          controller.start(sampleDefinition()).catch((e: unknown) => console.warn('Could not start the sample', e));
        }}
        style={({ pressed }) => [styles.button, { opacity: pressed ? 0.8 : 1 }]}
      >
        <Text style={styles.buttonText}>Start sample</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  phase: { fontSize: 32, fontWeight: '700', textAlign: 'center' },
  status: { fontSize: 18, opacity: 0.7 },
  button: { backgroundColor: '#FF7A45', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 16 },
  buttonText: { color: '#0E1116', fontSize: 18, fontWeight: '700' },
});
