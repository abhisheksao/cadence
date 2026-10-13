import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { LaunchCheck } from '@/components/LaunchCheck';

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const background = dark ? '#0E1116' : '#FFFFFF';
  const text = dark ? '#E6EDF3' : '#0E1116';

  return (
    <LaunchCheck>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: background },
          headerTintColor: text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Cadence' }} />
        <Stack.Screen name="sample" options={{ title: 'Sample session' }} />
        <Stack.Screen name="routine/index" options={{ title: 'Morning routine' }} />
      </Stack>
    </LaunchCheck>
  );
}
