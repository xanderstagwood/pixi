// inkFor: the text on a chip is a quieter cousin of the chip's own color, not black or white: its hue, a little of
// its chroma, and a lightness far enough away to read. Where the chip is too mid-toned to reach it, the best that can be.
import assert from 'node:assert/strict';
import { hexToRgb, inkFor } from '../src/color.js';
import { rgbToOklab, toOklch } from '../src/oklab.js';

const lum = (hex) => { const { r, g, b } = hexToRgb(hex); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const lch = (h) => toOklch(rgbToOklab(hexToRgb(h)));
const gap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

const chips = ['#D52D11', '#46700F', '#2060C0', '#E8D9A0', '#101615', '#C19076', '#786D68', '#F5F3DF', '#FFC20E', '#7A9437'];
for (const chip of chips) {
  const ink = inkFor(chip), c = lch(chip), i = lch(ink);
  assert.ok(contrast(ink, chip) >= 4.5, `${ink} on ${chip} reads: ${contrast(ink, chip).toFixed(2)}`);
  assert.ok(i.C <= 0.051, `${ink} keeps a little chroma only`);
  if (c.C > 0.06 && i.L < 0.97) assert.ok(gap(i.h, c.h) < 15 && i.C > 0.008, `${ink} is of ${chip}'s hue`);
  assert.ok(ink !== '#000000' && ink !== '#FFFFFF', `${ink} is no plain black or white`);
}

assert.ok(lch(inkFor('#E8D9A0')).L < lch('#E8D9A0').L, 'dark ink on a light chip');
assert.ok(lch(inkFor('#101615')).L > lch('#101615').L, 'light ink on a dark chip');

{
  // a mid-tone chip cannot reach 4.5 either way: it still gets whichever side is better, and the most it can
  const mid = '#8A8A8A';
  const ink = inkFor(mid);
  assert.ok(contrast(ink, mid) >= Math.max(contrast('#1B1A19', mid), contrast('#F3F2F1', mid)) - 0.3, 'the better side, as far as it goes');
}

assert.equal(inkFor('#D52D11'), inkFor('#D52D11'), 'the same chip, the same ink');
console.log('ok 20-ink');
