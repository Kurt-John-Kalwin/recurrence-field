export interface HardCase {
  readonly label: string;
  readonly why: string;
  readonly rrule: string;
  /** ISO local wall time for DTSTART, read in `zone`. */
  readonly start: string;
  readonly zone: string;
}

/**
 * The cases worth arguing about. Each one exists because it broke something, or
 * because the specification says something people assume it does not.
 */
export const HARD_CASES: readonly HardCase[] = [
  {
    label: 'Every month on the 31st',
    why: 'February, April, June, September and November have no 31st. RFC 5545 says those instances are ignored, not moved to the 30th or the 1st.',
    rrule: 'FREQ=MONTHLY;BYMONTHDAY=31',
    start: '2026-01-31T09:00', zone: 'America/New_York',
  },
  {
    label: 'Daily at 02:30 across a spring forward',
    why: 'On 8 March 2026 the US clock jumps from 01:59 to 03:00, so 02:30 does not exist. The spec requires that instance to be ignored and not counted toward COUNT.',
    rrule: 'FREQ=DAILY;COUNT=4',
    start: '2026-03-06T02:30', zone: 'America/New_York',
  },
  {
    label: 'Weekly across a clock change',
    why: 'The wall clock is what the person agreed to, so 09:00 stays 09:00 and the UTC instant moves by an hour instead. One gap between occurrences is 167 hours, not 168.',
    rrule: 'FREQ=WEEKLY;COUNT=4',
    start: '2026-02-25T09:00', zone: 'America/New_York',
  },
  {
    label: 'The second-to-last weekday of the month',
    why: 'BYSETPOS selects from the set a rule already built, so it needs another BY rule to select from. This is the spec’s own worked example.',
    rrule: 'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-2',
    start: '1997-09-29T09:00', zone: 'America/New_York',
  },
  {
    label: 'US election day',
    why: 'The first Tuesday after a Monday in November, expressed by intersecting a weekday with a range of month days. Every four years.',
    rrule: 'FREQ=YEARLY;INTERVAL=4;BYMONTH=11;BYDAY=TU;BYMONTHDAY=2,3,4,5,6,7,8',
    start: '1996-11-05T09:00', zone: 'America/New_York',
  },
  {
    label: 'A rule that can never fire',
    why: 'The 30th of February is legal to write and impossible to schedule. Saying "never" is different from saying "none yet", and the UI has to tell them apart.',
    rrule: 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30',
    start: '2026-01-01T09:00', zone: 'America/New_York',
  },
  {
    label: 'UNTIL is UTC, the UI is not',
    why: 'RFC 5545 stores UNTIL in UTC. Rendered raw, a series ending 24 December 00:00 UTC looks like it ends on the 23rd in New York. The description renders it in the event zone for that reason.',
    rrule: 'FREQ=WEEKLY;UNTIL=19971224T000000Z',
    start: '1997-09-02T09:00', zone: 'America/New_York',
  },
  {
    label: 'Five hundred occurrences',
    why: 'The list virtualises nothing and still renders instantly, which is why there is no web worker in this repo. The commit that deleted the one I built is in the history.',
    rrule: 'FREQ=DAILY;COUNT=500',
    start: '2026-01-01T09:00', zone: 'Asia/Kolkata',
  },
];
