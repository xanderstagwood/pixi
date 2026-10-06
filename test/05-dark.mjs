// liftToGround: a bloxel never draws darker than the ground, but a dark color keeps its hue and chroma
// when it is lifted, so a dark red stays reddish instead of going gray-black.
import assert from 'node:assert/strict';
import { GROUND, hexToRgb, liftToGround } from '../src/color.js';
import { rgbToOklab, toOklch } from '../src/oklab.js';

const lch = (rgb) => toOklch(rgbToOklab(rgb));
const rgb = (hex) => hexToRgb(hex);
const hueGap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const floorL = lch(rgb(GROUND)).L;

const ground = liftToGround(rgb(GROUND));
for (const k of ['r', 'g', 'b']) assert.ok(Math.abs(ground[k] - rgb(GROUND)[k]) <= 1, `the ground itself stays the ground (${k})`);

for (const hex of ['#F1C40F', '#808080', '#3A3A3A']) {
  assert.deepEqual(liftToGround(rgb(hex)), rgb(hex), `${hex} is no darker than the ground, so it is left alone`);
}

for (const hex of ['#2A0606', '#05051F', '#0A1F0A', '#0E0E10', '#000000']) {
  assert.ok(lch(liftToGround(rgb(hex))).L >= floorL - 0.01, `${hex} is lifted to at least the ground's lightness`);
}

for (const hex of ['#2A0606', '#05051F', '#0A1F0A']) {
  const before = lch(rgb(hex)), after = lch(liftToGround(rgb(hex)));
  assert.ok(hueGap(before.h, after.h) < 6, `${hex} keeps its hue`);
  assert.ok(after.C >= before.C * 0.7, `${hex} keeps its chroma, it does not go gray`);
}

const black = liftToGround(rgb('#000000'));
assert.ok(lch(black).C < 0.01, 'black has no chroma to keep, so it lifts to a neutral and is not tinted');

console.log('ok 05-dark');
