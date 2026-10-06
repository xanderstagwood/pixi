// lift: a palette whose lightest and darkest chips are too close in lightness is flat, so those two are nudged
// outward, a little, never into pure black or white. Every other chip stays exactly as it was.
import assert from 'node:assert/strict';
import { hexToRgb, rgbToHex } from '../src/color.js';
import { oklchToRgb, rgbToOklab, toOklch } from '../src/oklab.js';
import { lift } from '../src/contrast.js';

const lch = (h) => toOklch(rgbToOklab(hexToRgb(h)));
const gap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const col = (L, C = 0.06, h = 40) => rgbToHex(oklchToRgb({ L, C, h }));
const range = (hexes) => { const L = hexes.map((h) => lch(h).L); return Math.max(...L) - Math.min(...L); };

{
  const chips = [col(0.3), col(0.4), col(0.5), col(0.6), col(0.7)];
  const out = lift(chips);
  assert.deepEqual(out.slice(1, 4), chips.slice(1, 4), 'the chips between the ends are exactly as they were');
  assert.ok(lch(out[0]).L < lch(chips[0]).L && lch(chips[0]).L - lch(out[0]).L <= 0.061, 'the darkest goes darker, by 0.06 at the most');
  assert.ok(lch(out[4]).L > lch(chips[4]).L && lch(out[4]).L - lch(chips[4]).L <= 0.061, 'the lightest goes lighter, by 0.06 at the most');
  assert.ok(range(out) > range(chips), 'so the card has more range');
  assert.ok(gap(lch(out[0]).h, 40) < 3 && Math.abs(lch(out[0]).C - 0.06) < 0.01, 'with its hue and chroma kept');
}

{
  const chips = [col(0.3), col(0.46), col(0.7)];
  const out = lift(chips);
  assert.ok(range(out) <= 0.5 + 0.005, 'a range just under 0.5 is lifted only as far as it needs');
}

{
  const chips = [col(0.2), col(0.5), col(0.75)];
  assert.deepEqual(lift(chips), chips, 'a card with range enough is left alone');
}

{
  const dark = lift(['#040404', col(0.3, 0), col(0.4, 0)]);
  assert.notEqual(dark[0], '#000000', 'never pure black');
  assert.notEqual(lift(['#FBFBFB', col(0.7, 0), col(0.6, 0)])[0], '#FFFFFF', 'never pure white');
}

{
  const one = ['#808080'];
  assert.deepEqual(lift(one), one, 'one chip has no range to speak of');
  const chips = [col(0.3), col(0.4), col(0.5)];
  assert.deepEqual(lift(chips), lift(chips), 'the same palette is treated the same way');
  assert.deepEqual(chips, [col(0.3), col(0.4), col(0.5)], 'and what was passed in is not changed');
}

console.log('ok 17-contrast');
