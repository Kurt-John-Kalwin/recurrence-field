# recurrence-field

An RFC 5545 recurrence rule builder, composed from [Base UI](https://base-ui.com) primitives.
The value it produces is the specification string itself.

**Live: https://kurt-john-kalwin.github.io/recurrence-field/**

Built in September 2026. This repository is the whole of my Base UI experience, and
I would rather say that here than have you work it out.

---

## Why recurrence

Your posting names "the mess of timezones and recurrence rules". I have been in the
first half of that before this week. In a training app I ship, `lib/dates.ts` stores
instants in UTC, renders them through `Intl.DateTimeFormat().resolvedOptions().timeZone`,
keeps one source of truth for week boundaries, and parses day keys anchored at local
noon, specifically so a date does not slide backward across a daylight-saving boundary.

The second half, recurrence, I had not built. So I built it.

## The gap I found

I went looking for what Cal.com's own stack is missing before deciding what to make.

**Base UI 1.8** ships around forty components. Not one of them is a date, time, or
timezone primitive.

**coss ui** fills part of that. Across its 415 particles there are 25 calendar
particles, 9 date pickers, two timezone comboboxes (`p-combobox-16` and `p-combobox-17`),
and three that handle time input. `time` and `timezone` already exist as registry
categories.

There is nothing for recurrence. Not one particle, no category, no primitive.

That is the gap this fills. It is also why this is not a timezone picker: that one is
already built, and proposing it would have shown I never looked.

I have not opened a pull request against `cosscom/coss`. I built the thing first so the
proposal would have a body to point at. If you want it as a particle, it is shaped to
drop into `registry/default/particles/` with the default export renamed to `Particle`,
which is the one change required.

## The API, and three decisions in it

```tsx
<RecurrenceField
  value={rrule}                  // "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH"
  onValueChange={(next, meta) => save(next, meta.valid)}
  dtstart={start}                // required
  timeZone="America/New_York"    // required
  allowed={['DAILY', 'WEEKLY']}  // plan gating
/>
```

**The value is the string, not an object.** The serialization boundary should sit where
the wire format and the database column already are. An object is derivable from the
string; the string is not always derivable from a lossy object, and the lossy version
is the one that quietly drops a `BYSETPOS` somebody depended on.

**`dtstart` is required.** A rule without a start is not expandable. Making it optional
would let a caller ship a field that renders nothing and looks like it is still loading.

**`allowed` disables, it does not hide.** A frequency the current plan cannot use renders
disabled with the reason beside it. Hiding it means the user never learns the feature
exists and opens a support ticket instead. This is also the whole of the team and
enterprise surface here: one prop, rather than a separate screen.

## What is composed, and what is not

Composed from Base UI, each because the problem needs it: `Field`, `Fieldset`, `Select`,
`NumberField`, `ToggleGroup`, `Toggle`, `RadioGroup`, `Radio`, `Combobox`, `ScrollArea`.

Hand-rolled on purpose:

1. **The RRULE engine.** The correctness argument is the artifact. A library would hide
   exactly the thing being claimed. The tests are the specification's own worked
   examples from section 3.8.5.3, so they can disagree with my code, which is the
   point of using them. All sixteen pass.
2. **Timezone arithmetic.** No `luxon`, no `moment-timezone`, no `rrule.js`. The platform
   already ships tzdata behind `Intl`. Bundling a second copy inside a demo about
   timezone craft would refute itself.
3. **The occurrence list.** A plain `<ol>` of `<time>` elements. Nothing in it is
   selectable, expandable or reorderable, so a listbox or grid would add roles the
   content has not earned and make it worse to navigate. Knowing when not to reach for
   a primitive is the same skill as knowing when to.
4. **The end date.** A native `<input type="date">`. The browser already ships a
   localised, keyboard-accessible date picker.

## The hard cases

Every one of these is a button in the demo. None of them is faked.

| Case | What it shows |
|---|---|
| Every month on the 31st | Five months of the year have no 31st. The spec says those instances are **ignored, not clamped**, so nothing moves to the 30th. The skipped dates are listed with reasons rather than silently missing. |
| Daily at 02:30 across a spring forward | On 8 March 2026 the US clock jumps 01:59 to 03:00. `COUNT=4` still yields four real occurrences, and 8 March is not one of them. |
| Weekly across a clock change | The wall clock is what the person agreed to, so 09:00 stays 09:00 and the instant moves. One gap between occurrences is 167 hours, not 168, and the row says so. |
| The second-to-last weekday | `BYSETPOS` selects from a set another BY rule built, so it needs one to select from. |
| US election day | First Tuesday after a Monday in November, by intersecting a weekday with a range of month days. |
| A rule that can never fire | 30 February is legal to write and impossible to schedule. "Never" and "none yet" are different messages and the UI tells them apart. |
| UNTIL is UTC, the UI is not | The spec stores `UNTIL` in UTC. Rendered raw, a series ending 24 December 00:00Z reads as the 23rd in New York. The description renders it in the event's zone. |

## What I measured, and what it changed

I was going to leave expansion alone. The benchmark disagreed.

```
                         before     after
500 daily                13.89ms    4.77ms   p95
500 weekly with BYDAY    12.94ms    5.78ms   p95
500 monthly BYSETPOS     24.41ms    6.30ms   p95
```

24.41ms is longer than a frame, so the preview would have stuttered while somebody
dragged the interval spinner. Two causes, both mine: every occurrence resolved its UTC
offset about six times, and the weekday scan allocated a `Date` per day of the month to
ask its weekday. Commit `b154768` has the detail.

So there is no web worker in this repo. There is a test asserting p95 under 16ms, which
is what brings the argument back if it regresses.

## Accessibility

The contract is written down in [ACCESSIBILITY.md](./ACCESSIBILITY.md), including the
two decisions I expect you to disagree with.

Two bugs the accessibility tree caught that I would not have seen by looking:

- The end-condition radios had **no accessible name**. They were wrapped in a `<label>`,
  which names native form controls and does nothing for a button carrying `role="radio"`.
- The interval input was unnamed. The visible word beside it is "Every", which is not a
  name for a number.

The contrast test is ported from the same training app. It reads `tokens.css` rather
than restating its values, and it failed on its first run here: `--ink-3` was a value
that clears 3:1 on white at 3.08 but reaches only 2.53 on the darker page surface. I had
carried it across from work where that token only ever sat on white, so the shortfall
had never been visible. Surfaces, not inks, are what make a ramp pass.

## Where the AI helped and where it lied

I use Claude Code daily and I would rather be specific than enthusiastic.

It was genuinely fast at the parser and at the Tailwind plumbing. It also wrote me a
`BYSETPOS=-1` test with a confidently wrong expected value, asserting the last weekday
of September 1997 was the 29th. It was the 30th, a Tuesday. Reading the actual RFC text
is what caught it, and the same reading turned up a real bug in my own code: the spec
requires instances at nonexistent local times to be **ignored and not counted**, and I
was shifting them into the hour the clock jumps to. That is the difference between a
calendar that drops an appointment and one that silently moves it.

It is good at the shape of a thing and unreliable about whether the thing is true.

## What this is not

Not a booking flow. Not connected to a real calendar, and there is no auth. The conflict
column fetches `public/data/schedule.json`, a static file in this repository, which is
why its loading and error states are real rather than a `setTimeout`.

`BYYEARDAY`, `BYWEEKNO`, `BYHOUR`, `BYMINUTE` and `BYSECOND` are legal RRULE parts that
this does not expand. The parser reports them rather than accepting and ignoring them,
because a preview that silently disagrees with the saved rule is worse than a refusal.

## Running it

```bash
npm install
npm run dev
npm run verify     # token check, 75 tests, production build
```

Stack: Vite, React 19, TypeScript, Tailwind v4, `@base-ui/react` 1.8.0. No Next.js:
the artifact is fully static, I have no production Next.js under my own name, and
reaching for a server I do not need is the kind of shortcut your posting warns about.

MIT.
