import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useColorScheme } from 'react-native';

import { Text } from '@/components/Text';
import { StepEditor } from '@/components/StepEditor';
import { UndoBar } from '@/components/UndoBar';
import { MAX_STEPS } from '@/routine/defaults';
import { addStep, deleteStep, moveStep, restoreStep, updateStep, type RemovedStep } from '@/routine/edit';
import { newStepId } from '@/routine/ids';
import { useRoutine } from '@/routine/useRoutine';

/** Edits the routine; every change is saved right away (User Story 2, FR-003–FR-005). */
export default function RoutineEditScreen() {
  const { routine, store } = useRoutine();
  const dark = useColorScheme() === 'dark';
  const color = dark ? '#E6EDF3' : '#0E1116';
  const [removed, setRemoved] = useState<{ step: RemovedStep; key: number } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const count = routine.steps.length;

  const remove = (id: string) => {
    const result = deleteStep(store.get(), id);
    if (!result.removed) return;
    store.update(() => result.routine);
    const step = result.removed;
    setRemoved((prev) => ({ step, key: (prev?.key ?? 0) + 1 }));
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {routine.steps.map((step, i) => (
          <StepEditor
            key={step.id}
            step={step}
            position={i + 1}
            canMoveUp={i > 0}
            canMoveDown={i < count - 1}
            canDelete={count > 1}
            onChange={(patch) => store.update((r) => updateStep(r, step.id, patch))}
            onMove={(dir) => store.update((r) => moveStep(r, step.id, dir))}
            onDelete={() => remove(step.id)}
          />
        ))}

        <TextButton
          label="Add step"
          disabled={count >= MAX_STEPS}
          onPress={() => store.update((r) => addStep(r, newStepId()))}
          primary
        />

        {confirmRestore ? (
          <View testID="restore-confirm" style={styles.confirm}>
            <Text style={[styles.confirmText, { color }]}>Replace your routine with the default one?</Text>
            <View style={styles.confirmRow}>
              <TextButton label="Cancel" onPress={() => setConfirmRestore(false)} />
              <TextButton
                label="Restore"
                primary
                onPress={() => {
                  store.restoreDefault();
                  setRemoved(null);
                  setConfirmRestore(false);
                }}
              />
            </View>
          </View>
        ) : (
          <TextButton label="Restore default routine" onPress={() => setConfirmRestore(true)} />
        )}
      </ScrollView>

      {removed ? (
        <View style={styles.undo}>
          <UndoBar
            key={removed.key}
            onUndo={() => {
              store.update((r) => restoreStep(r, removed.step));
              setRemoved(null);
            }}
            onExpire={() => setRemoved(null)}
          />
        </View>
      ) : null}
    </View>
  );
}

type TextButtonProps = { label: string; onPress: () => void; disabled?: boolean; primary?: boolean };

function TextButton({ label, onPress, disabled = false, primary }: TextButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.primary,
        { opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, primary && styles.primaryText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: 16, gap: 12, paddingBottom: 96 },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#2A313C' },
  primary: { backgroundColor: '#FF7A45' },
  buttonText: { color: '#E6EDF3', fontSize: 16, fontWeight: '700' },
  primaryText: { color: '#0E1116' },
  confirm: { gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#8B949E' },
  confirmText: { fontSize: 16 },
  confirmRow: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  undo: { position: 'absolute', left: 16, right: 16, bottom: 16 },
});
