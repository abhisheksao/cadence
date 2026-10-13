#!/usr/bin/env node
/**
 * Reads a captured cue log and reports timing accuracy per cue type (FR-022b,
 * contracts/timing-log.md). Exit code 1 when SC-001 or SC-002 is not met, unless --no-fail.
 *
 *   adb logcat -s ReactNativeJS:I | grep CADENCE_CUE > cues.log
 *   node scripts/timing-report.mjs cues.log
 */
import { readFileSync } from 'node:fs';

const TYPES = ['beep', 'beepLast', 'chime', 'say'];
/** SC-001: p95 of |err| per type, in ms. Sounds 150, speech 300. */
const LIMIT_MS = { beep: 150, beepLast: 150, chime: 150, say: 300 };
/** SC-002: the last 5 minutes may be at most this much worse than the first 5. */
const DRIFT_LIMIT_MS = 50;
const WINDOW_MS = 5 * 60_000;

const LINE = /CADENCE_CUE v=1 type=(\w+) planned=(-?\d+) actual=(-?\d+) err=(-?\d+) phase=(\d+)\s*$/;

/** One cue from a log line, or null for any other line. */
export function parseLine(line) {
  const m = LINE.exec(line);
  if (!m || !TYPES.includes(m[1])) return null;
  const [planned, actual, err, phase] = m.slice(2).map(Number);
  return { type: m[1], planned, actual, err, phase };
}

/** Nearest-rank percentile of a non-empty list. */
export function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

const p95 = (cues) => (cues.length === 0 ? null : percentile(cues.map((c) => Math.abs(c.err)), 95));

/** Per-type stats and the list of SC-001/SC-002 failures for the given log lines. */
export function analyse(lines) {
  const cues = lines.map(parseLine).filter(Boolean);
  if (cues.length === 0) return { types: {}, failures: ['no CADENCE_CUE lines found'], ok: false };

  const start = Math.min(...cues.map((c) => c.planned));
  const end = Math.max(...cues.map((c) => c.planned));
  const types = {};
  const failures = [];

  for (const type of TYPES) {
    const ofType = cues.filter((c) => c.type === type);
    if (ofType.length === 0) continue;
    const errs = ofType.map((c) => Math.abs(c.err));
    const stats = {
      count: ofType.length,
      p50: percentile(errs, 50),
      p95: percentile(errs, 95),
      firstP95: p95(ofType.filter((c) => c.planned <= start + WINDOW_MS)),
      lastP95: p95(ofType.filter((c) => c.planned >= end - WINDOW_MS)),
    };
    types[type] = stats;

    if (stats.p95 > LIMIT_MS[type]) failures.push(`${type} p95 ${stats.p95} ms > ${LIMIT_MS[type]} ms (SC-001)`);
    if (stats.firstP95 !== null && stats.lastP95 !== null) {
      const drift = stats.lastP95 - stats.firstP95;
      if (drift > DRIFT_LIMIT_MS) failures.push(`${type} drift ${drift} ms > ${DRIFT_LIMIT_MS} ms (SC-002)`);
    }
  }
  return { types, failures, ok: failures.length === 0 };
}

function format(report) {
  const cell = (v) => (v === null ? '-' : String(v)).padStart(9);
  const rows = Object.entries(report.types).map(
    ([type, s]) => `${type.padEnd(9)}${cell(s.count)}${cell(s.p50)}${cell(s.p95)}${cell(s.firstP95)}${cell(s.lastP95)}`,
  );
  const header = `${'type'.padEnd(9)}${['count', 'p50', 'p95', 'first5', 'last5'].map(cell).join('')}`;
  const result = report.ok ? 'PASS' : `FAIL\n${report.failures.map((f) => `  - ${f}`).join('\n')}`;
  return [`|err| in ms`, header, ...rows, '', result].join('\n');
}

function main(argv) {
  const noFail = argv.includes('--no-fail');
  const file = argv.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Usage: node scripts/timing-report.mjs <cues.log> [--no-fail]');
    return 2;
  }
  const report = analyse(readFileSync(file, 'utf8').split('\n'));
  console.log(format(report));
  return report.ok || noFail ? 0 : 1;
}

// Run as a CLI, not when imported by the tests.
if (process.argv[1]?.endsWith('timing-report.mjs')) process.exitCode = main(process.argv.slice(2));
