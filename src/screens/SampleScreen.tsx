import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Controls } from '@/components/Controls';
import { SessionView } from '@/components/SessionView';
import { sampleDefinition, soakDefinition } from '@/modes/sample';
import type { SessionDefinition } from '@/session/types';
import { useKeepScreenOn } from '@/session/useKeepScreenOn';
import { useSession } from '@/session/useSession';

/** Runs the sample session or the 60-minute soak (quickstart.md, User Story 5). */
export default function SampleScreen() {
  const { state, controller } = useSession();
  useKeepScreenOn(state?.definition, state?.status);
  const live = state?.status === 'running' || state?.status === 'paused';

  const start = (definition: SessionDefinition) => {
    controller.start(definition).catch((e: unknown) => console.warn('Could not start the session', e));
  };

  return (
    <View style={styles.container}>
      {state ? <SessionView state={state} /> : null}
      {state?.backgroundWarning ? (
        <Text style={styles.warning}>Cues may stop when the screen is off</Text>
      ) : null}
      {state ? <Controls status={state.status} controls={controller} /> : null}
      {live ? null : (
        <View style={styles.starts}>
          <StartButton label="Start sample" onPress={() => start(sampleDefinition())} primary />
          <StartButton label="Start 60-minute soak" onPress={() => start(soakDefinition())} />
        </View>
      )}
    </View>
  );
}

function StartButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
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
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 },
  warning: { color: '#E5A00D', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  starts: { gap: 12, alignSelf: 'stretch' },
  button: { backgroundColor: '#2A313C', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 16, alignItems: 'center' },
  primary: { backgroundColor: '#FF7A45' },
  buttonText: { color: '#E6EDF3', fontSize: 18, fontWeight: '700' },
  primaryText: { color: '#0E1116' },
});
