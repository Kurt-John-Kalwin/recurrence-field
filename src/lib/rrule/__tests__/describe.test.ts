import { describe as suite, expect, it } from 'vitest';
import { parse } from '../parse';
import { describe } from '../describe';

function say(rrule: string, timeZone = 'America/New_York'): string {
  return describe(parse(rrule).rule!, { timeZone });
}

suite('plain-English descriptions', () => {
  const cases: [string, string][] = [
    ['FREQ=DAILY;COUNT=10', 'Every day, 10 times'],
    ['FREQ=DAILY;INTERVAL=2', 'Every 2 days, with no end date'],
    ['FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;COUNT=8', 'Every 2 weeks on Tuesday and Thursday, 8 times'],
    ['FREQ=MONTHLY;BYDAY=1FR;COUNT=10', 'Every month on the first Friday, 10 times'],
    ['FREQ=MONTHLY;BYDAY=-1SU', 'Every month on the last Sunday, with no end date'],
    ['FREQ=MONTHLY;BYDAY=-2MO', 'Every month on the second-to-last Monday, with no end date'],
    ['FREQ=MONTHLY;BYMONTHDAY=-3', 'Every month on the third-to-last day, with no end date'],
    ['FREQ=MONTHLY;BYMONTHDAY=1,-1', 'Every month on the 1st and last day, with no end date'],
    ['FREQ=YEARLY;BYMONTH=6,7', 'Every year in June and July, with no end date'],
    [
      'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-2',
      'Every month on the Monday, Tuesday, Wednesday, Thursday and Friday, taking only the second-to-last one, with no end date',
    ],
  ];

  for (const [rrule, expected] of cases) {
    it(rrule, () => expect(say(rrule)).toBe(expected));
  }

  it('renders UNTIL in the event zone, not UTC', () => {
    // 19971224T000000Z is still 23 December in New York.
    expect(say('FREQ=WEEKLY;UNTIL=19971224T000000Z')).toBe('Every week, until 23 December 1997');
    expect(say('FREQ=WEEKLY;UNTIL=19971224T000000Z', 'UTC')).toBe('Every week, until 24 December 1997');
  });
});
