// Fails the build when a colour is declared outside the token block.
//
// The rule "nothing below the token block declares a raw colour" was a comment in
// my earlier work, which meant it held exactly as long as I remembered it. This
// makes it a build step instead. That is the difference between a convention and
// a system.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ALLOWED = ['src/styles/tokens.css'];
const EXTS = ['.css', '.ts', '.tsx'];

// #abc, #aabbcc, #aabbccdd, and the functional colour notations.
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|lab|color-mix)\s*\(/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTS.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

const violations = [];
for (const file of walk(join(ROOT, 'src'))) {
  const rel = relative(ROOT, file);
  if (ALLOWED.includes(rel)) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return;
    for (const hit of line.match(COLOUR) ?? []) {
      violations.push(`${rel}:${i + 1}  ${hit.trim()}  in  ${line.trim().slice(0, 72)}`);
    }
  });
}

if (violations.length) {
  console.error(`\nRaw colours found outside the token block (${violations.length}):\n`);
  for (const v of violations) console.error('  ' + v);
  console.error('\nAdd a token in src/styles/tokens.css and reference it instead.\n');
  process.exit(1);
}
console.log('check-tokens: no raw colours outside the token block.');
