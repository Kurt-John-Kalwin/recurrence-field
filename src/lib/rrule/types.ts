// RFC 5545 section 3.3.10 "Recurrence Rule" and section 3.8.5.3 "Recurrence Rule".
//
// Supported: FREQ, INTERVAL, COUNT, UNTIL, BYDAY (with ordinal), BYMONTHDAY,
// BYMONTH, BYSETPOS, WKST.
//
// Deliberately NOT supported, and this is stated in the README rather than
// discovered by a caller: BYYEARDAY, BYWEEKNO, BYHOUR, BYMINUTE, BYSECOND.
// They are legal RRULE parts. Parsing them and then ignoring them during
// expansion would produce a preview that silently disagrees with the rule,
// which is worse than refusing them, so parse() reports them as unsupported.

export type Freq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/** RFC 5545 orders weekdays from Monday. JS Date.getUTCDay() orders from Sunday. */
export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

export const WEEKDAYS: readonly Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

/** Maps a Weekday to the value JS uses, where Sunday is 0. */
export const WEEKDAY_TO_JS: Record<Weekday, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

export const JS_TO_WEEKDAY: readonly Weekday[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** "1MO" is the first Monday, "-1SU" is the last Sunday. n === 0 means every one. */
export interface ByDay {
  readonly n: number;
  readonly day: Weekday;
}

export interface RRule {
  readonly freq: Freq;
  readonly interval: number;
  readonly count?: number;
  /** RFC 5545 requires UNTIL to be UTC when DTSTART carries a zone. Stored as an instant. */
  readonly until?: Date;
  readonly byDay?: readonly ByDay[];
  readonly byMonthDay?: readonly number[];
  readonly byMonth?: readonly number[];
  readonly bySetPos?: readonly number[];
  readonly wkst: Weekday;
}

export type IssueCode =
  | 'unparseable'
  | 'missing-freq'
  | 'unknown-freq'
  | 'unsupported-part'
  | 'interval-too-small'
  | 'interval-too-large'
  | 'count-and-until'
  | 'count-too-small'
  | 'count-too-large'
  | 'until-before-dtstart'
  | 'empty-byday'
  | 'bad-byday'
  | 'bad-bymonthday'
  | 'bad-bymonth'
  | 'bysetpos-without-byrule'
  | 'impossible';

export interface Issue {
  readonly code: IssueCode;
  /** Which control should own the error message, so the UI can wire aria-describedby. */
  readonly field: 'freq' | 'interval' | 'byday' | 'bymonthday' | 'bymonth' | 'end' | 'rule';
  readonly message: string;
}

export interface Occurrence {
  readonly instant: Date;
  /** Wall-clock ISO in the event zone, which is what the user actually agreed to. */
  readonly localISO: string;
  /** Set when this occurrence's UTC offset differs from the previous one. */
  readonly offsetShift?: { readonly from: string; readonly to: string };
}

export interface ExpandResult {
  readonly occurrences: readonly Occurrence[];
  /** True when the rule has more occurrences than the requested limit. */
  readonly truncated: boolean;
  /**
   * Candidate dates the rule generated that do not exist, for example 31 February.
   * RFC 5545 section 3.3.10 says invalid dates are ignored rather than clamped.
   */
  readonly skipped: readonly { readonly reason: string; readonly candidate: string }[];
  /** Set when the rule is well formed but can never fire. */
  readonly impossible?: string;
}
