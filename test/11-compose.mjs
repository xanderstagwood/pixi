// choose, by scheme: the picture's scheme sets how many of the seven chips each color group gets (about 60/30/10),
// each group is a ramp from dark to light, and a group that cannot fill its share hands the rest on.
import assert from 'node:assert/strict';
import { rgbToHex } from '../src/color.js';
import { choose } from '../src/chooser.js';
import { oklchToRgb, rgbToOklab, toOklch } from '../src/oklab.js';
import { hexToRgb } from '../src/color.js';
import { mulberry32 } from './img.mjs';

const hex = (L, C, h) => rgbToHex(oklchToRgb({ L, C, h }));
const lch = (h) => toOklch(rgbToOklab(hexToRgb(h)));
const entry = (h, share) => ({ hex: h, x: 0.5, y: 0.5, share });
const hueGap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const fam = (h, share, Ls = [0.3, 0.45, 0.6, 0.75], C = 0.13) => Ls.map((L) => entry(hex(L, C, h), share / Ls.length));
const mids = (share) => [0.45, 0.55, 0.65].map((L) => entry(hex(L, 0, 0), share / 3));
const seeds = (n) => Array.from({ length: n }, (_, i) => mulberry32(i + 1));
// How many of the picks sit in the group at hue `h` (a family within 25 degrees), or with `h` null, among the neutrals.
const inGroup = (picks, h) => picks.filter((p) => { const o = lch(p.hex); return h === null ? o.C < 0.04 : o.C >= 0.04 && hueGap(o.h, h) < 25; }).length;
const unique = (picks) => new Set(picks.map((p) => p.hex)).size === picks.length;

for (const rng of seeds(10)) {
  const { picks, mode } = choose([...fam(30, 0.5, [0.25, 0.4, 0.55, 0.7, 0.85]), ...fam(210, 0.3), ...mids(0.2)], 7, rng);
  assert.equal(mode, 'complementary', 'two opposite hues are complementary');
  assert.equal(picks.length, 7, 'seven chips');
  assert.ok(unique(picks), 'and no color twice');
  const [a, b, n] = [inGroup(picks, 30), inGroup(picks, 210), inGroup(picks, null)];
  assert.ok(a >= 3 && a > b, 'the dominant hue gets about 60% of the chips');
  assert.ok(b >= 1 && b <= 2, 'its complement about 30%');
  assert.ok(n >= 1 && n <= 2, 'and a neutral or two hold it together');
}

for (const rng of seeds(10)) {
  const grays = Array.from({ length: 8 }, (_, i) => entry(hex(0.12 + i * 0.1, 0, 0), 0.97 / 8));
  const { picks, mode } = choose([...grays, ...fam(30, 0.02, [0.4, 0.55, 0.7], 0.2), ...fam(140, 0.01, [0.45, 0.6], 0.15)], 7, rng);
  assert.equal(mode, 'neutral-pop', 'a picture of neutrals with a little color is neutrals and pops');
  assert.equal(inGroup(picks, null), 4, 'four neutrals');
  assert.equal(inGroup(picks, 30), 2, 'two of the main pop hue');
  assert.equal(inGroup(picks, 140), 1, 'and the other pop');
}

for (const rng of seeds(10)) {
  const { picks, mode } = choose([...fam(40, 0.85, [0.25, 0.35, 0.5, 0.62, 0.74, 0.86]), ...mids(0.15)], 7, rng);
  assert.equal(mode, 'tonal', 'one hue is tonal');
  assert.ok(inGroup(picks, 40) >= 4, 'mostly that hue');
  const Ls = picks.map((p) => lch(p.hex).L);
  assert.ok(Math.max(...Ls) - Math.min(...Ls) >= 0.5, 'in a ramp from dark to light');
}

for (const rng of seeds(10)) {
  const pool = [...fam(20, 0.4, [0.2, 0.4, 0.6, 0.9]), ...fam(140, 0.3, [0.25, 0.45, 0.65, 0.85]), ...fam(260, 0.2, [0.3, 0.5, 0.7, 0.8]), ...mids(0.1)];
  const { picks, mode } = choose(pool, 7, rng);
  assert.equal(mode, 'triadic', 'three hues evenly spread are triadic');
  assert.ok(inGroup(picks, 20) >= 2 && inGroup(picks, 140) >= 1 && inGroup(picks, 260) >= 1, 'each of the three hues is there, the biggest most');
  assert.ok(inGroup(picks, 20) >= inGroup(picks, 140) && inGroup(picks, 140) >= inGroup(picks, 260), 'in the order of their size');
}

{
  const rainbow = Array.from({ length: 8 }, (_, i) => fam(i * 45, 0.1, [0.4, 0.6, 0.8])).flat();
  const sets = new Set();
  for (const rng of seeds(20)) {
    const { picks, mode } = choose(rainbow, 7, rng);
    assert.equal(mode, 'analogous', 'a rainbow is more than any scheme, so a neighbourhood of it is taken');
    const hues = picks.map((p) => lch(p.hex).h).sort((x, y) => x - y);
    const arcs = hues.map((h, i) => (i ? h - hues[i - 1] : h + 360 - hues[hues.length - 1]));
    assert.ok(360 - Math.max(...arcs) <= 160, 'the neighbourhood is a stretch of the wheel, not all of it');
    sets.add(picks.map((p) => p.hex).sort().join());
  }
  assert.ok(sets.size >= 2, 'and not always the same stretch');
}

{
  const thin = [...fam(30, 0.5, [0.25, 0.4, 0.55, 0.7, 0.85]), entry(hex(0.5, 0.13, 210), 0.3), ...mids(0.2)];
  const { picks, mode } = choose(thin, 7, mulberry32(1));
  assert.equal(mode, 'complementary', 'a complement with a single color is still the complement');
  assert.equal(picks.length, 7, 'and a group that cannot fill its share hands the rest on');
  assert.ok(unique(picks), 'without repeating a color');
}

console.log('ok 11-compose');
