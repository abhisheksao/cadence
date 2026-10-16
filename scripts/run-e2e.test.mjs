import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkMaestroInstalled } from './run-e2e.mjs';

describe('run-e2e prerequisite check', () => {
  it('detects when maestro is missing', () => {
    const mockRunner = () => ({ status: 127, error: new Error('ENOENT') });
    assert.equal(checkMaestroInstalled(mockRunner), false);
  });

  it('detects when maestro is installed', () => {
    const mockRunner = () => ({ status: 0, stdout: '1.39.0' });
    assert.equal(checkMaestroInstalled(mockRunner), true);
  });
});
