// gradient: chips are grouped by color family, the groups ordered, and the chips' lightness fitted so the whole palette
// reads as one ramp. Hue and chroma are kept; the anchors never move; the vivid chips move least; nothing becomes a twin.
import assert from 'node:assert/strict';
import { hexToRgb, rgbToHex } from '../src/color.js';
import { gradient } from '../src/gradient.js';
import { TELLABLE, deltaE, oklchToRgb, rgbToOklab, toOklch } from '../src/oklab.js';
import { classify } from '../src/perceive.js';
import { mulberry32 } from './img.mjs';

const lab = (h) => rgbToOklab(hexToRgb(h));
const lch = (h) => toOklch(lab(h));
const hex = (L, C, h) => rgbToHex(oklchToRgb({ L, C, h }));
const gap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const chip = (h, role = '') => ({ hex: h, role });
const minGap = (list) => Math.min(...list.flatMap((a, i) => list.slice(i + 1).map((b) => deltaE(lab(a), lab(b)))));
const runOf = (chips, plan, f) => plan.order.map((i) => f(plan.hexes[i]));
const reversals = (x, tol) => { let n = 0, dir = 0; for (let i = 1; i < x.length; i++) { const d = x[i] - x[i - 1]; if (Math.abs(d) < tol) continue; if (dir && Math.sign(d) !== dir) n++; dir = Math.sign(d); } return n; };

// The blue and red palette that came out chaotic: reds and blues alternating down the card.
const BLUE_RED = [
  chip('#E8BFA9', 'light'), chip('#F91906', 'hero'), chip('#958689'), chip('#C51C34'),
  chip('#376483'), chip('#812A3E'), chip('#003564', 'dark'),
];
const isBlue = (h) => lch(h).C >= 0.04 && gap(lch(h).h, 250) < 60;

for (const roll of [0.1, 0.9]) {
  const plan = gradient(BLUE_RED, () => roll);
  assert.deepEqual([...plan.order].sort(), [0, 1, 2, 3, 4, 5, 6], 'every chip is placed once');
  assert.equal(plan.hexes.length, 7, 'and every chip has its color back');
  // the colored families stay together
  const sides = plan.order.map((i) => BLUE_RED[i].hex).filter((h) => lch(h).C >= 0.04).map((h) => (isBlue(h) ? 'blue' : 'red')); // neutrals have no hue to keep together
  assert.equal(sides.filter((g, k) => k === 0 || g !== sides[k - 1]).length, 2, `the blues are one block and the reds another: ${sides.join(' ')}`);
  // and the whole thing is a ramp
  assert.equal(reversals(runOf(BLUE_RED, plan, (h) => lch(h).L), 0.02), 0, 'the lightness runs one way from top to bottom');
  // hue kept
  BLUE_RED.forEach((c, i) => {
    if (lch(c.hex).C > 0.04) assert.ok(gap(lch(plan.hexes[i]).h, lch(c.hex).h) < 3, `${c.hex} keeps its hue`);
  });
}

// The reds and the earth tones of one photo: hues only a few degrees apart chain into one family, but a vivid red and a
// muted tan are two groups to the eye, and the order must not run red, tan, red, brown.
{
  const EARTH = [chip('#F49259', 'light'), chip('#F84718', 'accent'), chip('#977056'), chip('#BA0E04', 'hero'), chip('#664530'), chip('#382A24'), chip('#071317', 'dark')];
  const isRed = (h) => lch(h).C >= 0.1 && gap(lch(h).h, 33) < 12;
  for (const roll of [0.1, 0.4, 0.6, 0.9]) {
    const plan = gradient(EARTH, () => roll);
    const reds = plan.order.map((i) => EARTH[i].hex).map((h, k) => (isRed(h) ? k : -1)).filter((k) => k >= 0);
    assert.equal(reds[reds.length - 1] - reds[0] + 1, reds.length, `the vivid reds sit together, nothing between them (order ${plan.order.map((i) => EARTH[i].hex).join(' ')})`);
  }
}

// Who moves, and how far.
{
  const plan = gradient(BLUE_RED, () => 0.1);
  assert.equal(plan.hexes[0], '#E8BFA9', 'the light anchor is exactly as it was');
  assert.equal(plan.hexes[6], '#003564', 'and so is the dark anchor');
  BLUE_RED.forEach((c, i) => {
    const moved = Math.abs(lch(plan.hexes[i]).L - lch(c.hex).L);
    const cap = c.role === 'hero' || c.role === 'accent' ? 0.06 : c.role ? 0 : 0.1;
    assert.ok(moved <= cap + 0.004, `${c.hex} moves at most ${cap}, moved ${moved.toFixed(3)}`);
  });
  assert.ok(lch(plan.hexes[1]).C > 0.15, 'the hero stays vivid');
}

// A palette already a clean ramp is left alone, whatever the number of groups.
{
  const ramp = [0.2, 0.32, 0.44, 0.56, 0.68, 0.8, 0.92].map((L) => chip(hex(L, 0.12, 40)));
  const plan = gradient(ramp, () => 0.1);
  assert.deepEqual(plan.hexes.map((h, i) => Math.abs(lch(h).L - lch(ramp[i].hex).L) < 0.03), Array(7).fill(true), 'a ramp that is already even barely moves');
  assert.equal(reversals(runOf(ramp, plan, (h) => lch(h).L), 0.01), 0, 'and is still a ramp');
}

// Temperature settles which family comes first when the ramp has no preference.
{
  const warm = [0.3, 0.5, 0.7].map((L) => chip(hex(L, 0.14, 40)));
  const cool = [0.3, 0.5, 0.7].map((L) => chip(hex(L, 0.14, 240)));
  const warmth = (plan, chips) => plan.order.map((i) => classify(chips[i].hex).warmth);
  const chips = [...warm, ...cool];
  for (const roll of [0.1, 0.9]) {
    const plan = gradient(chips, () => roll);
    const w = warmth(plan, chips);
    const first = w.slice(0, 3).reduce((a, b) => a + b), last = w.slice(3).reduce((a, b) => a + b);
    assert.ok(Math.abs(first - last) > 1, 'one family is wholly above the other, warm to cool or cool to warm');
  }
}

// Never twins, never mutated, repeatable.
{
  const close = [chip('#C0502E'), chip('#B8582A'), chip('#A04820'), chip('#2E78B0'), chip('#2870A8')];
  const plan = gradient(close, () => 0.3);
  assert.ok(minGap(plan.hexes) >= Math.min(minGap(close.map((c) => c.hex)), TELLABLE) - 1e-9, 'fitting never leaves two chips closer than they were, or than a tellable gap');
  const copy = JSON.stringify(BLUE_RED);
  assert.deepEqual(gradient(BLUE_RED, mulberry32(4)), gradient(BLUE_RED, mulberry32(4)), 'the same palette and seed give the same gradient');
  assert.equal(JSON.stringify(BLUE_RED), copy, 'and what was passed in is not changed');
}

// With fitting off, only the order changes.
{
  const plan = gradient(BLUE_RED, () => 0.1, false);
  assert.deepEqual(plan.hexes, BLUE_RED.map((c) => c.hex), 'an exact palette keeps its colors exactly');
}

console.log('ok 14-gradient');
