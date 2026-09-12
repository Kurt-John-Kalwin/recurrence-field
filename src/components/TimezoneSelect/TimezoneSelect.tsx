'use client';

import { useMemo } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { Field } from '@base-ui/react/field';
import { formatOffset, listTimeZones } from '@/lib/rrule';

export interface TimezoneSelectProps {
  value: string;
  onValueChange: (next: string) => void;
  /** Offsets are resolved at this instant, because they are not constant. */
  at: Date;
  disabled?: boolean;
  id?: string;
}

/**
 * A timezone picker over the roughly 430 zones the platform knows about.
 *
 * Composed from Base UI's Combobox, which supplies the listbox semantics,
 * active-descendant wiring and type-ahead. Neither Base UI nor coss ui ships a
 * timezone control, which is the gap this exists to argue about.
 *
 * The label carries the current offset because "Asia/Kolkata" tells most people
 * less than "GMT+05:30" does, and offsets move, so it is computed at the instant
 * the event actually starts rather than at render time.
 */
export function TimezoneSelect({ value, onValueChange, at, disabled, id }: TimezoneSelectProps) {
  const zones = useMemo(() => listTimeZones(), []);

  const items = useMemo(
    () => zones.map((zone) => ({
      value: zone,
      label: zone.replace(/_/g, ' '),
      offset: formatOffset(at, zone),
    })),
    [zones, at],
  );

  const selected = items.find((i) => i.value === value);

  return (
    <Field.Root className="flex flex-col gap-1.5">
      <Field.Label className="text-[13px] font-medium text-ink-2">Time zone</Field.Label>

      <Combobox.Root
        items={items}
        value={selected ?? null}
        onValueChange={(next: typeof items[number] | null) => next && onValueChange(next.value)}
        itemToStringLabel={(item: typeof items[number]) => `${item.label} ${item.offset}`}
        disabled={disabled}
      >
        <Combobox.Input
          id={id}
          placeholder="Search a city or region"
          className="w-full rounded-md border border-rule bg-sheet px-3 py-2 text-[14px]
                     text-ink placeholder:text-ink-3 disabled:opacity-60"
        />

        <Combobox.Portal>
          <Combobox.Positioner sideOffset={6} className="z-50">
            <Combobox.Popup
              className="max-h-72 w-[min(26rem,90vw)] overflow-hidden rounded-lg border
                         border-rule bg-sheet shadow-[var(--shadow)]
                         transition-[opacity,transform] duration-[var(--dur-1)]
                         ease-[var(--ease-standard)]
                         data-[starting-style]:scale-[.98] data-[starting-style]:opacity-0
                         data-[ending-style]:scale-[.98] data-[ending-style]:opacity-0"
            >
              <Combobox.Empty className="px-3 py-6 text-center text-[13px] text-ink-3">
                No zone matches that search.
              </Combobox.Empty>

              <Combobox.List className="max-h-72 overflow-y-auto py-1">
                {(item: typeof items[number]) => (
                  <Combobox.Item
                    key={item.value}
                    value={item}
                    className="flex cursor-default items-baseline justify-between gap-4 px-3 py-1.5
                               text-[14px] text-ink data-[highlighted]:bg-accent-soft"
                  >
                    {/* Truncation is visual only. The full name stays in the
                        accessible name via the item's text content. */}
                    <span className="truncate">{item.label}</span>
                    <span className="shrink-0 font-mono text-[12px] text-ink-3">{item.offset}</span>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </Field.Root>
  );
}
