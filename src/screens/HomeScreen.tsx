import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { BatteryLink } from '@/components/BatteryLink';

type ModeTile = { name: string; description: string; route?: Href };

/** The modes (roadmap). Those without a route are shown as coming soon until they ship (FR-019). */
const MODES: ModeTile[] = [
  { name: 'Morning routine', description: 'A guided set of exercises, each with its own timer.', route: '/routine' },
  { name: 'Run / walk', description: 'Run and walk intervals, cued by voice while you listen to music.' },
  { name: 'Breathe', description: 'Paced breathing with gentle cues for each breath.' },
];

/** Lists the modes and the sample session (User Story 5). */
export default function HomeScreen() {
  const dark = useColorScheme() === 'dark';
  const text = dark ? '#E6EDF3' : '#0E1116';
  const card = dark ? '#1A1F27' : '#F2F4F7';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {MODES.map((mode) => {
        const route = mode.route;
        const header = (
          <View style={styles.cardHeader}>
            <Text style={[styles.name, { color: text }]}>{mode.name}</Text>
            {route ? null : <Text style={styles.soon}>Coming soon</Text>}
          </View>
        );
        const description = (
          <Text testID="mode-description" style={[styles.description, { color: text }]}>
            {mode.description}
          </Text>
        );
        if (!route) {
          return (
            <View
              key={mode.name}
              accessible
              accessibilityLabel={`${mode.name}, coming soon. ${mode.description}`}
              style={[styles.card, { backgroundColor: card }]}
            >
              {header}
              {description}
            </View>
          );
        }
        return (
          <Pressable
            key={mode.name}
            accessibilityRole="button"
            accessibilityLabel={`${mode.name}. ${mode.description}`}
            onPress={() => router.push(route)}
            style={({ pressed }) => [styles.card, { backgroundColor: card, opacity: pressed ? 0.8 : 1 }]}
          >
            {header}
            {description}
          </Pressable>
        );
      })}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sample session. Try every cue and control."
        onPress={() => router.push('/sample')}
        style={({ pressed }) => [styles.card, styles.sample, { opacity: pressed ? 0.8 : 1 }]}
      >
        <Text style={[styles.name, styles.sampleText]}>Sample session</Text>
        <Text style={[styles.description, styles.sampleText]}>Try every cue and control.</Text>
      </Pressable>

      <View style={styles.footer}>
        <BatteryLink />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  card: { borderRadius: 16, padding: 16, gap: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 20, fontWeight: '700' },
  soon: { color: '#FF7A45', fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  description: { fontSize: 15, opacity: 0.75 },
  sample: { backgroundColor: '#FF7A45', marginTop: 8 },
  sampleText: { color: '#0E1116', opacity: 1 },
  footer: { marginTop: 16, alignItems: 'center' },
});
