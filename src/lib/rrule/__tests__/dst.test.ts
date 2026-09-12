import { describe, expect, it } from 'vitest';
import { parse } from '../parse';
import { expand } from '../expand';
import { formatOffset, instantToWall, wallExists, wallToInstant } from '../zones';

const NY = 'America/New_York';
const SYDNEY = 'Australia/Sydney';
const KOLKATA = 'Asia/Kolkata';

function at(zone: string, y: number, mo: number, d: number, h: number, mi = 0): Date {
  return wallToInstant({ year: y, month: mo, day: d, hour: h, minute: mi, second: 0 }, zone);
}

function run(rrule: string, start: Date, zone: string, limit = 10) {
  return expand({ rule: parse(rrule).rule!, dtstart: start, timeZone: zone, limit });
}

describe('spring forward', () => {
  // In 2026 US DST begins on March 8. The clock goes 01:59:59 to 03:00:00,
  // so 02:30 never happens that day.
  it('02:30 does not exist on the transition date', () => {
    expect(wallExists({ year: 2026, month: 3, day: 8, hour: 2, minute: 30, second: 0 }, NY)).toBe(false);
    expect(wallExists({ year: 2026, month: 3, day: 7, hour: 2, minute: 30, second: 0 }, NY)).toBe(true);
    expect(wallExists({ year: 2026, month: 3, day: 9, hour: 2, minute: 30, second: 0 }, NY)).toBe(true);
  });

  it('a daily 02:30 rule ignores the gap day and does not count it', () => {
    const res = run('FREQ=DAILY;COUNT=4', at(NY, 2026, 3, 6, 2, 30), NY);
    const days = res.occurrences.map((o) => o.localISO.slice(0, 10));

    // March 8 is absent, and COUNT=4 still yields four real occurrences.
    expect(days).toEqual(['2026-03-06', '2026-03-07', '2026-03-09', '2026-03-10']);
    expect(res.skipped.map((s) => s.candidate)).toContain('2026-03-08');
    expect(res.skipped[0].reason).toMatch(/clock moves forward/);
  });

  it('every occurrence keeps the same wall-clock time', () => {
    const res = run('FREQ=DAILY;COUNT=4', at(NY, 2026, 3, 6, 2, 30), NY);
    for (const o of res.occurrences) expect(o.localISO.slice(11)).toBe('02:30:00');
  });
});

describe('the wall clock is what the user agreed to', () => {
  it('09:00 stays 09:00 across the transition while the instant shifts', () => {
    const res = run('FREQ=WEEKLY;COUNT=3', at(NY, 2026, 2, 25, 9), NY);
    for (const o of res.occurrences) expect(o.localISO.slice(11)).toBe('09:00:00');

    const gaps = res.occurrences.slice(1).map((o, i) =>
      (o.instant.getTime() - res.occurrences[i].instant.getTime()) / 3_600_000);

    // Seven days is 168 hours, except across spring forward where it is 167.
    expect(gaps).toContain(167);
    expect(res.occurrences.some((o) => o.offsetShift)).toBe(true);
  });

  it('reports the offset change so the UI can label it', () => {
    const res = run('FREQ=WEEKLY;COUNT=3', at(NY, 2026, 2, 25, 9), NY);
    const shifted = res.occurrences.find((o) => o.offsetShift)!;
    expect(shifted.offsetShift!.from).toBe('GMT-05:00');
    expect(shifted.offsetShift!.to).toBe('GMT-04:00');
  });
});

describe('fall back', () => {
  // On 2026-11-01 the US clock repeats 01:00 to 02:00, so 01:30 happens twice.
  it('an ambiguous local time resolves to the earlier instant', () => {
    const instant = at(NY, 2026, 11, 1, 1, 30);
    expect(instantToWall(instant, NY).hour).toBe(1);
    // The earlier of the two is still on daylight time.
    expect(formatOffset(instant, NY)).toBe('GMT-04:00');
  });
});

describe('zones that are not the United States', () => {
  it('handles a half-hour offset', () => {
    const res = run('FREQ=DAILY;COUNT=3', at(KOLKATA, 2026, 6, 1, 14, 15), KOLKATA);
    expect(res.occurrences.map((o) => o.localISO)).toEqual([
      '2026-06-01T14:15:00', '2026-06-02T14:15:00', '2026-06-03T14:15:00',
    ]);
    expect(formatOffset(res.occurrences[0].instant, KOLKATA)).toBe('GMT+05:30');
  });

  it('handles southern-hemisphere DST, which moves the other way', () => {
    // Sydney leaves DST on 2026-04-05, so its offset drops from +11 to +10.
    const res = run('FREQ=WEEKLY;COUNT=3', at(SYDNEY, 2026, 3, 29, 10), SYDNEY);
    for (const o of res.occurrences) expect(o.localISO.slice(11)).toBe('10:00:00');
    const shifted = res.occurrences.find((o) => o.offsetShift);
    expect(shifted?.offsetShift).toEqual({ from: 'GMT+11:00', to: 'GMT+10:00' });
  });
});

describe('invalid dates are ignored, not clamped', () => {
  it('the 31st simply does not fire in a 30-day month', () => {
    const res = run('FREQ=MONTHLY;BYMONTHDAY=31;COUNT=4', at(NY, 2026, 1, 31, 9), NY);
    expect(res.occurrences.map((o) => o.localISO.slice(0, 10))).toEqual([
      '2026-01-31', '2026-03-31', '2026-05-31', '2026-07-31',
    ]);
    // February, April and June are recorded rather than silently missing.
    expect(res.skipped.some((s) => s.candidate.startsWith('2026-02'))).toBe(true);
  });

  it('a rule that can never fire says so', () => {
    const res = run('FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30', at(NY, 2026, 1, 1, 9), NY);
    expect(res.occurrences).toHaveLength(0);
    expect(res.impossible).toMatch(/never/);
  });
});
