import { renderHook } from '@testing-library/react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import type { Status } from '@/engine/types';

import type { SessionDefinition } from './types';
import { KEEP_AWAKE_TAG, useKeepScreenOn } from './useKeepScreenOn';

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));

const activate = jest.mocked(activateKeepAwakeAsync);
const deactivate = jest.mocked(deactivateKeepAwake);

const definition = (keepScreenOn: boolean): SessionDefinition => ({
  modeId: 'sample',
  title: 'Sample session',
  phases: [{ kind: 'step', title: 'Step', durationSec: 10 }],
  settings: {},
  keepScreenOn,
});

type Props = { definition: SessionDefinition | undefined; status: Status | undefined };

async function renderKeepScreenOn(initial: Props) {
  return renderHook((props: Props) => useKeepScreenOn(props.definition, props.status), {
    initialProps: initial,
  });
}

describe('useKeepScreenOn (FR-021a)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps the screen on while a keepScreenOn session runs or is paused', async () => {
    const def = definition(true);
    const hook = await renderKeepScreenOn({ definition: def, status: 'running' });
    expect(activate).toHaveBeenCalledWith(KEEP_AWAKE_TAG);

    await hook.rerender({ definition: def, status: 'paused' });
    expect(deactivate).not.toHaveBeenCalled();
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it.each(['done', 'stopped'] as const)('lets the screen sleep once the session is %s', async (status) => {
    const def = definition(true);
    const hook = await renderKeepScreenOn({ definition: def, status: 'running' });
    await hook.rerender({ definition: def, status });
    expect(deactivate).toHaveBeenCalledWith(KEEP_AWAKE_TAG);
  });

  it('lets the screen sleep when the user leaves the screen', async () => {
    const hook = await renderKeepScreenOn({ definition: definition(true), status: 'running' });
    await hook.unmount();
    expect(deactivate).toHaveBeenCalledWith(KEEP_AWAKE_TAG);
  });

  it('never keeps the screen on when the session does not ask for it', async () => {
    const def = definition(false);
    const hook = await renderKeepScreenOn({ definition: def, status: 'running' });
    await hook.rerender({ definition: def, status: 'paused' });
    expect(activate).not.toHaveBeenCalled();
  });

  it('does nothing without a session', async () => {
    await renderKeepScreenOn({ definition: undefined, status: undefined });
    expect(activate).not.toHaveBeenCalled();
  });
});
