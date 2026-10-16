import { Pressable, ScrollView, StyleSheet, Switch, View, useColorScheme } from 'react-native';

import { BreatheLiveView } from '@/components/BreatheLiveView';
import { Controls } from '@/components/Controls';
import { Stepper } from '@/components/Stepper';
import { Text } from '@/components/Text';
import {
  PRESETS,
  adjust,
  applyPreset,
  calculateCycles,
  canAdjust,
  matchingPreset,
  totalSec,
} from '@/breathe/settings';
import type { BreatheCueStyle } from '@/breathe/types';
import { useBreathe } from '@/breathe/useBreathe';
import { formatClock } from '@/format/clock';
import { BREATHE_MODE_ID, breatheDefinition } from '@/modes/breathe';
import { useKeepScreenOn } from '@/session/useKeepScreenOn';
import { useSession } from '@/session/useSession';

const CUE_STYLES: readonly { id: BreatheCueStyle; label: string }[] = [
  { id: 'voice', label: 'Voice' },
  { id: 'count', label: 'Count' },
  { id: 'tones', label: 'Tones' },
];

export default function BreatheScreen() {
  const { state, controller } = useSession();
  const { settings, store } = useBreathe();
  const dark = useColorScheme() === 'dark';
  const color = dark ? '#E6EDF3' : '#0E1116';
  const card = dark ? '#1A1F27' : '#F2F4F7';

  const session = state?.definition.modeId === BREATHE_MODE_ID ? state : null;
  const isLive = session && (session.status === 'running' || session.status === 'paused');
  useKeepScreenOn(isLive ? session.definition : undefined, isLive ? session.status : undefined);

  if (isLive) {
    return (
      <ScrollView contentContainerStyle={styles.live}>
        <BreatheLiveView state={session} />
        <Controls status={session.status} controls={controller} />
      </ScrollView>
    );
  }

  const ended = session && (session.status === 'done' || session.status === 'stopped');
  const currentPreset = matchingPreset(settings);
  const cycles = calculateCycles(settings);
  const total = totalSec(settings);

  const start = () => {
    controller.start(breatheDefinition(settings)).catch((e: unknown) => {
      console.warn('Could not start breathe session', e);
    });
  };

  return (
    <View style={styles.container}>
      {ended ? (
        <View style={styles.ended}>
          <Text style={[styles.endedTitle, { color }]} accessibilityRole="header">
            {session.status === 'done' ? 'Complete' : 'Stopped'}
          </Text>
          <Text style={[styles.endedElapsed, { color }]}>
            {formatClock(Math.floor(session.totalElapsedMs / 1_000))}
          </Text>
        </View>
      ) : null}

      <ScrollView style={styles.settings} contentContainerStyle={styles.settingsContent}>
        <View style={styles.presetsRow}>
          {PRESETS.map((p) => {
            const active = currentPreset?.id === p.id;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`${p.name}${active ? ', selected' : ''}`}
                onPress={() => store.update((s) => applyPreset(s, p))}
                style={[styles.preset, active ? styles.presetActive : { backgroundColor: card }]}
              >
                <Text style={[styles.presetText, { color: active ? '#FFFFFF' : color }]}>
                  {p.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.steppers}>
          <Stepper
            label="Duration"
            value={`${settings.targetMinutes} min`}
            canDecrease={canAdjust(settings, 'targetMinutes', -1)}
            canIncrease={canAdjust(settings, 'targetMinutes', 1)}
            onChange={(dir) => store.update((s) => adjust(s, 'targetMinutes', dir))}
          />
          <Stepper
            label="Inhale"
            value={`${settings.inhaleSec}s`}
            canDecrease={canAdjust(settings, 'inhaleSec', -1)}
            canIncrease={canAdjust(settings, 'inhaleSec', 1)}
            onChange={(dir) => store.update((s) => adjust(s, 'inhaleSec', dir))}
          />
          <Stepper
            label="Hold"
            value={settings.holdSec === 0 ? 'Off' : `${settings.holdSec}s`}
            canDecrease={canAdjust(settings, 'holdSec', -1)}
            canIncrease={canAdjust(settings, 'holdSec', 1)}
            onChange={(dir) => store.update((s) => adjust(s, 'holdSec', dir))}
          />
          <Stepper
            label="Exhale"
            value={`${settings.exhaleSec}s`}
            canDecrease={canAdjust(settings, 'exhaleSec', -1)}
            canIncrease={canAdjust(settings, 'exhaleSec', 1)}
            onChange={(dir) => store.update((s) => adjust(s, 'exhaleSec', dir))}
          />
          <Stepper
            label="Post-hold"
            value={settings.postHoldSec === 0 ? 'Off' : `${settings.postHoldSec}s`}
            canDecrease={canAdjust(settings, 'postHoldSec', -1)}
            canIncrease={canAdjust(settings, 'postHoldSec', 1)}
            onChange={(dir) => store.update((s) => adjust(s, 'postHoldSec', dir))}
          />
        </View>

        <View style={styles.switches}>
          <View style={styles.styleSelector}>
            <Text style={[styles.switchLabel, { color }]}>Cue audio</Text>
            <View style={styles.styleOptions}>
              {CUE_STYLES.map((cs) => {
                const active = settings.cueStyle === cs.id;
                return (
                  <Pressable
                    key={cs.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${cs.label} audio cues${active ? ', selected' : ''}`}
                    onPress={() => store.update((s) => ({ ...s, cueStyle: cs.id }))}
                    style={[styles.styleChip, active ? styles.styleChipActive : { backgroundColor: card }]}
                  >
                    <Text style={[styles.styleChipText, { color: active ? '#FFFFFF' : color }]}>
                      {cs.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color }]}>Get-ready countdown (5s)</Text>
            <Switch
              value={settings.prepEnabled}
              onValueChange={(prepEnabled) => store.update((s) => ({ ...s, prepEnabled }))}
              accessibilityLabel="Get-ready countdown"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color }]}>Keep screen on</Text>
            <Switch
              value={settings.keepScreenOn}
              onValueChange={(keepScreenOn) => store.update((s) => ({ ...s, keepScreenOn }))}
              accessibilityLabel="Keep screen on"
            />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: card }]}>
        <View style={styles.summaryContainer}>
          <Text style={[styles.total, { color }]}>
            {`Target: ${settings.targetMinutes} min • ${cycles} cycles • Total ${formatClock(total)}`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ended ? 'Start again' : 'Start'}
          onPress={start}
          style={styles.startButton}
        >
          <Text style={styles.startText}>{ended ? 'Start again' : 'Start'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  live: { flexGrow: 1, justifyContent: 'space-around', alignItems: 'center', padding: 24 },
  ended: { alignItems: 'center', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#CCCCCC' },
  endedTitle: { fontSize: 24, fontWeight: '700' },
  endedElapsed: { fontSize: 32, fontVariant: ['tabular-nums'] },
  settings: { flex: 1 },
  settingsContent: { padding: 16, gap: 16 },
  presetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20 },
  presetActive: { backgroundColor: '#0284C7' },
  presetText: { fontSize: 14, fontWeight: '600' },
  steppers: { gap: 12 },
  switches: { gap: 14, marginTop: 8 },
  styleSelector: { gap: 8 },
  styleOptions: { flexDirection: 'row', gap: 8 },
  styleChip: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  styleChipActive: { backgroundColor: '#0284C7' },
  styleChipText: { fontSize: 14, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: 16 },
  footer: { padding: 16, borderTopWidth: 1, gap: 12 },
  summaryContainer: { alignItems: 'center' },
  total: { fontSize: 15, fontWeight: '500', opacity: 0.8 },
  startButton: { backgroundColor: '#0284C7', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  startText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
});
