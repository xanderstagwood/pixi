// The order of a finished palette, through the whole pipeline: a clean ramp, with each color family in one block.
import assert from 'node:assert/strict';
import * as arranging from '../src/arrange.js';
import { hexToRgb } from '../src/color.js';
import { rgbToOklab, toOklch } from '../src/oklab.js';
import { classify } from '../src/perceive.js';
import { buildPalette } from '../src/palette.js';
import { mulberry32, patches } from './img.mjs';

assert.equal(arranging.arrange, undefined, 'the order is made by the gradient now, not by trying every order');
assert.equal(arranging.SHADES, undefined, 'and there are no patterns to choose between');
assert.equal(arranging.turnsOnMiddle, undefined, 'a palette never turns on its middle chip');
assert.equal(arranging.fit, undefined, 'so nothing is fitted to make it do so');

const lightness = (h) => toOklch(rgbToOklab(hexToRgb(h))).L;
const reversals = (x, tolerance) => {
  let count = 0, dir = 0;
  for (let i = 1; i < x.length; i++) {
    const d = x[i] - x[i - 1];
    if (Math.abs(d) < tolerance) continue;
    if (dir && Math.sign(d) !== dir) count++;
    dir = Math.sign(d);
  }
  return count;
};
const topToBottom = (image, seed) => [...buildPalette(image, mulberry32(seed)).colors].reverse();

const PAIR = patches([
  { hex: '#C0501E', share: 0.14 }, { hex: '#E0702E', share: 0.14 }, { hex: '#A03A14', share: 0.12 }, { hex: '#F09A5A', share: 0.1 },
  { hex: '#1E5C8A', share: 0.14 }, { hex: '#2E7CB0', share: 0.14 }, { hex: '#0E3C5A', share: 0.12 }, { hex: '#7EB4D8', share: 0.1 },
]);
const TONAL = patches([
  { hex: '#2A1F14', share: 0.14 }, { hex: '#4A3622', share: 0.14 }, { hex: '#6A4C30', share: 0.14 }, { hex: '#8A6640', share: 0.14 },
  { hex: '#AA8458', share: 0.14 }, { hex: '#CAA474', share: 0.12 }, { hex: '#EAC490', share: 0.1 }, { hex: '#6E6A66', share: 0.08 },
]);

for (let seed = 1; seed <= 30; seed++) {
  const tonal = topToBottom(TONAL, seed);
  assert.equal(reversals(tonal.map(lightness), 0.02), 0, `one hue is a clean ramp (seed ${seed}): ${tonal.join(' ')}`);

  const pair = topToBottom(PAIR, seed);
  // Two hues whose shades overlap almost completely cannot be a perfect ramp in blocks within sensible shading: at most one dip (two changes of direction), where one block meets the other.
  assert.ok(reversals(pair.map(lightness), 0.03) <= 2, `two hues run one way in lightness, give or take one dip at the join (seed ${seed}): ${pair.join(' ')}`);
  assert.ok(reversals(pair.map((h) => classify(h).warmth), 0.2) <= 1, `and each hue is one block, so warm and cool swap over once at most (seed ${seed}): ${pair.join(' ')}`);
}

console.log('ok 12-order');
