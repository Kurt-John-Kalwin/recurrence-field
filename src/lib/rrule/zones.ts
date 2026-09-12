// Timezone arithmetic with no date library.
//
// The platform already ships tzdata behind Intl. Bundling a second copy inside a
// demo about timezone craft would be self-refuting, so everything here is built on
// Intl.DateTimeFormat. The cost is that converting a wall-clock time to an instant
// takes two passes instead of a lookup, which is the tradeoff this file exists to make.

export interface Wall {
  year: number; month: number; day: number;
  hour: number; minute: number; second: number;
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

/** The wall-clock reading a person in `timeZone` would see at `instant`. */
export function instantToWall(instant: Date, timeZone: string): Wall {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  // Intl renders midnight as hour 24 in some engines. Normalise it to 0.
  const hour = get('hour');
  return {
    year: get('year'), month: get('month'), day: get('day'),
    hour: hour === 24 ? 0 : hour,
    minute: get('minute'), second: get('second'),
  };
}

function wallToUTCMillis(w: Wall): number {
  // Date.UTC maps years 0-99 onto 1900-1999, which would silently corrupt any
  // rule anchored in the first century. setUTCFullYear is the documented escape.
  const d = new Date(Date.UTC(2000, w.month - 1, w.day, w.hour, w.minute, w.second));
  d.setUTCFullYear(w.year);
  return d.getTime();
}

/** Offset of `timeZone` at `instant`, in milliseconds east of UTC. */
export function getOffsetMs(instant: Date, timeZone: string): number {
  const wall = instantToWall(instant, timeZone);
  return wallToUTCMillis(wall) - instant.getTime();
}

/**
 * The instant at which `wall` occurs in `timeZone`.
 *
 * Two passes, because the offset depends on the instant and the instant depends on
 * the offset. The first guess uses the offset at the naive UTC interpretation; the
 * second corrects it. A third check catches the case where the correction itself
 * crossed a transition, which is what makes spring-forward gaps behave.
 *
 * DST gap (02:30 on a spring-forward day, a time that does not exist): returns the
 * instant the clock jumps to, matching how calendar software schedules it.
 * DST overlap (a time that happens twice in autumn): returns the first, earlier one.
 */
/**
 * Offsets resolved earlier, keyed by zone and UTC day.
 *
 * A zone's offset changes at most a couple of times a year, so the offset that
 * worked for one instant almost always works for the next. The cached value is
 * never trusted: it produces a candidate which is then verified by converting
 * back. A hit costs one Intl call instead of two, a miss costs the full pass,
 * and a wrong cache entry cannot produce a wrong answer.
 */
const dayOffsetCache = new Map<string, number>();

const DAY_MS = 86_400_000;

/**
 * The instant at which `wall` occurs in `timeZone`, and whether that wall time
 * exists at all.
 *
 * Two passes, because the offset depends on the instant and the instant depends
 * on the offset. The first guess uses the offset at the naive UTC reading; the
 * second corrects it.
 *
 * `exists` is false inside a spring-forward gap. RFC 5545 section 3.3.10 requires
 * those instances to be ignored and not counted, so the caller needs to know.
 * Returning both from one function is what keeps the cost down: computing them
 * separately meant resolving the same offset twice per occurrence.
 */
export function resolveWall(wall: Wall, timeZone: string): { instant: Date; exists: boolean } {
  const naive = wallToUTCMillis(wall);
  const dayKey = `${timeZone}|${Math.floor(naive / DAY_MS)}`;

  const matches = (ms: number) => {
    const back = instantToWall(new Date(ms), timeZone);
    return back.day === wall.day && back.hour === wall.hour && back.minute === wall.minute;
  };

  const cached = dayOffsetCache.get(dayKey);
  if (cached !== undefined) {
    const candidate = naive - cached;
    if (matches(candidate)) return { instant: new Date(candidate), exists: true };
  }

  const guess1 = naive - getOffsetMs(new Date(naive), timeZone);
  const offset2 = getOffsetMs(new Date(guess1), timeZone);
  const guess2 = naive - offset2;

  if (guess1 === guess2) {
    dayOffsetCache.set(dayKey, offset2);
    return { instant: new Date(guess1), exists: true };
  }

  // The guesses disagree, so a transition sits between them. Prefer the earlier
  // instant that actually round-trips to the requested wall clock; an overlap in
  // autumn resolves to the first of the two readings.
  const candidates = [guess1, guess2].sort((a, b) => a - b);
  for (const c of candidates) {
    if (matches(c)) return { instant: new Date(c), exists: true };
  }

  // Nothing round-trips, so the wall time falls inside a spring-forward gap.
  return { instant: new Date(candidates[1]), exists: false };
}

/** The instant at which `wall` occurs in `timeZone`. */
export function wallToInstant(wall: Wall, timeZone: string): Date {
  return resolveWall(wall, timeZone).instant;
}

const offsetCache = new Map<string, Intl.DateTimeFormat>();

/** "GMT+05:30" style offset label for `instant` in `timeZone`. */
export function formatOffset(instant: Date, timeZone: string): string {
  let f = offsetCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' });
    offsetCache.set(timeZone, f);
  }
  const part = f.formatToParts(instant).find((p) => p.type === 'timeZoneName');
  return part?.value ?? 'GMT';
}

export function listTimeZones(): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
    .supportedValuesOf;
  if (typeof supported === 'function') return supported('timeZone');
  // Older engines predate supportedValuesOf. Degrade to the resolved zone rather
  // than shipping a hardcoded list that would rot.
  return [Intl.DateTimeFormat().resolvedOptions().timeZone];
}

export function localZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Days in a month, where `month` is 1-based. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Whether `wall` is a real local time in `timeZone`.
 *
 * False inside a spring-forward gap, where the clock jumps over the hour. RFC 5545
 * section 3.3.10 requires such instances to be ignored and not counted, so this is
 * a correctness requirement rather than a nicety: shifting them instead would
 * silently move an appointment and still count it toward COUNT.
 */
export function wallExists(wall: Wall, timeZone: string): boolean {
  return resolveWall(wall, timeZone).exists;
}
