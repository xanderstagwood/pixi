// intensify: make the pop pop. The hero's family is tempered so the hero stands out of it, and a free chip far
// louder than the rest is pulled down. The reserved chips, neutrals and dull chips are left alone, and so is a
// palette with no hero or a family too muted to temper.
import assert from 'node:assert/strict';
import { hexToRgb } from '../src/color.js';
import { deltaE, rgbToOklab, toOklch } from '../src/oklab.js';
import { intensify } from '../src/intensity.js';

const lab = (h) => rgbToOklab(hexToRgb(h));
const lch = (h) => toOklch(lab(h));
const gap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const minGap = (list) => Math.min(...list.flatMap((a, i) => list.slice(i + 1).map((b) => deltaE(lab(a), lab(b)))));
const median = (v) => { const s = [...v].sort((a, b) => a - b); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };
const TEMPER = 0.7;
const chip = (hex, role = '') => ({ hex, role });

const HERO = '#D00806', RED = '#B8241C', ORANGE = '#E0603A', ROSE = '#9A5A50';
const GREEN = '#00B040', SAGE = '#7A8A60', GRAY = '#808080', DARK = '#0B0B0B', LIGHT = '#E8D9A0', ACCENT = '#2060C0';

{
  const chips = [chip(HERO, 'hero'), chip(RED), chip(ORANGE), chip(ROSE), chip(GREEN), chip(SAGE), chip(GRAY), chip(DARK, 'dark'), chip(LIGHT, 'light'), chip(ACCENT, 'accent')];
  const out = intensify(chips);
  assert.deepEqual([0, 7, 8, 9].map((i) => out[i]), [HERO, DARK, LIGHT, ACCENT], 'the hero, the anchors and the accent are exactly as they were');

  for (const i of [1, 2, 3]) {
    const before = lch(chips[i].hex), after = lch(out[i]);
    assert.ok(Math.abs(after.C - before.C * TEMPER) < 0.006, `${chips[i].hex}: a free chip of the hero's family has 0.7 of its chroma`);
    assert.ok(Math.abs(after.L - before.L) < 0.015 && gap(after.h, before.h) < 3, `${chips[i].hex}: lightness and hue are kept`);
  }

  assert.equal(out[6], GRAY, 'a neutral is left alone');
  assert.equal(out[5], SAGE, 'a dull chip is never raised');

  const typical = median([1, 2, 3, 4, 5].map((i) => lch(out[i]).C).filter((c) => c >= 0.04));
  assert.ok(lch(chips[4].hex).C > typical * 1.2, 'the green began far louder than the rest');
  assert.ok(lch(out[4]).C <= typical * 1.2 + 0.004 && lch(out[4]).C > typical, 'and is pulled down to 1.2 of the typical chroma, no further');
  assert.ok(gap(lch(out[4]).h, lch(GREEN).h) < 3, 'with its hue kept');
  assert.ok(minGap(out) >= Math.min(minGap(chips.map((c) => c.hex)), 0.06) - 1e-9, 'nothing is pushed into a near-twin');
}

{
  const chips = [chip(RED), chip(ORANGE), chip(GREEN), chip(GRAY)];
  assert.deepEqual(intensify(chips), chips.map((c) => c.hex), 'with no hero there is nothing to make pop');
}

{
  const chips = [chip('#9A5A50', 'hero'), chip('#8A5947'), chip('#6E4A44'), chip(GREEN), chip(GRAY)];
  assert.deepEqual(intensify(chips), chips.map((c) => c.hex), 'a family that is already muted is not tempered, and the stage stays off');
}

{
  const chips = [chip(HERO, 'hero'), chip(RED), chip(ORANGE), chip(GRAY)];
  assert.deepEqual(intensify(chips), intensify(chips), 'the same palette is treated the same way');
  assert.deepEqual(chips, [chip(HERO, 'hero'), chip(RED), chip(ORANGE), chip(GRAY)], 'and what was passed in is not changed');
}

console.log('ok 15-intensity');
