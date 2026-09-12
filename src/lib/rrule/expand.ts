import {
  type ExpandResult, type Occurrence, type RRule, JS_TO_WEEKDAY, WEEKDAY_TO_JS,
} from './types';
import {
  type Wall, daysInMonth, formatOffset, instantToWall, wallExists, wallToInstant,
} from './zones';

/** Guard against a rule whose periods never produce a candidate. */
const MAX_PERIODS = 4000;

interface Ymd { year: number; month: number; day: number }

function ymdToJsDay(d: Ymd): number {
  return new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
}

function exists(d: Ymd): boolean {
  return d.day >= 1 && d.day <= daysInMonth(d.year, d.month);
}

function sameYmd(a: Ymd, b: Ymd): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function compareYmd(a: Ymd, b: Ymd): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

function addDays(d: Ymd, n: number): Ymd {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + n));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

function addMonths(d: Ymd, n: number): Ymd {
  const total = (d.year * 12) + (d.month - 1) + n;
  return { year: Math.floor(total / 12), month: (total % 12) + 1, day: d.day };
}

/** Resolves a possibly-negative day of the month, where -1 is the last day. */
function resolveMonthDay(year: number, month: number, n: number): number {
  return n > 0 ? n : daysInMonth(year, month) + n + 1;
}

/** Every date in [year, month] whose weekday matches, in ascending order. */
function weekdayDatesInMonth(year: number, month: number, jsDay: number): Ymd[] {
  const out: Ymd[] = [];
  const total = daysInMonth(year, month);
  for (let day = 1; day <= total; day++) {
    if (ymdToJsDay({ year, month, day }) === jsDay) out.push({ year, month, day });
  }
  return out;
}

/** Start of the week containing `d`, aligned to `wkstJs`. */
function weekStart(d: Ymd, wkstJs: number): Ymd {
  const delta = (ymdToJsDay(d) - wkstJs + 7) % 7;
  return addDays(d, -delta);
}

/**
 * Candidate dates the rule generates inside one period, before BYSETPOS,
 * before the DTSTART floor, and before COUNT or UNTIL.
 *
 * `skipped` collects candidates the rule named that do not exist on the calendar.
 * RFC 5545 section 3.3.10 says such dates are ignored, not clamped, so "the 31st"
 * simply does not fire in a 30-day month. Recording them lets the UI say so
 * instead of leaving the user to notice a missing row.
 */
