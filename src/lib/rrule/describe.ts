import type { ByDay, RRule, Weekday } from './types';

const DAY_NAME: Record<Weekday, string> = {
  MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday',
  FR: 'Friday', SA: 'Saturday', SU: 'Sunday',
};

const MONTH_NAME = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ORDINAL = ['', 'first', 'second', 'third', 'fourth', 'fifth'];

/** "1st", "2nd", "23rd". */
function nth(n: number): string {
  const abs = Math.abs(n);
  const suffix = abs % 100 >= 11 && abs % 100 <= 13 ? 'th'
    : abs % 10 === 1 ? 'st' : abs % 10 === 2 ? 'nd' : abs % 10 === 3 ? 'rd' : 'th';
  return `${abs}${suffix}`;
}

/** "Monday, Tuesday and Friday". */
function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function describeByDay(b: ByDay): string {
  if (b.n === 0) return DAY_NAME[b.day];
  if (b.n === -1) return `last ${DAY_NAME[b.day]}`;
  if (b.n < 0) return `${ORDINAL[Math.abs(b.n)] ?? nth(b.n)}-to-last ${DAY_NAME[b.day]}`;
  return `${ORDINAL[b.n] ?? nth(b.n)} ${DAY_NAME[b.day]}`;
}

function describeMonthDay(n: number): string {
  if (n === -1) return 'last day';
  if (n < 0) return `${ORDINAL[Math.abs(n)] ?? nth(n)}-to-last day`;
  return nth(n);
}

/**
 * A plain-English reading of the rule.
 *
 * This is the string that goes in the live region, so it is written to be heard
 * in one pass rather than scanned. That means no parentheses, no abbreviations,
 * and the ending stated last, where a listener expects it.
 */
export function describe(rule: RRule, opts: { timeZone?: string } = {}): string {
  const every = rule.interval === 1 ? '' : `${rule.interval} `;
  const unit = {
    DAILY: rule.interval === 1 ? 'day' : 'days',
    WEEKLY: rule.interval === 1 ? 'week' : 'weeks',
    MONTHLY: rule.interval === 1 ? 'month' : 'months',
    YEARLY: rule.interval === 1 ? 'year' : 'years',
  }[rule.freq];

  let s = `Every ${every}${unit}`;

  if (rule.freq === 'WEEKLY' && rule.byDay?.length) {
    s += ` on ${list(rule.byDay.map((b) => DAY_NAME[b.day]))}`;
  }

  if (rule.freq === 'MONTHLY' || rule.freq === 'YEARLY') {
    if (rule.freq === 'YEARLY' && rule.byMonth?.length) {
      s += ` in ${list(rule.byMonth.map((m) => MONTH_NAME[m - 1]))}`;
    }
    if (rule.byMonthDay?.length && rule.byDay?.length) {
      // The election-day shape: a weekday constrained to a range of dates.
      s += ` on the ${list(rule.byDay.map((b) => DAY_NAME[b.day]))}` +
        ` falling on the ${list(rule.byMonthDay.map(describeMonthDay))}`;
    } else if (rule.byMonthDay?.length) {
      s += ` on the ${list(rule.byMonthDay.map(describeMonthDay))}`;
    } else if (rule.byDay?.length) {
      s += ` on the ${list(rule.byDay.map(describeByDay))}`;
    }
    if (rule.freq === 'MONTHLY' && rule.byMonth?.length) {
      s += `, but only in ${list(rule.byMonth.map((m) => MONTH_NAME[m - 1]))}`;
    }
  }

  if (rule.freq === 'DAILY' && rule.byDay?.length) {
    s += `, but only on ${list(rule.byDay.map((b) => DAY_NAME[b.day]))}`;
  }

  if (rule.bySetPos?.length) {
    const picks = rule.bySetPos.map((p) =>
      p === -1 ? 'the last one' : p < 0 ? `the ${ORDINAL[Math.abs(p)] ?? nth(p)}-to-last one`
        : `the ${ORDINAL[p] ?? nth(p)} one`);
    s += `, taking only ${list(picks)}`;
  }

  if (rule.count !== undefined) {
    s += `, ${rule.count} time${rule.count === 1 ? '' : 's'}`;
  } else if (rule.until) {
    // RFC 5545 stores UNTIL in UTC. Rendering it in the event's own zone avoids
    // telling someone in Sydney their series ends on a date it does not.
    const zone = opts.timeZone ?? 'UTC';
    const label = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, day: 'numeric', month: 'long', year: 'numeric',
    }).format(rule.until);
    s += `, until ${label}`;
  } else {
    s += ', with no end date';
  }

  return s;
}
