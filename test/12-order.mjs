// arrange: every palette is a clean ramp. Lightness leads (dark to light or light to dark, never a peak in the middle),
// and temperature only settles which way round, and the order among colors of the same lightness.
import assert from 'node:assert/strict';
import * as arranging from '../src/arrange.js';
import { classify } from '../src/perceive.js';
import { mulberry32 } from './img.mjs';
import { rgbToHex } from '../src/color.js';
import { oklchToRgb } from '../src/oklab.js';

const { arrange } = arranging;
assert.deepEqual(arranging.SHADES, ['dark-to-light', 'light-to-dark'], 'there are two ways to run a ramp and no others');
assert.equal(arranging.turnsOnMiddle, undefined, 'a palette never turns on its middle chip');
assert.equal(arranging.fit, undefined, 'so nothing is fitted to make it do so');

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
const runOf = (hexes, plan, pick) => plan.order.map((i) => pick(classify(hexes[i])));

// Random palettes: always a ramp, whatever the colors.
{
  const rng = mulberry32(21);
  const randomHex = () => '#' + [0, 1, 2].map(() => Math.floor(rng() * 256).toString(16).padStart(2, '0')).join('');
  for (let trial = 0; trial < 200; trial++) {
    const hexes = Array.from({ length: 7 }, randomHex);
    const plan = arrange(hexes, rng);
    assert.ok(['dark-to-light', 'light-to-dark'].includes(plan.shade), `trial ${trial}: a ramp`);
    assert.equal(reversals(runOf(hexes, plan, (c) => c.shade), 0.05), 0, `trial ${trial}: lightness never turns round: ${hexes.join(' ')}`);
  }
}

// Lightness wins over temperature: warm and cool colors, dark and light, still come out as a ramp.
{
  const hexes = ['#3A0A0A', '#8FD0FF', '#FFD08F', '#0A2A4A', '#808080', '#B04030', '#305070'];
  for (const roll of [0, 0.3, 0.6, 0.99]) {
    const plan = arrange(hexes, () => roll);
    assert.equal(reversals(runOf(hexes, plan, (c) => c.shade), 0.05), 0, 'lightness runs one way even though warm and cool alternate');
  }
}

// Temperature settles the order among colors that are equally light.
{
  const level = [0, 50, 100, 150, 200, 250].map((h) => rgbToHex(oklchToRgb({ L: 0.6, C: 0.12, h })));
  for (const roll of [0, 0.4, 0.99]) {
    const plan = arrange(level, () => roll);
    assert.equal(reversals(runOf(level, plan, (c) => c.warmth), 0.2), 0, 'level in lightness, the run goes steadily warm to cool or cool to warm');
  }
}

console.log('ok 12-order');
