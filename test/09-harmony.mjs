// harmonize: a little nudging so a palette's chips flow together. The chips the palette is built around stay
// exactly as they are; the rest lean toward the palette's own hue, never away, never far, and never into a twin.
import assert from 'node:assert/strict';
import { hexToRgb } from '../src/color.js';
import { deltaE, rgbToOklab, toOklch } from '../src/oklab.js';
import { harmonize } from '../src/harmony.js';

const lab = (h) => rgbToOklab(hexToRgb(h));
const lch = (h) => toOklch(lab(h));
const gap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const minGap = (list) => Math.min(...list.flatMap((a, i) => list.slice(i + 1).map((b) => deltaE(lab(a), lab(b)))));
const chip = (hex, role = '') => ({ hex, role });

const HERO = '#D00806', BROWN = '#A66A3C', BLUE = '#2060C0', GRAY = '#808080';

{
  const out = harmonize([chip(HERO, 'hero'), chip(BROWN), chip(BLUE), chip(GRAY), chip('#0B0B0B', 'dark'), chip('#E8D9A0', 'light')]);
  assert.equal(out[0], HERO, 'a locked chip is exactly as it was');
  assert.equal(out[4], '#0B0B0B', 'locked dark anchor too');
  assert.equal(out[5], '#E8D9A0', 'and locked light anchor');

  const before = lch(BROWN), after = lch(out[1]);
  assert.ok(gap(after.h, lch(HERO).h) < gap(before.h, lch(HERO).h), 'a nearby hue leans toward the palette\'s own');
  assert.ok(gap(after.h, before.h) <= 10.5, 'by a little: ten degrees at most');
  assert.ok(Math.abs(after.L - before.L) < 0.015, 'and its lightness is not touched');

  assert.equal(out[2], BLUE, 'a hue far from the palette\'s is a different family and is left alone');

  const gray = lch(out[3]);
  assert.ok(gray.C >= 0.01, 'a neutral takes a faint tint of the palette');
  assert.ok(gap(gray.h, lch(HERO).h) < 15, 'in the palette\'s hue');
  assert.ok(Math.abs(gray.L - lch(GRAY).L) < 0.015, 'without changing how light it is');
}

{
  const out = harmonize([chip('#5A852C', 'accent'), chip(HERO, 'hero'), chip(BROWN), chip('#4A2A1A')]);
  assert.equal(out[0], '#5A852C', 'the accent is left exactly as it is');
  assert.ok(gap(lch(out[2]).h, lch(HERO).h) < gap(lch(BROWN).h, lch(HERO).h), 'the accent does not pull the palette toward itself, the rest lean toward the hero');
}

{
  const grays = ['#0B0B0B', '#404040', '#808080', '#C0C0C0'].map((h) => chip(h));
  assert.deepEqual(harmonize(grays), grays.map((c) => c.hex), 'a palette with no color of its own has no hue to lean toward');
}

{
  const chips = [chip(HERO, 'hero'), chip('#A66A3C'), chip('#B0501E'), chip('#C45D15'), chip('#8A5947')];
  const before = chips.map((c) => c.hex);
  const after = harmonize(chips);
  assert.ok(minGap(after) >= Math.min(minGap(before), 0.06) - 1e-9, 'nudging never pushes two chips into near-twins');
}

{
  const chips = [chip(HERO, 'hero'), chip(BROWN), chip(GRAY)];
  assert.deepEqual(harmonize(chips), harmonize(chips), 'the same palette is nudged the same way');
  assert.deepEqual(chips, [chip(HERO, 'hero'), chip(BROWN), chip(GRAY)], 'and what was passed in is not changed');
}

console.log('ok 09-harmony');
