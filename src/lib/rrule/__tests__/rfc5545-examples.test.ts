import { describe, expect, it } from 'vitest';
import { parse } from '../parse';
import { serialize } from '../serialize';
import { expand } from '../expand';
import { wallToInstant } from '../zones';

// The worked examples in RFC 5545 section 3.8.5.3. These are the specification's
// own answers, not answers this implementation produced and then froze, which is
// the whole point of using them: they can disagree with the code.
//
// Every example below uses DTSTART;TZID=America/New_York as the RFC does.

const NY = 'America/New_York';

function dtstart(y: number, mo: number, d: number, h = 9, mi = 0): Date {
  return wallToInstant({ year: y, month: mo, day: d, hour: h, minute: mi, second: 0 }, NY);
}

/** Local calendar dates of the occurrences, as YYYY-MM-DD. */
function dates(rrule: string, start: Date, limit = 30): string[] {
  const { rule, issues } = parse(rrule);
  expect(issues.filter((i) => i.code !== 'unsupported-part')).toEqual([]);
  expect(rule).not.toBeNull();
  return expand({ rule: rule!, dtstart: start, timeZone: NY, limit })
    .occurrences.map((o) => o.localISO.slice(0, 10));
}

describe('RFC 5545 section 3.8.5.3 worked examples', () => {
  it('Daily for 10 occurrences', () => {
    expect(dates('FREQ=DAILY;COUNT=10', dtstart(1997, 9, 2))).toEqual([
      '1997-09-02', '1997-09-03', '1997-09-04', '1997-09-05', '1997-09-06',
      '1997-09-07', '1997-09-08', '1997-09-09', '1997-09-10', '1997-09-11',
    ]);
  });

  it('Every other day, first six', () => {
    expect(dates('FREQ=DAILY;INTERVAL=2', dtstart(1997, 9, 2), 6)).toEqual([
      '1997-09-02', '1997-09-04', '1997-09-06', '1997-09-08', '1997-09-10', '1997-09-12',
    ]);
  });

  it('Every 10 days, 5 occurrences', () => {
    expect(dates('FREQ=DAILY;INTERVAL=10;COUNT=5', dtstart(1997, 9, 2))).toEqual([
      '1997-09-02', '1997-09-12', '1997-09-22', '1997-10-02', '1997-10-12',
    ]);
  });

  it('Weekly for 10 occurrences', () => {
    expect(dates('FREQ=WEEKLY;COUNT=10', dtstart(1997, 9, 2))).toEqual([
      '1997-09-02', '1997-09-09', '1997-09-16', '1997-09-23', '1997-09-30',
      '1997-10-07', '1997-10-14', '1997-10-21', '1997-10-28', '1997-11-04',
    ]);
  });

  it('Weekly until December 24 1997', () => {
    const got = dates('FREQ=WEEKLY;UNTIL=19971224T000000Z', dtstart(1997, 9, 2), 40);
    expect(got[0]).toBe('1997-09-02');
    expect(got[got.length - 1]).toBe('1997-12-23');
    expect(got).toHaveLength(17);
  });

  it('Every other week on Tuesday and Thursday for 8 occurrences', () => {
    expect(dates('FREQ=WEEKLY;INTERVAL=2;COUNT=8;WKST=SU;BYDAY=TU,TH', dtstart(1997, 9, 2))).toEqual([
      '1997-09-02', '1997-09-04', '1997-09-16', '1997-09-18',
      '1997-09-30', '1997-10-02', '1997-10-14', '1997-10-16',
    ]);
  });

  it('Monthly on the first Friday for 10 occurrences', () => {
    expect(dates('FREQ=MONTHLY;COUNT=10;BYDAY=1FR', dtstart(1997, 9, 5))).toEqual([
      '1997-09-05', '1997-10-03', '1997-11-07', '1997-12-05', '1998-01-02',
      '1998-02-06', '1998-03-06', '1998-04-03', '1998-05-01', '1998-06-05',
    ]);
  });

  it('Every other month on the first and last Sunday for 10 occurrences', () => {
    expect(dates('FREQ=MONTHLY;INTERVAL=2;COUNT=10;BYDAY=1SU,-1SU', dtstart(1997, 9, 7))).toEqual([
      '1997-09-07', '1997-09-28', '1997-11-02', '1997-11-30', '1998-01-04',
      '1998-01-25', '1998-03-01', '1998-03-29', '1998-05-03', '1998-05-31',
    ]);
  });

  it('Monthly on the second-to-last Monday for 6 occurrences', () => {
    expect(dates('FREQ=MONTHLY;COUNT=6;BYDAY=-2MO', dtstart(1997, 9, 22))).toEqual([
      '1997-09-22', '1997-10-20', '1997-11-17', '1997-12-22', '1998-01-19', '1998-02-16',
    ]);
  });

  it('Monthly on the third-to-last day of the month', () => {
    expect(dates('FREQ=MONTHLY;BYMONTHDAY=-3', dtstart(1997, 9, 28), 6)).toEqual([
      '1997-09-28', '1997-10-29', '1997-11-28', '1997-12-29', '1998-01-29', '1998-02-26',
    ]);
  });

  it('Monthly on the 2nd and 15th for 10 occurrences', () => {
    expect(dates('FREQ=MONTHLY;COUNT=10;BYMONTHDAY=2,15', dtstart(1997, 9, 2))).toEqual([
      '1997-09-02', '1997-09-15', '1997-10-02', '1997-10-15', '1997-11-02',
      '1997-11-15', '1997-12-02', '1997-12-15', '1998-01-02', '1998-01-15',
    ]);
  });

  it('Monthly on the first and last day for 10 occurrences', () => {
    expect(dates('FREQ=MONTHLY;COUNT=10;BYMONTHDAY=1,-1', dtstart(1997, 9, 30))).toEqual([
      '1997-09-30', '1997-10-01', '1997-10-31', '1997-11-01', '1997-11-30',
      '1997-12-01', '1997-12-31', '1998-01-01', '1998-01-31', '1998-02-01',
    ]);
  });

  it('Every Tuesday, every other month', () => {
    expect(dates('FREQ=MONTHLY;INTERVAL=2;BYDAY=TU', dtstart(1997, 9, 2), 13)).toEqual([
      '1997-09-02', '1997-09-09', '1997-09-16', '1997-09-23', '1997-09-30',
      '1997-11-04', '1997-11-11', '1997-11-18', '1997-11-25',
      '1998-01-06', '1998-01-13', '1998-01-20', '1998-01-27',
    ]);
  });

  it('Yearly in June and July for 10 occurrences', () => {
    expect(dates('FREQ=YEARLY;COUNT=10;BYMONTH=6,7', dtstart(1997, 6, 10))).toEqual([
      '1997-06-10', '1997-07-10', '1998-06-10', '1998-07-10', '1999-06-10',
      '1999-07-10', '2000-06-10', '2000-07-10', '2001-06-10', '2001-07-10',
    ]);
  });

  it('The third Tuesday, Wednesday or Thursday into the month, for 3 months', () => {
    expect(dates('FREQ=MONTHLY;COUNT=3;BYDAY=TU,WE,TH;BYSETPOS=3', dtstart(1997, 9, 4))).toEqual([
      '1997-09-04', '1997-10-07', '1997-11-06',
    ]);
  });

  it('The second-to-last weekday of the month', () => {
    expect(dates('FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-2', dtstart(1997, 9, 29), 7)).toEqual([
      '1997-09-29', '1997-10-30', '1997-11-27', '1997-12-30',
      '1998-01-29', '1998-02-26', '1998-03-30',
    ]);
  });

  it('US election day: every 4 years, first Tuesday after a Monday in November', () => {
    const got = dates(
      'FREQ=YEARLY;INTERVAL=4;BYMONTH=11;BYDAY=TU;BYMONTHDAY=2,3,4,5,6,7,8',
      dtstart(1996, 11, 5), 3,
    );
    expect(got).toEqual(['1996-11-05', '2000-11-07', '2004-11-02']);
  });
});

describe('round trip', () => {
  const cases = [
    'FREQ=DAILY;COUNT=10',
    'FREQ=WEEKLY;INTERVAL=2;COUNT=8;BYDAY=TU,TH',
    'FREQ=MONTHLY;COUNT=10;BYDAY=1FR',
    'FREQ=MONTHLY;BYMONTHDAY=-3',
    'FREQ=MONTHLY;BYMONTHDAY=1,-1',
    'FREQ=YEARLY;BYMONTH=6,7',
    'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1',
    'FREQ=WEEKLY;UNTIL=19971224T000000Z',
  ];

  for (const c of cases) {
    it(`parse then serialize is stable: ${c}`, () => {
      const first = serialize(parse(c).rule!);
      expect(serialize(parse(first).rule!)).toBe(first);
    });
  }
});
