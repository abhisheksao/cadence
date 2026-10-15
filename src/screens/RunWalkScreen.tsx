import { Pressable, ScrollView, StyleSheet, Switch, View, useColorScheme } from 'react-native';

import { Text } from '@/components/Text';
import { Controls } from '@/components/Controls';
import { RunWalkLiveView } from '@/components/RunWalkLiveView';
import { Stepper } from '@/components/Stepper';
import { formatClock } from '@/format/clock';
import { RUN_WALK_MODE_ID, runWalkDefinition } from '@/modes/runWalk';
import {
  PRESETS,
  adjust,
  applyPreset,
  canAdjust,
  matchingPreset,
  totalSec,
} from '@/runWalk/settings';
import { useRunWalk } from '@/runWalk/useRunWalk';
import { useKeepScreenOn } from '@/session/useKeepScreenOn';
import { useSession } from '@/session/useSession';

/**
 * Runs the run / walk workout. Shows the live workout while a run-walk session runs or is
 * paused, and otherwise the settings with Start. Sessions of other modes never take over this
 * screen (FR-020).
 */
export default function RunWalkScreen() {
  const { state, controller } = useSession();
  const { settings, store } = useRunWalk();
  const dark = useColorScheme() === 'dark';
  const color = dark ? '#E6EDF3' : '#0E1116';

  const session = state?.definition.modeId === RUN_WALK_MODE_ID ? state : null;
  const isLive = session && (session.status === 'running' || session.status === 'paused');
  useKeepScreenOn(isLive ? session.definition : undefined, isLive ? session.status : undefined);

  if (isLive) {
    return (
      <ScrollView contentContainerStyle={styles.live}>
        <RunWalkLiveView state={session} />
        <Controls status={session.status} controls={controller} />
      </ScrollView>
    );
  }

  const ended = session && (session.status === 'done' || session.status === 'stopped');
  const currentPreset = matchingPreset(settings);
  const total = totalSec(settings);
  const start = () => {
    controller.start(runWalkDefinition(settings)).catch((e: unknown) => console.warn('Could not start the workout', e));
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
        <View style={styles.presetsGrid}>
          {PRESETS.map((p) => {
            const isSelected = currentPreset?.label === p.label;
            return (
              <Pressable
                key={p.label}
                accessibilityRole="button"
                accessibilityLabel={p.label}
                accessibilityState={{ selected: isSelected }}
                onPress={() => store.update((s) => applyPreset(s, p))}
                style={({ pressed }) => [
                  styles.preset,
                  {
                    backgroundColor: isSelected ? '#FF7A45' : dark ? '#1A1F27' : '#F2F4F7',
                    borderColor: isSelected ? '#FF7A45' : dark ? '#2A313C' : '#D0D7DE',
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.presetText,
                    { color: isSelected ? '#0E1116' : color, fontWeight: isSelected ? '700' : '500' },
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.steppers}>
          <Stepper
            label="Warm-up"
            value={settings.warmupSec === 0 ? 'Off' : formatClock(settings.warmupSec)}
            onChange={(dir) => store.update((s) => adjust(s, 'warmupSec', dir))}
            canDecrease={canAdjust(settings, 'warmupSec', -1)}
            canIncrease={canAdjust(settings, 'warmupSec', 1)}
          />
          <Stepper
            label="Run"
            value={formatClock(settings.runSec)}
            onChange={(dir) => store.update((s) => adjust(s, 'runSec', dir))}
            canDecrease={canAdjust(settings, 'runSec', -1)}
            canIncrease={canAdjust(settings, 'runSec', 1)}
          />
          <Stepper
            label="Walk"
            value={formatClock(settings.walkSec)}
            onChange={(dir) => store.update((s) => adjust(s, 'walkSec', dir))}
            canDecrease={canAdjust(settings, 'walkSec', -1)}
            canIncrease={canAdjust(settings, 'walkSec', 1)}
          />
          <Stepper
            label="Rounds"
            value={String(settings.rounds)}
            onChange={(dir) => store.update((s) => adjust(s, 'rounds', dir))}
            canDecrease={canAdjust(settings, 'rounds', -1)}
            canIncrease={canAdjust(settings, 'rounds', 1)}
          />
          <Stepper
            label="Cool-down"
            value={settings.cooldownSec === 0 ? 'Off' : formatClock(settings.cooldownSec)}
            onChange={(dir) => store.update((s) => adjust(s, 'cooldownSec', dir))}
            canDecrease={canAdjust(settings, 'cooldownSec', -1)}
            canIncrease={canAdjust(settings, 'cooldownSec', 1)}
          />
        </View>

        <View style={styles.switches}>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color }]}>Say the round</Text>
            <Switch
              accessibilityLabel="Say the round"
              value={settings.announceRound}
              onValueChange={(val) => store.update((s) => ({ ...s, announceRound: val }))}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color }]}>Say halfway</Text>
            <Switch
              accessibilityLabel="Say halfway"
              value={settings.halfway}
              onValueChange={(val) => store.update((s) => ({ ...s, halfway: val }))}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color }]}>Say time left</Text>
            <Switch
              accessibilityLabel="Say time left"
              value={settings.timeLeft}
              onValueChange={(val) => store.update((s) => ({ ...s, timeLeft: val }))}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color }]}>Keep screen on</Text>
            <Switch
              accessibilityLabel="Keep screen on"
              value={settings.keepScreenOn}
              onValueChange={(val) => store.update((s) => ({ ...s, keepScreenOn: val }))}
            />
          </View>
        </View>
      </ScrollView>

      <Text style={[styles.total, { color }]}>{`Total ${formatClock(total)}`}</Text>
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
  live: { padding: 24, gap: 32, alignItems: 'center' },
  settings: { flex: 1 },
  settingsContent: { gap: 16 },
  ended: { alignItems: 'center', gap: 4, paddingVertical: 12 },
  endedTitle: { fontSize: 24, fontWeight: '700' },
  endedElapsed: { fontSize: 36, fontWeight: '300', fontVariant: ['tabular-nums'] },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  preset: {
    flexBasis: '48%',
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: { fontSize: 14 },
  steppers: { gap: 4 },
  switches: { gap: 12, paddingTop: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: 16 },
  total: { fontSize: 15, opacity: 0.7, textAlign: 'center' },
  start: { backgroundColor: '#FF7A45', borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  startText: { color: '#0E1116', fontSize: 20, fontWeight: '700' },
});


