import { checkMaestroInstalled } from './run-e2e.mjs';

describe('run-e2e prerequisite check', () => {
  it('detects when maestro is missing', () => {
    const mockRunner = () => ({ status: 127, error: new Error('ENOENT') });
    expect(checkMaestroInstalled(mockRunner)).toBe(false);
  });

  it('detects when maestro is installed', () => {
    const mockRunner = () => ({ status: 0, stdout: '1.39.0' });
    expect(checkMaestroInstalled(mockRunner)).toBe(true);
  });
});
