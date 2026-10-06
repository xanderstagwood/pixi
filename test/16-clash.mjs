// calmClash: a vivid red and a vivid green on one card read as Christmas. The hero's color keeps its vividness and the
// other is faded, darker or lighter than the vivid one; the hero and the anchors are never touched, and a palette
// without both colors is left as it is.
import assert from 'node:assert/strict';
import { hexToRgb } from '../src/color.js';
import { deltaE, rgbToOklab, toOklch } from '../src/oklab.js';
import { calmClash } from '../src/clash.js';

const lab = (h) => rgbToOklab(hexToRgb(h));
const lch = (h) => toOklch(lab(h));
const gap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const minGap = (list) => Math.min(...list.flatMap((a, i) => list.slice(i + 1).map((b) => deltaE(lab(a), lab(b)))));
const chip = (hex, role = '') => ({ hex, role });
const same = (chips) => chips.map((c) => c.hex);

const RED = '#D52D11', GREEN = '#46700F', LIME = '#7A9437', SAGE = '#8A9A78', BLUE = '#2060C0';
const GRAY = '#786D68', DARK = '#121716', LIGHT = '#E8D9C8';

{
  const chips = [chip(RED, 'hero'), chip(GREEN), chip(LIME), chip(GRAY), chip(DARK, 'dark'), chip(LIGHT, 'light')];
  const out = calmClash(chips);
  assert.deepEqual([0, 3, 4, 5].map((i) => out[i]), [RED, GRAY, DARK, LIGHT], 'the hero, a neutral and the anchors are exactly as they were');
  for (const i of [1, 2]) {
    const before = lch(chips[i].hex), after = lch(out[i]);
    assert.ok(after.C <= 0.07, `${chips[i].hex} is faded`);
    assert.ok(gap(after.h, before.h) < 4, `${chips[i].hex} keeps its hue`);
    assert.ok(Math.abs(after.L - lch(RED).L) > Math.abs(before.L - lch(RED).L) + 0.04, `${chips[i].hex} sits further from the hero's lightness, darker or lighter`);
  }
  assert.ok(minGap(out) >= Math.min(minGap(same(chips)), 0.06) - 1e-9, 'nothing is pushed into a near-twin');
}

{
  const out = calmClash([chip(GREEN, 'hero'), chip(RED), chip(GRAY)]);
  assert.equal(out[0], GREEN, 'a green hero keeps its vividness');
  assert.ok(lch(out[1]).C <= 0.07, 'and the red is the one that fades');
}

{
  const out = calmClash([chip(RED, 'hero'), chip(GREEN, 'accent'), chip(GRAY)]);
  assert.ok(lch(out[1]).C <= 0.07, 'a faded accent is fine, and often better than two vivid ones');
}

{
  const chips = [chip(RED), chip(GREEN), chip(GRAY)];
  const out = calmClash(chips);
  assert.equal(out[0], RED, 'with no hero, the more vivid of the two stays');
  assert.ok(lch(out[1]).C <= 0.07, 'and the other fades');
}

{
  const out = calmClash([chip(BLUE, 'hero'), chip(RED), chip(GREEN)]);
  assert.equal(out[1], RED, 'a hero that is neither: the more vivid of the two stays');
  assert.ok(lch(out[2]).C <= 0.07, 'and the other fades');
}

{
  // The dragonfly: grays sit just darker than the green, so it can only fade lighter. It still fades.
  const chips = [chip('#5A852B', 'accent'), chip('#E42E07', 'hero'), chip('#111716', 'dark'), chip('#B09996', 'light'), chip('#5D504C'), chip('#2D3632'), chip('#552111')];
  const out = calmClash(chips);
  assert.ok(lch(out[0]).C <= 0.07, 'a faded chip finds room on the other side of its neighbors');
  assert.ok(minGap(out) >= Math.min(minGap(same(chips)), 0.06) - 1e-9, 'without crowding any of them');
}

{
  const chips = [chip(RED, 'hero'), chip(SAGE), chip(GRAY)];
  assert.deepEqual(calmClash(chips), same(chips), 'a green that is already muted is no clash');
  const noRed = [chip(BLUE, 'hero'), chip(GREEN), chip(GRAY)];
  assert.deepEqual(calmClash(noRed), same(noRed), 'a green with no red beside it is left alone');
}

{
  const chips = [chip(RED, 'hero'), chip(GREEN), chip(GRAY)];
  assert.deepEqual(calmClash(chips), calmClash(chips), 'the same palette is treated the same way');
  assert.deepEqual(chips, [chip(RED, 'hero'), chip(GREEN), chip(GRAY)], 'and what was passed in is not changed');
}

console.log('ok 16-clash');
