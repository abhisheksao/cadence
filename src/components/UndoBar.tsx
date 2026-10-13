import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** How long Undo is offered after a delete (clarification Q4). */
export const UNDO_MS = 5_000;

type Props = { onUndo: () => void; onExpire: () => void };

/** "Step deleted · Undo" (UI7). Give it a new `key` per delete to restart the 5 s. */
export function UndoBar({ onUndo, onExpire }: Props) {
  useEffect(() => {
    const id = setTimeout(onExpire, UNDO_MS);
    return () => clearTimeout(id);
    // Restart only for a new delete (a new key remounts this), not when the callbacks change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.bar} accessibilityLiveRegion="polite">
      <Text style={styles.text}>Step deleted</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Undo" onPress={onUndo} hitSlop={8}>
        <Text style={styles.undo}>Undo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2A313C',
  },
  text: { color: '#E6EDF3', fontSize: 16 },
  undo: { color: '#FF7A45', fontSize: 16, fontWeight: '700' },
});
