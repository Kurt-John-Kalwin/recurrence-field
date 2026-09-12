import {
  type ByDay, type Freq, type Issue, type RRule, type Weekday, WEEKDAYS,
} from './types';

const FREQS: readonly string[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];

/**
 * RFC 5545 parts that are legal but that expand() does not implement.
 * Reported rather than dropped: silently accepting a part and then ignoring it
 * during expansion produces a preview that disagrees with the rule the user saved.
 */
const UNSUPPORTED = ['BYYEARDAY', 'BYWEEKNO', 'BYHOUR', 'BYMINUTE', 'BYSECOND'];

export const MAX_INTERVAL = 999;
export const MAX_COUNT = 500;

export interface ParseResult {
  readonly rule: RRule | null;
  readonly issues: readonly Issue[];
}

/** "19970902T090000Z", or the date-only "19970902". */
function parseUntil(raw: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(raw.trim());
  if (!m) return null;
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = m;
  const dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  dt.setUTCFullYear(+y);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parseByDay(raw: string, issues: Issue[]): ByDay[] | undefined {
  const out: ByDay[] = [];
  for (const token of raw.split(',')) {
    const t = token.trim().toUpperCase();
    if (!t) continue;
    const m = /^([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)$/.exec(t);
    if (!m) {
      issues.push({ code: 'bad-byday', field: 'byday', message: `"${token}" is not a weekday.` });
      continue;
    }
    const n = m[1] ? Number(m[1]) : 0;
    if (m[1] && (n === 0 || n > 53 || n < -53)) {
      issues.push({
        code: 'bad-byday', field: 'byday',
        message: `"${token}" uses an ordinal outside the range the spec allows.`,
      });
      continue;
    }
    out.push({ n, day: m[2] as Weekday });
  }
  return out.length ? out : undefined;
}

function parseIntList(
  raw: string, min: number, max: number, allowNegative: boolean,
  code: Issue['code'], field: Issue['field'], label: string, issues: Issue[],
): number[] | undefined {
  const out: number[] = [];
  for (const token of raw.split(',')) {
    const t = token.trim();
    if (!t) continue;
    const n = Number(t);
    const magnitudeOk = Math.abs(n) >= min && Math.abs(n) <= max;
    if (!Number.isInteger(n) || n === 0 || !magnitudeOk || (!allowNegative && n < 0)) {
      issues.push({ code, field, message: `"${token}" is not a valid ${label}.` });
      continue;
    }
    out.push(n);
  }
  return out.length ? out : undefined;
}

/** Parses an RRULE value, with or without the "RRULE:" prefix. */
export function parse(input: string): ParseResult {
  const issues: Issue[] = [];
  const text = input.trim().replace(/^RRULE:/i, '');

  if (!text) {
    return {
      rule: null,
      issues: [{ code: 'unparseable', field: 'rule', message: 'The rule is empty.' }],
    };
  }

  const parts = new Map<string, string>();
  for (const chunk of text.split(';')) {
    if (!chunk.trim()) continue;
    const eq = chunk.indexOf('=');
    if (eq === -1) {
      issues.push({
        code: 'unparseable', field: 'rule',
        message: `"${chunk}" is not a NAME=VALUE pair.`,
      });
      continue;
    }
    parts.set(chunk.slice(0, eq).trim().toUpperCase(), chunk.slice(eq + 1).trim());
  }

  for (const part of UNSUPPORTED) {
    if (parts.has(part)) {
      issues.push({
        code: 'unsupported-part', field: 'rule',
        message: `${part} is valid RFC 5545 but this builder does not expand it.`,
      });
    }
  }

  const freqRaw = parts.get('FREQ')?.toUpperCase();
  if (!freqRaw) {
    issues.push({ code: 'missing-freq', field: 'freq', message: 'FREQ is required.' });
    return { rule: null, issues };
  }
  if (!FREQS.includes(freqRaw)) {
    issues.push({
      code: 'unknown-freq', field: 'freq',
      message: `FREQ=${freqRaw} is not one of ${FREQS.join(', ')}.`,
    });
    return { rule: null, issues };
  }

  let interval = 1;
  if (parts.has('INTERVAL')) {
    const n = Number(parts.get('INTERVAL'));
    if (!Number.isInteger(n) || n < 1) {
      issues.push({
        code: 'interval-too-small', field: 'interval',
        message: 'INTERVAL must be a whole number of 1 or more.',
      });
    } else if (n > MAX_INTERVAL) {
      issues.push({
        code: 'interval-too-large', field: 'interval',
        message: `INTERVAL above ${MAX_INTERVAL} is refused by this builder.`,
      });
    } else interval = n;
  }

  let count: number | undefined;
  if (parts.has('COUNT')) {
    const n = Number(parts.get('COUNT'));
    if (!Number.isInteger(n) || n < 1) {
      issues.push({
        code: 'count-too-small', field: 'end',
        message: 'COUNT must be a whole number of 1 or more.',
      });
    } else if (n > MAX_COUNT) {
      issues.push({
        code: 'count-too-large', field: 'end',
        message: `This builder caps COUNT at ${MAX_COUNT}.`,
      });
    } else count = n;
  }

  let until: Date | undefined;
  if (parts.has('UNTIL')) {
    const parsed = parseUntil(parts.get('UNTIL')!);
    if (!parsed) {
      issues.push({
        code: 'unparseable', field: 'end',
        message: 'UNTIL must look like 19970902T090000Z.',
      });
    } else until = parsed;
  }

  // RFC 5545 section 3.3.10: "UNTIL and COUNT MUST NOT occur in the same recur".
  if (count !== undefined && until !== undefined) {
    issues.push({
      code: 'count-and-until', field: 'end',
      message: 'A rule may end on a date or after a number of times, not both.',
    });
  }

  const byDay = parts.has('BYDAY') ? parseByDay(parts.get('BYDAY')!, issues) : undefined;
  if (parts.has('BYDAY') && !byDay) {
    issues.push({ code: 'empty-byday', field: 'byday', message: 'BYDAY lists no weekday.' });
  }

  const byMonthDay = parts.has('BYMONTHDAY')
    ? parseIntList(parts.get('BYMONTHDAY')!, 1, 31, true, 'bad-bymonthday', 'bymonthday', 'day of the month', issues)
    : undefined;
  const byMonth = parts.has('BYMONTH')
    ? parseIntList(parts.get('BYMONTH')!, 1, 12, false, 'bad-bymonth', 'bymonth', 'month', issues)
    : undefined;
  const bySetPos = parts.has('BYSETPOS')
    ? parseIntList(parts.get('BYSETPOS')!, 1, 366, true, 'bad-byday', 'byday', 'position', issues)
    : undefined;

  // RFC 5545: BYSETPOS is only meaningful alongside another BYxxx rule part.
  if (bySetPos && !byDay && !byMonthDay && !byMonth) {
    issues.push({
      code: 'bysetpos-without-byrule', field: 'byday',
      message: 'BYSETPOS needs another BY rule to select from.',
    });
  }

  const wkstRaw = parts.get('WKST')?.toUpperCase() as Weekday | undefined;
  const wkst: Weekday = wkstRaw && WEEKDAYS.includes(wkstRaw) ? wkstRaw : 'MO';

  const rule: RRule = {
    freq: freqRaw as Freq,
    interval,
    ...(count !== undefined ? { count } : {}),
    ...(until !== undefined ? { until } : {}),
    ...(byDay ? { byDay } : {}),
    ...(byMonthDay ? { byMonthDay } : {}),
    ...(byMonth ? { byMonth } : {}),
    ...(bySetPos ? { bySetPos } : {}),
    wkst,
  };

  return { rule, issues };
}
