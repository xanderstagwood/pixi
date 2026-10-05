// buildPalette: what analyze() settles before anything moves. Characterization of the current behaviour.
import assert from 'node:assert/strict';
import { buildPalette } from '../src/palette.js';
import { clear, flat, mulberry32, noise, patches } from './img.mjs';

const HEXES = ['#C0392B', '#2980B9', '#27AE60', '#F1C40F', '#8E44AD', '#E67E22', '#ECF0F1', '#16A085', '#34495E', '#D35400', '#7F8C8D', '#FD79A8'];
const photo = () => noise(HEXES, mulberry32(7));
const build = (img, seed = 1) => buildPalette(img, mulberry32(seed));

const p = build(photo());
assert.equal(p.colors.length, 7, 'a palette has seven colors');
assert.ok(p.colors.every((c) => /^#[0-9A-F]{6}$/i.test(c)), 'every color is a #RRGGBB hex');
assert.equal(p.coordinates.length, 7, 'every slot has a coordinate');
assert.ok(p.coordinates.every(({ x, y }) => x >= 0 && x <= 1 && y >= 0 && y <= 1), 'coordinates are 0-1 fractions of the image');
assert.deepEqual([...p.slotOf].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6], 'slotOf is a permutation of the seven slots');
p.clusters.forEach((_, i) => {
  assert.equal(p.colors[p.slotOf[i]], p.candidates[i][p.keep[i]], `slot ${p.slotOf[i]} shows the candidate kept for cluster ${i}`);
});
p.clusters.forEach((c, i) => {
  assert.deepEqual(p.coordinates[p.slotOf[i]], { x: c.x, y: c.y }, `slot ${p.slotOf[i]} keeps the place of cluster ${i}`);
});

assert.deepEqual(build(photo(), 3), build(photo(), 3), 'the same image and the same random give the same palette');

assert.equal(build(clear()), null, 'a fully transparent image has no palette');

const one = build(flat('#336699'));
assert.equal(one.colors.length, 7, 'a one-color image still gives seven colors');

const few = build(patches([{ hex: '#CC2222', share: 0.5 }, { hex: '#2222CC', share: 0.5 }]));
assert.equal(few.colors.length, 7, 'a two-color image still gives seven colors');

console.log('ok 01-palette');
