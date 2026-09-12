import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Ported from the contrast test in my training app, which was written after I
// found my own secondary ink shipping at 1.45:1 across roughly 250 call sites.
// Extended here with the WCAG 1.4.11 non-text floor for the focus ring, which the
// original text-only test did not cover.
//
// It reads tokens.css rather than restating the values, so a token edited without
// running the numbers fails here rather than in someone's eyes.

const css = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');

/** Extracts one `:root`-ish block's custom properties. */
function block(startPattern: RegExp): Record<string, string> {
  const start = css.search(startPattern);
  if (start === -1) throw new Error(`block not found: ${startPattern}`);
  const open = css.indexOf('{', start);
  let depth = 0, end = open;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const out: Record<string, string> = {};
  for (const m of css.slice(open, end).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

const light = block(/^:root \{/m);
const dark = block(/^:root\[data-theme="dark"\] \{/m);

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a 6-digit hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return 0.2126 * srgbToLinear((n >> 16) & 255)
    + 0.7152 * srgbToLinear((n >> 8) & 255)
    + 0.0722 * srgbToLinear(n & 255);
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const round = (n: number) => Math.round(n * 100) / 100;

for (const [mode, tokens] of [['light', light], ['dark', dark]] as const) {
  describe(`${mode} mode`, () => {
    const surfaces = ['--paper', '--sheet'] as const;

    // 4.5:1 is the WCAG 1.4.3 floor for normal-size text. Every ink that can
    // carry body copy must clear it on every surface it can sit on.
    for (const ink of ['--ink', '--ink-2'] as const) {
      for (const surface of surfaces) {
        it(`${ink} on ${surface} clears 4.5:1`, () => {
          const r = ratio(tokens[ink], tokens[surface]);
          expect(
            r, `${ink} (${tokens[ink]}) on ${surface} (${tokens[surface]}) is ${round(r)}:1`,
          ).toBeGreaterThanOrEqual(4.5);
        });
      }
    }

    // --ink-3 is deliberately held to the 3:1 large-text floor instead. It is used
    // only at 17px semibold and above. Stating the exemption here is the point:
    // an undocumented exemption is indistinguishable from a bug.
    for (const surface of surfaces) {
      it(`--ink-3 on ${surface} clears 3:1, its documented large-text floor`, () => {
        const r = ratio(tokens['--ink-3'], tokens[surface]);
        expect(r, `--ink-3 on ${surface} is ${round(r)}:1`).toBeGreaterThanOrEqual(3);
      });
    }

    it('--on-accent is legible on --accent', () => {
      const r = ratio(tokens['--on-accent'], tokens['--accent']);
      expect(r, `--on-accent on --accent is ${round(r)}:1`).toBeGreaterThanOrEqual(4.5);
    });

    for (const state of ['--pass', '--warn', '--fail'] as const) {
      it(`${state} clears 4.5:1 on --sheet`, () => {
        const r = ratio(tokens[state], tokens['--sheet']);
        expect(r, `${state} on --sheet is ${round(r)}:1`).toBeGreaterThanOrEqual(4.5);
      });
    }

    // WCAG 1.4.11: non-text UI indicators need 3:1 against what is behind them.
    // The focus ring is drawn with an offset, so it sits on the surface, not the
    // control, and must clear the floor on both surfaces.
    for (const surface of surfaces) {
      it(`the focus ring clears 3:1 against ${surface}`, () => {
        const r = ratio(tokens['--accent'], tokens[surface]);
        expect(r, `--accent on ${surface} is ${round(r)}:1`).toBeGreaterThanOrEqual(3);
      });
    }

    it('the rule colour is visible enough to read as a boundary', () => {
      expect(ratio(tokens['--rule'], tokens['--sheet'])).toBeGreaterThanOrEqual(1.2);
    });
  });
}
