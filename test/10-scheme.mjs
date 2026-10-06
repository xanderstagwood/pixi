// detect: what direction a picture's colors can go in. Read from the colors themselves (how much is neutral, how many
// hue families, how far apart), never from the photo's name or subject: any picture gets an honest answer.
import assert from 'node:assert/strict';
import { rgbToHex } from '../src/color.js';
import { oklchToRgb } from '../src/oklab.js';
import { detect } from '../src/scheme.js';

const hex = (L, C, h) => rgbToHex(oklchToRgb({ L, C, h }));
const entry = (h, share) => ({ hex: h, x: 0.5, y: 0.5, share });
// A family: three shades of one hue sharing `share` between them.
const family = (h, share, C = 0.13) => [0.4, 0.6, 0.78].map((L) => entry(hex(L, C, h), share / 3));
const grays = (share, n = 5) => Array.from({ length: n }, (_, i) => entry(hex(0.15 + (0.7 * i) / (n - 1), 0, 0), share / n));
const names = (pool) => detect(pool).name;

assert.equal(names(grays(1, 6)), 'tonal', 'a gray picture is a ramp of values');
assert.equal(detect(grays(1, 6)).families.length, 0, 'with no hue in it');

{
  const found = detect([...grays(0.97, 8), ...family(29, 0.02, 0.2), ...family(138, 0.01, 0.15)]);
  assert.equal(found.name, 'neutral-pop', 'a picture that is nearly all neutral, with a little color, is neutrals and pops');
  assert.equal(found.families.length, 2, 'both small colors are pops');
  assert.ok(Math.abs(found.families[0].hue - 29) < 12, 'the bigger pop comes first');
  assert.ok(found.neutral > 0.9, 'and it reports how neutral the picture is');
}

assert.equal(names([...family(40, 0.9), ...grays(0.1, 3)]), 'tonal', 'one hue and a little gray is tonal');
assert.equal(names([...family(180, 0.45), ...family(0, 0.45), ...grays(0.1, 3)]), 'complementary', 'two hues opposite each other are complementary');
assert.equal(names([...family(30, 0.45), ...family(130, 0.45), ...grays(0.1, 3)]), 'dichromatic', 'two hues a third of the wheel apart are a pair of colors');
assert.equal(names([...family(30, 0.45), ...family(75, 0.45), ...grays(0.1, 3)]), 'analogous', 'two hues next to each other are analogous');
assert.equal(names([...family(20, 0.3), ...family(140, 0.3), ...family(260, 0.3), ...grays(0.1, 3)]), 'triadic', 'three hues evenly spread are triadic');
assert.equal(names([...family(0, 0.4), ...family(150, 0.25), ...family(210, 0.25), ...grays(0.1, 3)]), 'split-complementary', 'one hue and the two beside its opposite are split-complementary');
assert.equal(names([...family(10, 0.3), ...family(40, 0.3), ...family(75, 0.3), ...grays(0.1, 3)]), 'analogous', 'three neighbours are analogous');
assert.equal(names([...family(0, 0.22), ...family(90, 0.22), ...family(180, 0.22), ...family(270, 0.22), ...grays(0.12, 3)]), 'square', 'four hues evenly spread are a square');
assert.equal(names([...family(0, 0.22), ...family(40, 0.22), ...family(180, 0.22), ...family(220, 0.22), ...grays(0.12, 3)]), 'tetradic', 'two pairs of opposites are tetradic');
assert.equal(names(Array.from({ length: 8 }, (_, i) => family(i * 45, 0.1)).flat()), 'analogous', 'a rainbow is more than any scheme: a neighbourhood of it is taken');

assert.equal(names([...family(180, 0.45), ...family(0, 0.45), ...family(90, 0.002), ...grays(0.1, 3)]), 'complementary', 'a speck of a third hue does not make a third family');
assert.equal(names([...family(350, 0.45), ...family(12, 0.45), ...grays(0.1, 3)]), 'tonal', 'hues either side of red are one family, across the wrap at 0');

{
  const pool = [...family(180, 0.3), ...family(0, 0.6), ...grays(0.1, 3)];
  const found = detect(pool);
  assert.ok(found.families[0].share > found.families[1].share, 'families are ordered biggest first');
  assert.deepEqual(detect(pool), found, 'the same picture is read the same way');
  const copy = JSON.stringify(pool);
  detect(pool);
  assert.equal(JSON.stringify(pool), copy, 'and what was passed in is not changed');
}

console.log('ok 10-scheme');
