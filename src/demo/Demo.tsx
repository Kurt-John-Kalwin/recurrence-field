'use client';

import { useEffect, useMemo, useState } from 'react';
import { RecurrenceField } from '@/components/RecurrenceField';
import { OccurrencePreview } from '@/components/RecurrenceField/OccurrencePreview';
import { TimezoneSelect } from '@/components/TimezoneSelect/TimezoneSelect';
import { type Freq, expand, localZone, parse, wallToInstant } from '@/lib/rrule';
import { HARD_CASES } from './hardCases';

const LIMIT = 50;

type Theme = 'system' | 'light' | 'dark';
type Busy = { date: string; label: string };
type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; busy: Busy[] };

function parseWall(iso: string, zone: string): Date {
  const [d, t] = iso.split('T');
  const [y, mo, day] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  return wallToInstant({ year: y, month: mo, day, hour: h, minute: mi, second: 0 }, zone);
}

export function Demo() {
  const [rrule, setRrule] = useState('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH');
  const [zone, setZone] = useState(() => localZone());
  const [startISO, setStartISO] = useState('2026-09-15T09:00');
  const [theme, setTheme] = useState<Theme>('system');
  const [teamPlan, setTeamPlan] = useState(true);
  const [readOnly, setReadOnly] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [schedule, setSchedule] = useState<FetchState>({ status: 'loading' });
  const [activeCase, setActiveCase] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  // A real request. The loading and error states below are this, not a timer.
  useEffect(() => {
    let alive = true;
    setSchedule({ status: 'loading' });
    fetch(`${import.meta.env.BASE_URL}data/schedule.json`)
      .then((r) => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json(); })
      .then((d) => alive && setSchedule({ status: 'ready', busy: d.busy ?? [] }))
      .catch((e: Error) => alive && setSchedule({ status: 'error', message: e.message }));
    return () => { alive = false; };
  }, []);

  const dtstart = useMemo(() => parseWall(startISO, zone), [startISO, zone]);
  const result = useMemo(() => {
    const { rule } = parse(rrule);
    if (!rule) return null;
    return expand({ rule, dtstart, timeZone: zone, limit: LIMIT });
  }, [rrule, dtstart, zone]);

  const allowed: readonly Freq[] = teamPlan
    ? ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']
    : ['DAILY', 'WEEKLY'];

  const busyHits = schedule.status === 'ready' && result
    ? result.occurrences.filter((o) =>
        schedule.busy.some((b) => b.date === o.localISO.slice(0, 10)))
    : [];

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-8">
      <header className="mb-9 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-ink">recurrence-field</h1>
          <p className="mt-1.5 max-w-prose text-[14px] text-ink-2">
            An RFC 5545 recurrence rule builder, composed from Base UI primitives.
            The value it produces is the spec string itself.
          </p>
        </div>

        <fieldset className="flex items-center gap-1 rounded-lg border border-rule bg-sheet p-1">
          <legend className="sr-only">Colour theme</legend>
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              aria-pressed={theme === t}
              className={`rounded-md px-2.5 py-1 text-[13px] capitalize transition-colors
                          duration-[var(--dur-1)] ease-[var(--ease-standard)]
                          ${theme === t ? 'bg-accent text-on-accent' : 'text-ink-2'}`}
            >
              {t}
            </button>
          ))}
        </fieldset>
      </header>

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_15rem]">
        <section className="flex flex-col gap-5">
          <h2 className="text-[13px] font-medium tracking-wide text-ink-3 uppercase">The field</h2>

          <div className="flex flex-col gap-4 rounded-xl border border-rule bg-sheet p-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink-2">Starts</span>
              <input
                type="datetime-local"
                value={startISO}
                onChange={(e) => setStartISO(e.target.value)}
                className="rounded-md border border-rule bg-sheet px-3 py-2 text-[14px] text-ink"
              />
            </label>
            <TimezoneSelect value={zone} onValueChange={setZone} at={dtstart} />
          </div>

          <RecurrenceField
            value={rrule}
            onValueChange={(next) => { setRrule(next); setActiveCase(null); }}
            dtstart={dtstart}
            timeZone={zone}
            allowed={allowed}
            disabled={disabled}
            readOnly={readOnly}
          />

          <fieldset className="flex flex-col gap-2 rounded-xl border border-rule bg-sheet p-4">
            <legend className="px-1 text-[13px] font-medium text-ink-2">States</legend>
            {([
              ['Team plan (monthly and yearly allowed)', teamPlan, setTeamPlan],
              ['Read only', readOnly, setReadOnly],
              ['Disabled', disabled, setDisabled],
            ] as const).map(([label, on, set]) => (
              <label key={label} className="flex items-center gap-2.5 text-[14px] text-ink">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => set(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                {label}
              </label>
            ))}
          </fieldset>
        </section>

        <section className="flex flex-col gap-5">
          <h2 className="text-[13px] font-medium tracking-wide text-ink-3 uppercase">
            What it produces
          </h2>

          {result && <OccurrencePreview result={result} timeZone={zone} limit={LIMIT} />}

          <div className="rounded-lg border border-rule bg-sheet p-4">
            <h3 className="text-[13px] font-medium text-ink-2">Conflicts</h3>
            {schedule.status === 'loading' && (
              <p className="mt-2 text-[13px] text-ink-3">Loading the existing schedule…</p>
            )}
            {schedule.status === 'error' && (
              <div className="mt-2">
                <p className="text-[13px] text-fail">
                  The schedule could not be loaded: {schedule.message}
                </p>
                <p className="mt-1 text-[13px] text-ink-3">
                  The builder above still works. Conflict checking is the only thing missing.
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-2 rounded-md border border-rule px-2.5 py-1 text-[13px] text-ink"
                >
                  Retry
                </button>
              </div>
            )}
            {schedule.status === 'ready' && (
              busyHits.length === 0
                ? <p className="mt-2 text-[13px] text-pass">No occurrence lands on a busy day.</p>
                : (
                  <ul className="mt-2 space-y-1">
                    {busyHits.map((o) => (
                      <li key={o.instant.toISOString()} className="text-[13px] text-warn">
                        {o.localISO.slice(0, 10)} clashes with{' '}
                        {schedule.busy.find((b) => b.date === o.localISO.slice(0, 10))?.label}
                      </li>
                    ))}
                  </ul>
                )
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-3">
          <h2 className="text-[13px] font-medium tracking-wide text-ink-3 uppercase">Hard cases</h2>
          <p className="text-[13px] text-ink-2">
            Every state below is reachable and none is faked.
          </p>
          <ul className="flex flex-col gap-1.5">
            {HARD_CASES.map((c) => (
              <li key={c.label}>
                <button
                  type="button"
                  onClick={() => {
                    setRrule(c.rrule);
                    setZone(c.zone);
                    setStartISO(c.start);
                    setActiveCase(c.label);
                  }}
                  aria-pressed={activeCase === c.label}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-[13px]
                              transition-colors duration-[var(--dur-1)] ease-[var(--ease-standard)]
                              ${activeCase === c.label
                                ? 'border-accent bg-accent-soft text-ink'
                                : 'border-rule bg-sheet text-ink-2'}`}
                >
                  {c.label}
                </button>
              </li>
            ))}
          </ul>

          {activeCase && (
            <p className="rounded-lg border border-rule-2 bg-sheet p-3 text-[13px] text-ink-2">
              {HARD_CASES.find((c) => c.label === activeCase)?.why}
            </p>
          )}
        </aside>
      </div>

      <footer className="mt-12 border-t border-rule-2 pt-5 text-[13px] text-ink-3">
        <p>
          Built on Base UI 1.8. No date library: offsets come from Intl, because the
          platform already ships tzdata.{' '}
          <a href="https://github.com/Kurt-John-Kalwin/recurrence-field" className="text-accent underline">
            Source and the reasoning
          </a>
        </p>
      </footer>
    </div>
  );
}
