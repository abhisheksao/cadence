// Generates the cue sounds in assets/sounds. Run: npm run sounds
// The output is committed, so builds never depend on running this script.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44100;

/** 16-bit mono PCM WAV from samples in [-1, 1]. */
function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); // fmt chunk size
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28); // byte rate
  h.writeUInt16LE(2, 32); // block align
  h.writeUInt16LE(16, 34); // bits per sample
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** Sine tones with a 5 ms attack and exponential decay, so they don't click. */
function tones(parts, gain = 0.6) {
  const out = [];
  for (const { freq, ms } of parts) {
    const n = Math.round((RATE * ms) / 1000);
    for (let i = 0; i < n; i++) {
      const attack = Math.min(1, i / (RATE * 0.005));
      const decay = Math.exp((-4 * i) / n);
      out.push(gain * attack * decay * Math.sin((2 * Math.PI * freq * i) / RATE));
    }
  }
  return out;
}

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');
mkdirSync(dir, { recursive: true });

const sounds = {
  'beep.wav': tones([{ freq: 1000, ms: 110 }]),
  // The last beep before a phase change: higher and longer, so you know the next one is the switch.
  'beep-last.wav': tones([{ freq: 1500, ms: 320 }]),
  'chime.wav': tones([
    { freq: 880, ms: 180 },
    { freq: 1320, ms: 380 },
  ]),
  // Played on a loop while speaking, to hold ducking audio focus (research R3).
  'silence.wav': new Array(RATE).fill(0),
};

for (const [name, samples] of Object.entries(sounds)) {
  writeFileSync(join(dir, name), wav(samples));
  console.log(`wrote assets/sounds/${name}`);
}
