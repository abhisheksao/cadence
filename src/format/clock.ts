const pad = (n: number) => String(n).padStart(2, '0');

/** Whole seconds as m:ss, or h:mm:ss from an hour up. Fractions are dropped. */
export function formatClock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3_600);
  const m = Math.floor((total % 3_600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The same duration for screen readers, e.g. "1 minute 15 seconds". */
export function spokenDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3_600);
  const m = Math.floor((total % 3_600) / 60);
  const s = total % 60;
  const parts = [h > 0 && unit(h, 'hour'), m > 0 && unit(m, 'minute'), (s > 0 || total === 0) && unit(s, 'second')];
  return parts.filter(Boolean).join(' ');
}
