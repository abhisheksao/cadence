import { StyleSheet, Text, View, useColorScheme } from 'react-native';

// Placeholder until the home screen (spec 001, User Story 5).
export default function Home() {
  const dark = useColorScheme() === 'dark';
  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: dark ? '#E6EDF3' : '#0E1116' }]}>Cadence</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 24, fontWeight: '700' },
});
