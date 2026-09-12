'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Fieldset } from '@base-ui/react/fieldset';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Radio } from '@base-ui/react/radio';
import {
  type Freq, type Issue, type RRule, type Weekday,
  MAX_COUNT, MAX_INTERVAL, describe, formatUntil, instantToWall, parse, serialize,
} from '@/lib/rrule';
import {
  FieldError, FrequencySelect, IntervalField, WeekdayToggleGroup, labelClass,
} from './parts';

export interface RecurrenceFieldProps {
  /** The RRULE string. Controlled when provided. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (next: string, meta: { valid: boolean; issues: Issue[] }) => void;
  /**
   * The first occurrence. Required, not optional: a rule without a start is not
   * expandable, so making it optional would let a caller ship a field that
   * silently renders nothing.
   */
  dtstart: Date;
  timeZone: string;
  /** Frequencies this caller may use. Others render disabled, with a reason. */
  allowed?: readonly Freq[];
  disabled?: boolean;
  readOnly?: boolean;
}

const ALL_FREQ: readonly Freq[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];

type EndMode = 'never' | 'count' | 'until';

function endModeOf(rule: RRule): EndMode {
  if (rule.count !== undefined) return 'count';
  if (rule.until) return 'until';
  return 'never';
}

/** yyyy-mm-dd for <input type="date">, read in the event's own zone. */
function toDateInput(d: Date, timeZone: string): string {
  const w = instantToWall(d, timeZone);
  return `${String(w.year).padStart(4, '0')}-${String(w.month).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`;
}

