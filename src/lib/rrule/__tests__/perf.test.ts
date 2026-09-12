import { describe, expect, it } from 'vitest';
import { parse } from '../parse';
import { expand } from '../expand';
import { wallToInstant } from '../zones';

// This test exists because of a decision it reversed. See the README.
describe('expansion cost', () => {
  const zone = 'America/New_York';
  const dtstart = wallToInstant(
    { year: 2026, month: 1, day: 1, hour: 9, minute: 0, second: 0 }, zone,
  );

  const cases: [string, string][] = [
    ['500 daily', 'FREQ=DAILY;COUNT=500'],
    ['500 weekly with BYDAY', 'FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=500'],
    ['500 monthly with BYSETPOS', 'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-2;COUNT=500'],
  ];

  for (const [label, rrule] of cases) {
    it(`${label} expands well under one frame`, () => {
      const { rule } = parse(rrule);
      for (let i = 0; i < 50; i++) expand({ rule: rule!, dtstart, timeZone: zone, limit: 500 });

      const runs: number[] = [];
      for (let i = 0; i < 200; i++) {
        const t0 = performance.now();
        expand({ rule: rule!, dtstart, timeZone: zone, limit: 500 });
        runs.push(performance.now() - t0);
      }
      runs.sort((a, b) => a - b);
      const p95 = runs[Math.floor(runs.length * 0.95)];
      // eslint-disable-next-line no-console
      console.log(`${label.padEnd(26)} p50 ${runs[100].toFixed(2)}ms  p95 ${p95.toFixed(2)}ms`);

      // A frame is 16.7ms. If this ever fails, the worker argument comes back.
      expect(p95).toBeLessThan(16);
    });
  }
});
