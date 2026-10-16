import { spawnSync } from 'node:child_process';
import process from 'node:process';

/**
 * Checks if the Maestro CLI is available on the PATH.
 *
 * @param {(cmd: string, args: string[]) => { status: number | null, error?: Error }} [runner]
 * @returns {boolean}
 */
export function checkMaestroInstalled(runner) {
  const run = runner || ((cmd, args) => spawnSync(cmd, args, { stdio: 'pipe' }));
  try {
    const result = run('maestro', ['--version']);
    return result.status === 0 && !result.error;
  } catch {
    return false;
  }
}

/**
 * Runs Maestro test suite with prerequisite checks.
 *
 * @param {string[]} [args]
 * @returns {number} Exit code
 */
export function runE2E(args = process.argv.slice(2)) {
  if (!checkMaestroInstalled()) {
    console.error(`
❌ Maestro CLI is not installed or not in PATH.

To run end-to-end flows locally:
1. Install Maestro CLI:
   curl -FsSL "https://get.maestro.mobile.dev" | bash
2. Ensure an Android emulator or device is connected (adb devices).
3. Run:
   npm run test:e2e
`);
    return 1;
  }

  const target = args.length > 0 ? args : ['.maestro/'];
  const res = spawnSync('maestro', ['test', ...target], { stdio: 'inherit' });
  return res.status ?? 0;
}

if (process.argv[1] && process.argv[1].endsWith('run-e2e.mjs')) {
  process.exit(runE2E());
}
