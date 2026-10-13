import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, View, useColorScheme } from 'react-native';

import { Text, TextInput } from '@/components/Text';
import { MAX_TITLE } from '@/routine/defaults';
import { normaliseDuration } from '@/routine/edit';
import type { Step } from '@/routine/types';

type Props = {
  step: Step;
  /** 1-based position, used in labels. */
  position: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
  onChange: (patch: { title?: string; durationSec?: number | null }) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
};

/** Default length when an untimed step becomes timed (data-model.md). */
const DEFAULT_SEC = 120;

const split = (sec: number) => [String(Math.floor(sec / 60)), String(sec % 60)] as const;

/** One editable step: title, untimed switch, minutes and seconds, move and delete (UI6). */
export function StepEditor({ step, position, canMoveUp, canMoveDown, canDelete, onChange, onMove, onDelete }: Props) {
  const dark = useColorScheme() === 'dark';
  const color = dark ? '#E6EDF3' : '#0E1116';
  const card = dark ? '#1A1F27' : '#F2F4F7';
  const untimed = step.durationSec === null;

  // The typed text, so the user can type freely; it becomes a duration on blur. When the saved
  // duration changes (blur, undo, restore), the fields follow it.
  const [[minutes, seconds], setText] = useState(split(step.durationSec ?? DEFAULT_SEC));
  const [shownDuration, setShownDuration] = useState(step.durationSec);
  if (step.durationSec !== shownDuration) {
    setShownDuration(step.durationSec);
    if (step.durationSec !== null) setText(split(step.durationSec));
  }
  // The duration to go back to when an untimed step becomes timed again.
  const lastTimed = useRef(step.durationSec ?? DEFAULT_SEC);
  useEffect(() => {
    if (step.durationSec !== null) lastTimed.current = step.durationSec;
  }, [step.durationSec]);

  const commit = () => {
    const sec = normaliseDuration(Number(minutes || 0) * 60 + Number(seconds || 0));
    setText(split(sec));
    onChange({ durationSec: sec });
  };

  const label = `Step ${position}`;
  return (
    <View style={[styles.card, { backgroundColor: card }]}>
      <TextInput
        accessibilityLabel={`${label} title`}
        value={step.title}
        placeholder={label}
        placeholderTextColor="#8B949E"
        maxLength={MAX_TITLE}
        onChangeText={(title) => onChange({ title })}
        style={[styles.title, { color }]}
      />
      <View style={styles.row}>
        <Text style={[styles.label, { color }]}>Untimed</Text>
        <Switch
          accessibilityLabel={`${label} untimed`}
          value={untimed}
          onValueChange={(on) => onChange({ durationSec: on ? null : lastTimed.current })}
        />
        {untimed ? null : (
          <View style={styles.duration}>
            <TextInput
              accessibilityLabel={`${label} minutes`}
              value={minutes}
              keyboardType="number-pad"
              maxLength={2}
              onChangeText={(m) => setText([m.replace(/\D/g, ''), seconds])}
              onBlur={commit}
              style={[styles.number, { color }]}
            />
            <Text style={[styles.label, { color }]}>min</Text>
            <TextInput
              accessibilityLabel={`${label} seconds`}
              value={seconds}
              keyboardType="number-pad"
              maxLength={2}
              onChangeText={(s) => setText([minutes, s.replace(/\D/g, '')])}
              onBlur={commit}
              style={[styles.number, { color }]}
            />
            <Text style={[styles.label, { color }]}>s</Text>
          </View>
        )}
      </View>
      <View style={styles.row}>
        <IconButton label={`Move ${label.toLowerCase()} up`} text="↑" disabled={!canMoveUp} onPress={() => onMove(-1)} />
        <IconButton
          label={`Move ${label.toLowerCase()} down`}
          text="↓"
          disabled={!canMoveDown}
          onPress={() => onMove(1)}
        />
        <View style={styles.spacer} />
        <IconButton label={`Delete ${label.toLowerCase()}`} text="Delete" disabled={!canDelete} onPress={onDelete} />
      </View>
    </View>
  );
}

function IconButton({ label, text, disabled, onPress }: { label: string; text: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.icon, { opacity: disabled ? 0.35 : pressed ? 0.7 : 1 }]}
    >
      <Text style={styles.iconText}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 12, gap: 10 },
  title: { fontSize: 18, fontWeight: '600', paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 15, opacity: 0.75 },
  duration: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  number: {
    minWidth: 44,
    fontSize: 18,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderColor: '#8B949E',
    fontVariant: ['tabular-nums'],
  },
  spacer: { flex: 1 },
  icon: { minWidth: 44, minHeight: 40, borderRadius: 10, backgroundColor: '#2A313C', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  iconText: { color: '#E6EDF3', fontSize: 16, fontWeight: '700' },
});
