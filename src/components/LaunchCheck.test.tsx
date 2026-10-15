import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Text } from 'react-native';

import { sessionController } from '@/session';
import type { RecoveryResult, SessionDefinition } from '@/session/types';

import { LaunchCheck } from './LaunchCheck';

jest.mock('@/session', () => ({
  sessionController: {
    checkForInterrupted: jest.fn(),
    resumeInterrupted: jest.fn(() => Promise.resolve()),
    discardInterrupted: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/modes', () => {
  const routes: Record<string, string> = { sample: '/sample', routine: '/routine', 'run-walk': '/run-walk', breathe: '/breathe' };
  return { modes: { get: (id: string) => (routes[id] ? { id, route: routes[id] } : undefined) } };
});

const controller = jest.mocked(sessionController);

const definition: SessionDefinition = {
  modeId: 'sample',
  title: 'Sample session',
  phases: [{ kind: 'interval', title: 'Interval', durationSec: 20 }],
  settings: {},
  keepScreenOn: true,
};
const resume: RecoveryResult = {
  kind: 'resume',
  assessment: { definition, index: 0, phaseElapsedMs: 5_000, paused: false },
};

async function renderCheck(result: RecoveryResult) {
  controller.checkForInterrupted.mockReturnValue(result);
  await render(
    <LaunchCheck>
      <Text>App stack</Text>
    </LaunchCheck>,
  );
}

describe('LaunchCheck (FR-024, FR-025)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the app directly when there is nothing to recover', async () => {
    await renderCheck({ kind: 'none' });
    expect(screen.getByText('App stack')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
  });

  it('checks for an interrupted session only once', async () => {
    await renderCheck({ kind: 'none' });
    await screen.rerender(
      <LaunchCheck>
        <Text>App stack</Text>
      </LaunchCheck>,
    );
    expect(controller.checkForInterrupted).toHaveBeenCalledTimes(1);
  });

  it('Resume restores the session and opens its screen', async () => {
    await renderCheck(resume);
    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));

    expect(controller.resumeInterrupted).toHaveBeenCalledWith(resume.kind === 'resume' && resume.assessment);
    expect(router.push).toHaveBeenCalledWith('/sample');
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
  });

  it('Resume continues where the clock is at the tap, not where it was when the prompt opened', async () => {
    const later: RecoveryResult = {
      kind: 'resume',
      assessment: { definition, index: 0, phaseElapsedMs: 18_000, paused: false },
    };
    await renderCheck(resume);
    controller.checkForInterrupted.mockReturnValue(later); // 13 s pass on the prompt
    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));

    expect(controller.resumeInterrupted).toHaveBeenCalledWith(later.kind === 'resume' && later.assessment);
  });

  it('Resume shows the interrupted note if the session ended while the prompt was open', async () => {
    await renderCheck(resume);
    controller.checkForInterrupted.mockReturnValue({
      kind: 'interrupted',
      reason: 'finished',
      title: 'Sample session',
      at: 0,
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));

    expect(controller.resumeInterrupted).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'OK' })).toBeOnTheScreen();
  });

  it.each([
    ['routine', '/routine'],
    ['run-walk', '/run-walk'],
    ['breathe', '/breathe'],
    ['gone', '/'],
  ])('Resume of a %s session opens %s', async (modeId, route) => {
    await renderCheck({
      kind: 'resume',
      assessment: { definition: { ...definition, modeId }, index: 0, phaseElapsedMs: 0, paused: false },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Resume' }));
    expect(router.push).toHaveBeenCalledWith(route);
  });

  it('Discard clears the record and closes the prompt', async () => {
    await renderCheck(resume);
    await fireEvent.press(screen.getByRole('button', { name: 'Discard' }));

    expect(controller.discardInterrupted).toHaveBeenCalledTimes(1);
    expect(controller.resumeInterrupted).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull();
  });

  it('OK on an interrupted note clears the record', async () => {
    await renderCheck({ kind: 'interrupted', reason: 'stale', title: 'Sample session', at: 0 });
    await fireEvent.press(screen.getByRole('button', { name: 'OK' }));

    expect(controller.discardInterrupted).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'OK' })).toBeNull();
  });
});
