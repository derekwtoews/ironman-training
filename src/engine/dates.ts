// Pure helpers on 'YYYY-MM-DD' strings. UTC arithmetic only, so no DST or clock dependence.

const MS_DAY = 86_400_000;

function toMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  return fromMs(toMs(date) + n * MS_DAY);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toMs(to) - toMs(from)) / MS_DAY);
}

/** Monday of the ISO week containing `date`. */
export function weekStart(date: string): string {
  const dow = (new Date(toMs(date)).getUTCDay() + 6) % 7; // Mon=0..Sun=6
  return addDays(date, -dow);
}

/** Inclusive list of days from `from` to `to`. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