export function RecurrenceField({
  value, defaultValue = 'FREQ=WEEKLY', onValueChange, dtstart, timeZone,
  allowed = ALL_FREQ, disabled, readOnly,
}: RecurrenceFieldProps) {
  const uid = useId();
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const text = controlled ? value! : internal;

  const { rule, issues } = useMemo(() => parse(text), [text]);
  const countInputRef = useRef<HTMLInputElement>(null);
  const pendingFocus = useRef(false);

  // Moving focus to a control the user just revealed is a deliberate deviation
  // from "never move focus without explicit intent". The radio's only purpose is
  // to reveal this field, so leaving focus behind would make the radio a
  // two-step control. Documented in ACCESSIBILITY.md as the call I expect
  // pushback on.
  useEffect(() => {
    if (pendingFocus.current && countInputRef.current) {
      countInputRef.current.focus();
      countInputRef.current.select();
      pendingFocus.current = false;
    }
  });

  if (!rule) {
    return (
      <div role="group" aria-label="Repeat" className="rounded-lg border border-fail bg-sheet p-4">
        <FieldError id={`${uid}-fatal`}>
          {issues[0]?.message ?? 'This rule cannot be read.'}
        </FieldError>
      </div>
    );
  }

  const commit = (next: RRule) => {
    const s = serialize(next);
    const meta = parse(s);
    if (!controlled) setInternal(s);
    onValueChange?.(s, {
      valid: meta.issues.length === 0,
      issues: [...meta.issues],
    });
  };

  const endMode = endModeOf(rule);
  const locked = disabled || readOnly;

  const issueFor = (field: Issue['field']) => issues.find((i) => i.field === field);
  const intervalIssue = issueFor('interval');
  const dayIssue = issueFor('byday');
  const endIssue = issueFor('end');

  const setEndMode = (mode: EndMode) => {
    const base = { ...rule };
    delete (base as { count?: number }).count;
    delete (base as { until?: Date }).until;
    if (mode === 'count') {
      pendingFocus.current = true;
      commit({ ...base, count: 10 });
    } else if (mode === 'until') {
      const until = new Date(dtstart.getTime());
      until.setUTCMonth(until.getUTCMonth() + 3);
      commit({ ...base, until });
    } else commit(base);
  };

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-rule bg-sheet p-5">
      {/* Frequency and interval read as one sentence, so they are one group. */}
      <Fieldset.Root disabled={locked} className="m-0 border-0 p-0">
        <Fieldset.Legend className={`${labelClass} mb-2 p-0`}>Repeats</Fieldset.Legend>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] text-ink-2">Every</span>

          <IntervalField
            value={rule.interval}
            onValueChange={(n) => commit({ ...rule, interval: n })}
            max={MAX_INTERVAL}
            disabled={locked}
            id={`${uid}-interval`}
            describedBy={intervalIssue ? `${uid}-interval-err` : undefined}
            invalid={!!intervalIssue}
          />

          <label htmlFor={`${uid}-freq`} className="sr-only">Unit</label>
          <FrequencySelect
            id={`${uid}-freq`}
            value={rule.freq}
            interval={rule.interval}
            onValueChange={(freq) => commit({ ...rule, freq })}
            allowed={allowed}
            disabled={locked}
          />
        </div>

        {intervalIssue && (
          <div className="mt-2">
            <FieldError id={`${uid}-interval-err`}>{intervalIssue.message}</FieldError>
          </div>
        )}
      </Fieldset.Root>

      {rule.freq === 'WEEKLY' && (
        <Fieldset.Root disabled={locked} className="m-0 border-0 p-0">
          <Fieldset.Legend className={`${labelClass} mb-2 p-0`}>On these days</Fieldset.Legend>
          <WeekdayToggleGroup
            value={rule.byDay?.map((b) => b.day) ?? []}
            onValueChange={(days: Weekday[]) =>
              commit({ ...rule, byDay: days.length ? days.map((day) => ({ n: 0, day })) : undefined })}
            disabled={locked}
            describedBy={dayIssue ? `${uid}-day-err` : undefined}
            invalid={!!dayIssue}
          />
          {dayIssue && (
            <div className="mt-2">
              <FieldError id={`${uid}-day-err`}>{dayIssue.message}</FieldError>
            </div>
          )}
        </Fieldset.Root>
      )}

      <Fieldset.Root disabled={locked} className="m-0 border-0 p-0">
        <Fieldset.Legend className={`${labelClass} mb-2 p-0`}>Ends</Fieldset.Legend>

        <RadioGroup
          value={endMode}
          onValueChange={(v: EndMode) => setEndMode(v)}
          disabled={locked}
          className="flex flex-col gap-2.5"
        >
          {([
            ['never', 'Never'],
            ['count', 'After'],
            ['until', 'On'],
          ] as const).map(([mode, label]) => (
            <label key={mode} className="flex items-center gap-2.5 text-[14px] text-ink">
              <Radio.Root
                value={mode}
                // A wrapping <label> does not name a role="radio" button; that
                // only works for native form controls. The accessibility tree
                // showed all three of these unnamed until this was added.
                aria-label={label}
                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full
                           border border-rule bg-sheet data-[checked]:border-accent
                           data-[checked]:bg-accent data-[disabled]:opacity-60"
              >
                <Radio.Indicator className="h-1.5 w-1.5 rounded-full bg-on-accent" />
              </Radio.Root>
              <span>{label}</span>

              {mode === 'count' && endMode === 'count' && (
                <span className="flex items-center gap-2">
                  <input
                    ref={countInputRef}
                    type="number"
                    min={1}
                    max={MAX_COUNT}
                    value={rule.count ?? 10}
                    disabled={locked}
                    aria-label="Number of occurrences"
                    aria-invalid={endIssue ? true : undefined}
                    aria-describedby={endIssue ? `${uid}-end-err` : undefined}
                    onChange={(e) => commit({ ...rule, count: Number(e.target.value) })}
                    className={`w-20 rounded-md border bg-sheet px-2 py-1.5 text-[14px]
                                tabular-nums text-ink ${endIssue ? 'border-fail' : 'border-rule'}`}
                  />
                  <span className="text-ink-2">times</span>
                </span>
              )}

              {mode === 'until' && endMode === 'until' && rule.until && (
                // A native date input, deliberately. The browser already ships a
                // localised, keyboard-accessible date picker, and the posting
                // asks what the platform does before reaching for a library.
                <input
                  type="date"
                  value={toDateInput(rule.until, timeZone)}
                  disabled={locked}
                  aria-label="Last date"
                  onChange={(e) => {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    if (!y) return;
                    commit({ ...rule, until: new Date(Date.UTC(y, m - 1, d, 23, 59, 59)) });
                  }}
                  className="rounded-md border border-rule bg-sheet px-2 py-1.5 text-[14px] text-ink"
                />
              )}
            </label>
          ))}
        </RadioGroup>

        {endIssue && (
          <div className="mt-2">
            <FieldError id={`${uid}-end-err`}>{endIssue.message}</FieldError>
          </div>
        )}
      </Fieldset.Root>

      <Summary rule={rule} timeZone={timeZone} />
    </div>
  );
}

/**
 * The plain-English reading, in a polite live region.
 *
 * Debounced at 400ms. Without it, dragging the interval spinner announces on
 * every tick and the region becomes noise a screen reader user turns off, which
 * is worse than having no region at all.
 */
function Summary({ rule, timeZone }: { rule: RRule; timeZone: string }) {
  const sentence = describe(rule, { timeZone });
  const [announced, setAnnounced] = useState(sentence);

  useEffect(() => {
    const t = setTimeout(() => setAnnounced(sentence), 400);
    return () => clearTimeout(t);
  }, [sentence]);

  return (
    <div className="border-t border-rule-2 pt-4">
      <p className="text-[14px] text-ink">{sentence}</p>
      <p aria-live="polite" aria-atomic="true" className="sr-only">{announced}</p>
      <p className="mt-2 font-mono text-[12px] break-all text-ink-3">
        RRULE:{serialize(rule)}
        {rule.until ? '' : ''}
      </p>
    </div>
  );
}

export { formatUntil };
