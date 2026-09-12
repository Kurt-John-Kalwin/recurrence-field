# Gaps

What Base UI and coss ui do not cover, found by looking rather than assuming, and what
I would upstream.

## Method

I read the coss ui registry rather than the documentation site, because the registry is
the inventory: `apps/ui/registry/registry-particles.ts` lists every particle with its
categories, and `registry-categories.ts` types the category names.

## What exists

**Base UI 1.8.0** ships roughly forty components. None of them is a date, time, or
timezone primitive. Calendar and date picking sit entirely above the primitive layer.

**coss ui**, 415 particles:

- 25 `p-calendar-*`, including `p-calendar-18` (calendar with time input),
  `p-calendar-19` (time slots, an appointment picker) and `p-calendar-25`
  (24-hour autocomplete time input)
- 9 `p-date-picker-*`, covering ranges, presets, multiple dates and dropdown navigation
- `p-combobox-16` and `p-combobox-17`, both timezone comboboxes
- `time` and `timezone` already exist as registry categories

## What does not

**Recurrence. Nothing at all.** No particle, no category, no primitive, at any layer.

This is the gap. Cal.com ships recurring events as a product feature, "recurrence rules"
is named in the job posting, and the design system underneath has no representation
of one.

A second, smaller gap: **availability**, meaning a recurring weekly schedule with per-day
time ranges. `p-calendar-19` comes closest and models availability as a hardcoded
eighteen-item array of `{ time, available }`, which is right for a demo and is not a
data model. I considered building this one instead and chose recurrence, because an
availability editor is N repeated time-range rows, so the interesting work repeats
rather than deepens, and it has no serialized output, which is where a correctness
argument can live.

## What I would upstream

`p-recurrence-field-1`, as a particle, composed from `@coss/field`, `@coss/fieldset`,
`@coss/select`, `@coss/number-field`, `@coss/toggle-group`, `@coss/radio-group` and
`@coss/combobox`. All of those exist today.

The shape already matches. It is a single file whose default export needs renaming to
`Particle`, with imports repointed from `@/components/ui/*` to `@/registry/default/ui/*`,
plus a registry entry and a `<ComponentPreview>` in the docs. A new `recurrence`
category alongside the existing `time` and `timezone`.

I have not opened that pull request. The repository runs tight, with zero open issues
and five open pull requests, so an unsolicited one that nobody asked for is as likely to
sit as to land. I would rather ask first, which is what this document is.

## A note on the library itself

`Fieldset.Legend` renders a `<div>` named through `aria-labelledby` rather than a native
`<legend>`. The accessible name is correct and the trade is defensible, since `<legend>`
resists styling. It is worth documenting, because an audit looking for literal `<legend>`
elements will not find them.

`ToggleGroup` takes `multiple`, not `toggleMultiple`. I guessed the latter from another
library's API and the compiler corrected me, which is the system working.
