'use client';

import { Field } from '@base-ui/react/field';
import { NumberField } from '@base-ui/react/number-field';
import { Select } from '@base-ui/react/select';
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import type { Freq, Weekday } from '@/lib/rrule';

const control =
  'rounded-md border border-rule bg-sheet px-3 py-2 text-[14px] text-ink ' +
  'disabled:opacity-60 data-[disabled]:opacity-60';

export const labelClass = 'text-[13px] font-medium text-ink-2';

/**
 * The frequency select renders the unit word itself, pluralised against the
 * interval, so the row reads as one sentence: "Every 2 weeks".
 *
 * The first version had a separate "weeks" label beside a "Weekly" select, which
 * said the same thing twice and made the row parse as two unrelated controls.
 */
export function FrequencySelect({
  value, onValueChange, allowed, disabled, id, interval,
}: {
  value: Freq;
  onValueChange: (f: Freq) => void;
  allowed: readonly Freq[];
  disabled?: boolean;
  id?: string;
  interval: number;
}) {
  const plural = interval !== 1;
  const all: { value: Freq; label: string }[] = [
    { value: 'DAILY', label: plural ? 'days' : 'day' },
    { value: 'WEEKLY', label: plural ? 'weeks' : 'week' },
    { value: 'MONTHLY', label: plural ? 'months' : 'month' },
    { value: 'YEARLY', label: plural ? 'years' : 'year' },
  ];

  return (
    <Select.Root
      items={all}
      value={value}
      onValueChange={(v: Freq | null) => v && onValueChange(v)}
      disabled={disabled}
    >
      <Select.Trigger
        id={id}
        className={`${control} flex min-w-28 items-center justify-between gap-2`}
      >
        <Select.Value />
        <Select.Icon aria-hidden className="text-ink-3">v</Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner sideOffset={6} className="z-50">
          <Select.Popup
            className="min-w-[var(--anchor-width)] rounded-lg border border-rule bg-sheet py-1
                       shadow-[var(--shadow)] transition-[opacity,transform]
                       duration-[var(--dur-1)] ease-[var(--ease-standard)]
                       data-[starting-style]:scale-[.98] data-[starting-style]:opacity-0
                       data-[ending-style]:scale-[.98] data-[ending-style]:opacity-0"
          >
            {all.map((f) => {
              const permitted = allowed.includes(f.value);
              return (
                <Select.Item
                  key={f.value}
                  value={f.value}
                  disabled={!permitted}
                  className="flex cursor-default items-baseline justify-between gap-6 px-3 py-1.5
                             text-[14px] text-ink data-[highlighted]:bg-accent-soft
                             data-[disabled]:opacity-55"
                >
                  <Select.ItemText>{f.label}</Select.ItemText>
                  {/* A disabled option with a reason teaches that the feature
                      exists on another plan. Hiding it generates a support
                      ticket instead. */}
                  {!permitted && (
                    <span className="shrink-0 text-[12px] text-ink-3">Team plan</span>
                  )}
                </Select.Item>
              );
            })}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

export function IntervalField({
  value, onValueChange, max, disabled, id, describedBy, invalid,
}: {
  value: number;
  onValueChange: (n: number) => void;
  max: number;
  disabled?: boolean;
  id?: string;
  describedBy?: string;
  invalid?: boolean;
}) {
  return (
    <NumberField.Root
      value={value}
      onValueChange={(n: number | null) => onValueChange(n ?? 1)}
      min={1}
      max={max}
      disabled={disabled}
    >
      <NumberField.Group className="inline-flex items-stretch">
        <NumberField.Decrement
          aria-label="Decrease interval"
          className={`${control} rounded-r-none border-r-0 px-2.5 text-ink-2`}
        >
          &minus;
        </NumberField.Decrement>
        <NumberField.Input
          id={id}
          // The visible word is "Every", which is not a name for a number.
          aria-label="Interval"
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={`${control} w-16 rounded-none text-center tabular-nums
                      ${invalid ? 'border-fail' : ''}`}
        />
        <NumberField.Increment
          aria-label="Increase interval"
          className={`${control} rounded-l-none border-l-0 px-2.5 text-ink-2`}
        >
          +
        </NumberField.Increment>
      </NumberField.Group>
    </NumberField.Root>
  );
}

const DAY_ORDER: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const DAY_FULL: Record<Weekday, string> = {
  MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday',
  FR: 'Friday', SA: 'Saturday', SU: 'Sunday',
};

export function WeekdayToggleGroup({
  value, onValueChange, disabled, describedBy, invalid,
}: {
  value: readonly Weekday[];
  onValueChange: (days: Weekday[]) => void;
  disabled?: boolean;
  describedBy?: string;
  invalid?: boolean;
}) {
  return (
    <ToggleGroup
      multiple
      value={value as Weekday[]}
      onValueChange={(v: Weekday[]) => onValueChange(v)}
      disabled={disabled}
      aria-label="Days of the week"
      aria-describedby={describedBy}
      className="flex flex-wrap gap-1.5"
    >
      {DAY_ORDER.map((d) => (
        <Toggle
          key={d}
          value={d}
          // The visible label is one letter. The accessible name is the whole
          // word, because "T" is not a day and a screen reader user should not
          // have to guess which one.
          aria-label={DAY_FULL[d]}
          className={`h-11 w-11 rounded-full border text-[13px] font-medium
                      transition-colors duration-[var(--dur-1)] ease-[var(--ease-standard)]
                      ${invalid ? 'border-fail' : 'border-rule'}
                      bg-sheet text-ink-2
                      data-[pressed]:border-accent data-[pressed]:bg-accent
                      data-[pressed]:text-on-accent
                      data-[disabled]:opacity-60`}
        >
          <span aria-hidden>{DAY_FULL[d][0]}</span>
        </Toggle>
      ))}
    </ToggleGroup>
  );
}

export function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-[13px] text-fail">
      {children}
    </p>
  );
}

export { control as controlClass };
export { Field };
