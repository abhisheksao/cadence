import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { sessionController } from '@/session';
import type { RecoveryResult } from '@/session/types';

import { ResumePrompt } from './ResumePrompt';

/**
 * On launch, looks for a session the OS killed and offers to resume it over the app (FR-024,
 * FR-025). The record is read synchronously, so the prompt is there on the first frame.
 */
export function LaunchCheck({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<RecoveryResult>(() => sessionController.checkForInterrupted());
  const close = () => setResult({ kind: 'none' });

  const discard = () => {
    close();
    sessionController.discardInterrupted().catch((e: unknown) => console.warn('Could not clear the record', e));
  };

  const resume = () => {
    if (result.kind !== 'resume') return;
    close();
    // Only the sample session exists in this spec; later modes route by modeId.
    router.push('/sample');
    sessionController.resumeInterrupted(result.assessment).catch((e: unknown) => {
      console.warn('Could not resume the session', e);
    });
  };

  return (
    <>
      {children}
      {result.kind === 'none' ? null : (
        // Back closes a resume offer but keeps the record, so the next launch asks again.
        <Modal transparent animationType="fade" visible onRequestClose={result.kind === 'resume' ? close : discard}>
          <View style={styles.backdrop}>
            <ResumePrompt result={result} onResume={resume} onDiscard={discard} onDismiss={discard} />
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#000A' },
});
