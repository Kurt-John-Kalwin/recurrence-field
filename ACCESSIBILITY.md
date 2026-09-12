# The accessibility contract

Written from the implementation, then checked against a real browser, then corrected
where the browser disagreed with me. The corrections are noted, because a contract
that was never wrong was probably never tested.

## Semantics

| Region | Element | Name |
|---|---|---|
| Repeats | `<fieldset>` | "Repeats" |
| On these days | `<fieldset>` containing a `role="group"` | "Days of the week" |
| Ends | `<fieldset>` containing a `radiogroup` | "Ends" |
| Next occurrences | `<ol>` of `<li>` with `<time datetime>` | heading above it |
| Colour theme | native `<fieldset>` + `<legend>` | "Colour theme" |

No `role="button"` on a `div`. No positive `tabindex`. No `outline: none` without a
replacement. `:focus-visible`, never `:focus`.

**One observation about the library.** Base UI's `Fieldset.Root` renders a real
`<fieldset>`, but `Fieldset.Legend` renders a `<div>` with an id, wired through
`aria-labelledby` rather than a native `<legend>`. The accessible name computes
correctly, and I verified it in the accessibility tree. It is a reasonable trade,
because `<legend>` has layout behaviour that resists styling. It is worth knowing if
you are auditing for literal `<legend>` elements and find five fieldsets and two
legends, as I did.

## Keyboard map

| Control | Keys |
|---|---|
| Whole field | Tab in DOM order. Tab from the last control leaves the component. |
| Weekday toggles | **One tab stop.** Arrow keys move between the seven, Home and End jump to the ends, Space or Enter toggles. Verified: seven buttons, `tabindex` `0, -1, -1, -1, -1, -1, -1`. |
| Interval | Up and Down by one, PageUp and PageDown by a larger step, Home and End to the bounds. |
| Unit select | Space or Enter opens, arrows move, type-ahead jumps, Escape closes and returns focus to the trigger. |
| End condition | Arrow keys select within the radio group, which is one tab stop. |
| Timezone combobox | Type to filter, arrows move the active option, Enter commits, Escape closes and returns focus to the input. |
| Any popup | Escape closes it and restores focus to whatever opened it. |

## Naming

Every interactive element has an accessible name. Two did not, and the accessibility
tree is the only reason I know that:

1. **The end-condition radios were unnamed.** They sit inside a `<label>` alongside their
   text, which is correct for a native `<input type="radio">` and does nothing for a
   `<button role="radio">`. They now carry explicit `aria-label`.
2. **The interval input was unnamed.** The visible word beside it is "Every", which is a
   sentence fragment, not a name for a number. It now carries `aria-label="Interval"`.

The weekday toggles show one letter and are named with the whole word. "T" is not a day,
and a screen reader user should not have to guess which one.

Long timezone names truncate visually with `text-overflow`, so `America/Argentina/Buenos_Aires`
does not break the layout. Truncation is visual only: the full name stays in the
accessible name.

## Errors

Validation errors are associated with the control that owns them through
`aria-describedby`, and the control carries `aria-invalid`. Colour is never the only
signal; the message is text, in the accessible name chain.

## The live region

The plain-English reading of the rule sits in one `aria-live="polite" aria-atomic="true"`
region, **debounced at 400ms**.

The debounce is the part worth arguing about. Without it, holding the interval spinner
announces on every tick, and a region that announces continuously is a region people
turn off, which is worse than not having one. 400ms is long enough to coalesce a drag
and short enough that a deliberate single change still feels immediate.

## The two decisions I expect pushback on

**1. Changing the end condition to "After" moves focus into the number field.**

This deviates from "do not move focus without explicit user intent". My argument is that
the radio's only purpose is to reveal that field, so leaving focus on the radio makes it
a two-step control for a one-step intention, and a keyboard user has to discover that the
next Tab stop is new. The counter-argument, which is real, is that a screen reader user
who arrowed through the radio group to hear the options now finds themselves inside a
text field they did not ask for.

I would want to watch somebody hit this before defending it further.

**2. `--ink-3` is held to 3:1, not 4.5:1.**

It is used only at 17px semibold and above, which is the WCAG large-text threshold. The
test encodes the exemption explicitly rather than lowering the bar globally, because an
undocumented exemption is indistinguishable from a bug.

## Motion

One `--dur` and `--ease` pair. `prefers-reduced-motion: reduce` overrides the duration
tokens in a single place rather than per component.

Motion that decorates is removed. Opacity that carries meaning is not: a state change
the user cannot perceive is worse than one that does not slide.

## What is checked automatically, and what that is worth

`npm run verify` runs the token check, 75 tests including the contrast suite, and a
production build.

The contrast test reads `tokens.css` directly and asserts every ink against every
surface in both themes, plus the WCAG 1.4.11 3:1 floor for the focus ring, which a
text-only contrast test does not cover.

Automated checking catches a minority of accessibility failures. Neither unnamed radio
above would have been caught by a colour-contrast assertion, and no automated tool would
have told me the debounce interval was wrong. The keyboard walk and this document are
the primary artifacts. The tests are a regression net under them.

## Still to do

- A Playwright spec that drives the whole component with `page.keyboard` only, never
  `.click()`, asserting `document.activeElement` after every key. That would turn the
  keyboard table above into something executable instead of something I checked by hand.
- A VoiceOver and Safari pass recorded end to end. I have used VoiceOver on this; I have
  not recorded it.
