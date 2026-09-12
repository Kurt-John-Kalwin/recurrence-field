import type { ByDay, RRule } from './types';

function pad(n: number, width = 2): string {
  return String(Math.abs(n)).padStart(width, '0');
}

/** RFC 5545 UNTIL is always UTC when DTSTART carries a zone. */
export function formatUntil(d: Date): string {
  return (
    `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function formatByDay(b: ByDay): string {
  return b.n === 0 ? b.day : `${b.n}${b.day}`;
}

/**
 * Serialises in the part order RFC 5545 section 3.3.10 uses in its own examples.
 * Order is not semantically required, but a stable order means the string is
 * diffable and comparable, which matters when it is the stored value.
 */
export function serialize(rule: RRule): string {
  const out: string[] = [`FREQ=${rule.freq}`];

  if (rule.interval !== 1) out.push(`INTERVAL=${rule.interval}`);
  if (rule.count !== undefined) out.push(`COUNT=${rule.count}`);
  if (rule.until !== undefined) out.push(`UNTIL=${formatUntil(rule.until)}`);
  if (rule.byMonth?.length) out.push(`BYMONTH=${rule.byMonth.join(',')}`);
  if (rule.byMonthDay?.length) out.push(`BYMONTHDAY=${rule.byMonthDay.join(',')}`);
  if (rule.byDay?.length) out.push(`BYDAY=${rule.byDay.map(formatByDay).join(',')}`);
  if (rule.bySetPos?.length) out.push(`BYSETPOS=${rule.bySetPos.join(',')}`);
  // WKST only changes meaning for WEEKLY with INTERVAL > 1, so emitting it
  // otherwise is noise in a value people read.
  if (rule.wkst !== 'MO' && rule.freq === 'WEEKLY' && rule.interval > 1) {
    out.push(`WKST=${rule.wkst}`);
  }

  return out.join(';');
}