function candidatesForPeriod(
  rule: RRule, periodStart: Ymd, anchor: Ymd,
  skipped: { reason: string; candidate: string }[],
): Ymd[] {
  const byMonthOk = (m: number) => !rule.byMonth?.length || rule.byMonth.includes(m);
  const plainDays = rule.byDay?.filter((b) => b.n === 0) ?? [];
  const ordinalDays = rule.byDay?.filter((b) => b.n !== 0) ?? [];
  const byDayJs = new Set(plainDays.map((b) => WEEKDAY_TO_JS[b.day]));

  let out: Ymd[] = [];

  if (rule.freq === 'DAILY') {
    const d = periodStart;
    if (!byMonthOk(d.month)) return [];
    if (byDayJs.size && !byDayJs.has(ymdToJsDay(d))) return [];
    if (rule.byMonthDay?.length) {
      const match = rule.byMonthDay.some((n) => resolveMonthDay(d.year, d.month, n) === d.day);
      if (!match) return [];
    }
    out = [d];
  }

  if (rule.freq === 'WEEKLY') {
    const days = byDayJs.size ? [...byDayJs] : [ymdToJsDay(anchor)];
    for (let i = 0; i < 7; i++) {
      const d = addDays(periodStart, i);
      if (!days.includes(ymdToJsDay(d))) continue;
      if (!byMonthOk(d.month)) continue;
      out.push(d);
    }
  }

  if (rule.freq === 'MONTHLY' || rule.freq === 'YEARLY') {
    const months = rule.freq === 'YEARLY'
      ? (rule.byMonth?.length ? [...rule.byMonth] : [anchor.month])
      : [periodStart.month];

    for (const month of months) {
      const year = periodStart.year;
      if (rule.freq === 'MONTHLY' && !byMonthOk(month)) continue;

      const found: Ymd[] = [];

      if (rule.byMonthDay?.length) {
        for (const n of rule.byMonthDay) {
          const day = resolveMonthDay(year, month, n);
          const cand = { year, month, day };
          if (!exists(cand)) {
            skipped.push({
              reason: `${year}-${String(month).padStart(2, '0')} has no day ${n}`,
              candidate: `${year}-${String(month).padStart(2, '0')}-${String(n).padStart(2, '0')}`,
            });
            continue;
          }
          // With both BYMONTHDAY and a plain BYDAY, RFC 5545 intersects them.
          if (byDayJs.size && !byDayJs.has(ymdToJsDay(cand))) continue;
          found.push(cand);
        }
      } else if (ordinalDays.length) {
        for (const b of ordinalDays) {
          const all = weekdayDatesInMonth(year, month, WEEKDAY_TO_JS[b.day]);
          const picked = b.n > 0 ? all[b.n - 1] : all[all.length + b.n];
          if (!picked) {
            skipped.push({
              reason: `${year}-${String(month).padStart(2, '0')} has no ${b.n > 0 ? b.n : 'last'} ${b.day}`,
              candidate: `${year}-${String(month).padStart(2, '0')} ${b.n}${b.day}`,
            });
            continue;
          }
          found.push(picked);
        }
      } else if (byDayJs.size) {
        for (const jsDay of byDayJs) found.push(...weekdayDatesInMonth(year, month, jsDay));
      } else {
        const cand = { year, month, day: anchor.day };
        if (!exists(cand)) {
          skipped.push({
            reason: `${year}-${String(month).padStart(2, '0')} has no day ${anchor.day}`,
            candidate: `${year}-${String(month).padStart(2, '0')}-${anchor.day}`,
          });
        } else found.push(cand);
      }

      out.push(...found);
    }
  }

  // Deduplicate, because BYDAY and BYMONTHDAY can name the same date twice.
  const seen = new Set<string>();
  out = out
    .filter((d) => {
      const k = `${d.year}-${d.month}-${d.day}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort(compareYmd);

  if (rule.bySetPos?.length) {
    const picked: Ymd[] = [];
    for (const pos of rule.bySetPos) {
      const item = pos > 0 ? out[pos - 1] : out[out.length + pos];
      if (item && !picked.some((p) => sameYmd(p, item))) picked.push(item);
    }
    out = picked.sort(compareYmd);
  }

  return out;
}

function advance(rule: RRule, periodStart: Ymd, wkstJs: number): Ymd {
  switch (rule.freq) {
    case 'DAILY': return addDays(periodStart, rule.interval);
    case 'WEEKLY': return addDays(weekStart(periodStart, wkstJs), 7 * rule.interval);
    case 'MONTHLY': return addMonths({ ...periodStart, day: 1 }, rule.interval);
    case 'YEARLY': return { ...periodStart, year: periodStart.year + rule.interval, month: 1, day: 1 };
  }
}

export interface ExpandOptions {
  readonly rule: RRule;
  /** The first occurrence, as an instant. Its wall clock supplies the time of day. */
  readonly dtstart: Date;
  readonly timeZone: string;
  /** How many occurrences to return. The rule may have more; see `truncated`. */
  readonly limit: number;
}

export function expand({ rule, dtstart, timeZone, limit }: ExpandOptions): ExpandResult {
  const startWall = instantToWall(dtstart, timeZone);
  const anchor: Ymd = { year: startWall.year, month: startWall.month, day: startWall.day };
  const wkstJs = WEEKDAY_TO_JS[rule.wkst];

  const occurrences: Occurrence[] = [];
  const skipped: { reason: string; candidate: string }[] = [];

  let periodStart: Ymd =
    rule.freq === 'WEEKLY' ? weekStart(anchor, wkstJs)
    : rule.freq === 'MONTHLY' ? { ...anchor, day: 1 }
    : rule.freq === 'YEARLY' ? { year: anchor.year, month: 1, day: 1 }
    : anchor;

  let periods = 0;
  let truncated = false;
  let prevOffset: string | null = null;
  const hardLimit = rule.count !== undefined ? Math.min(rule.count, limit) : limit;

  while (periods < MAX_PERIODS) {
    periods++;
    const candidates = candidatesForPeriod(rule, periodStart, anchor, skipped);

    for (const c of candidates) {
      if (compareYmd(c, anchor) < 0) continue;

      const wall: Wall = {
        year: c.year, month: c.month, day: c.day,
        hour: startWall.hour, minute: startWall.minute, second: startWall.second,
      };
      // RFC 5545 section 3.3.10: an instance at a nonexistent local time, such as
      // 02:30 on a spring-forward date, MUST be ignored and MUST NOT be counted.
      if (!wallExists(wall, timeZone)) {
        skipped.push({
          reason: `${wall.hour.toString().padStart(2, '0')}:${wall.minute.toString().padStart(2, '0')} does not exist in ${timeZone} that day, the clock moves forward`,
          candidate: `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`,
        });
        continue;
      }

      const instant = wallToInstant(wall, timeZone);

      if (instant.getTime() < dtstart.getTime()) continue;
      if (rule.until && instant.getTime() > rule.until.getTime()) {
        return { occurrences, truncated: false, skipped };
      }

      if (occurrences.length >= hardLimit) {
        // More exist than were asked for. Only "truncated" when the limit, not
        // COUNT, is what stopped it, so the UI can distinguish the two.
        truncated = rule.count === undefined || rule.count > limit;
        return { occurrences, truncated, skipped };
      }

      const offset = formatOffset(instant, timeZone);
      const shift = prevOffset && prevOffset !== offset
        ? { from: prevOffset, to: offset } : undefined;
      prevOffset = offset;

      occurrences.push({
        instant,
        localISO:
          `${String(wall.year).padStart(4, '0')}-${String(wall.month).padStart(2, '0')}` +
          `-${String(wall.day).padStart(2, '0')}T${String(wall.hour).padStart(2, '0')}` +
          `:${String(wall.minute).padStart(2, '0')}:${String(wall.second).padStart(2, '0')}`,
        ...(shift ? { offsetShift: shift } : {}),
      });
    }

    if (rule.count !== undefined && occurrences.length >= rule.count) break;
    periodStart = advance(rule, periodStart, wkstJs);
  }

  if (occurrences.length === 0) {
    return {
      occurrences, truncated: false, skipped,
      impossible: skipped.length
        ? 'This rule names a date that never occurs, so it can never fire.'
        : 'This rule produced no occurrences within the range searched.',
    };
  }

  return { occurrences, truncated, skipped };
}
