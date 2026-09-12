'use client';

import type { ExpandResult } from '@/lib/rrule';

/**
 * The next occurrences.
 *
 * A plain ordered list of <time> elements, deliberately. There is no interactive
 * widget here: nothing is selectable, expandable or reorderable. Reaching for a
 * listbox or a grid would add roles the content does not earn and would make the
 * list worse to navigate, not better. Knowing when not to compose a primitive is
 * the same skill as knowing when to.
 */
export function OccurrencePreview({
  result, timeZone, limit,
}: {
  result: ExpandResult;
  timeZone: string;
  limit: number;
}) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone, weekday: 'short', day: 'numeric', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });

  if (result.impossible) {
    return (
      <div className="rounded-lg border border-warn bg-sheet p-4">
        <p className="text-[14px] font-medium text-warn">This rule never fires</p>
        <p className="mt-1 text-[13px] text-ink-2">{result.impossible}</p>
        {result.skipped.length > 0 && (
          <p className="mt-2 text-[13px] text-ink-3">
            It asked for {result.skipped[0].reason}.
          </p>
        )}
      </div>
    );
  }

  if (result.occurrences.length === 0) {
    return (
      <div className="rounded-lg border border-rule bg-sheet p-6 text-center">
        <p className="text-[14px] text-ink-2">No occurrences yet</p>
        <p className="mt-1 text-[13px] text-ink-3">Pick at least one day for the rule to land on.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-rule bg-sheet">
      <div className="flex items-baseline justify-between gap-4 border-b border-rule-2 px-4 py-3">
        <h3 className="text-[13px] font-medium text-ink-2">Next occurrences</h3>
        <p className="text-[12px] tabular-nums text-ink-3">
          {result.truncated
            ? `showing ${result.occurrences.length} of more than ${limit}`
            : `${result.occurrences.length} total`}
        </p>
      </div>

      <ol className="divide-y divide-rule-2">
        {result.occurrences.map((o) => (
          <li key={o.instant.toISOString()} className="flex items-baseline justify-between gap-4 px-4 py-2">
            <time dateTime={o.instant.toISOString()} className="text-[14px] tabular-nums text-ink">
              {fmt.format(o.instant)}
            </time>
            {o.offsetShift && (
              // A daylight-saving change moves the UTC instant while the wall
              // clock stays put. Saying so is the difference between a correct
              // list and a trustworthy one.
              <span className="shrink-0 text-[12px] text-warn">
                clocks changed, {o.offsetShift.from} to {o.offsetShift.to}
              </span>
            )}
          </li>
        ))}
      </ol>

      {result.skipped.length > 0 && (
        <div className="border-t border-rule-2 px-4 py-3">
          <p className="text-[12px] text-ink-2">
            {result.skipped.length} date{result.skipped.length === 1 ? '' : 's'} skipped
          </p>
          <ul className="mt-1 space-y-0.5">
            {result.skipped.slice(0, 4).map((s, i) => (
              <li key={`${s.candidate}-${i}`} className="text-[12px] text-ink-3">
                {s.reason}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[12px] text-ink-3">
            RFC 5545 says an instance on a date that does not exist is ignored, not moved.
          </p>
        </div>
      )}
    </div>
  );
}
