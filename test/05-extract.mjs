// extractColors under a seeded rng, clustering in OKLab: pinned to the output it gives, so a later change cannot
// quietly change which colors a picture gives. A full pool of twelve gives back all twelve colors the picture was made of.
import assert from 'node:assert/strict';
import { extractColors } from '../src/extract.js';
import { hexToRgb } from '../src/color.js';
import { deltaE, rgbToOklab, toOklch } from '../src/oklab.js';
import { mulberry32, noise, patches } from './img.mjs';

const HEXES = ['#C0392B', '#2980B9', '#27AE60', '#F1C40F', '#8E44AD', '#E67E22', '#ECF0F1', '#16A085', '#34495E', '#D35400', '#7F8C8D', '#FD79A8'];
const rounded = (list) => list.map((c) => [c.hex, +c.x.toFixed(4), +c.y.toFixed(4)]);

assert.deepEqual(rounded(extractColors(noise(HEXES, mulberry32(7)), 7, 12, mulberry32(5))), [
  ['#44988F', 0.9844, 0.0156], ['#ECF0F1', 0.1406, 0.0156], ['#34495E', 0.1094, 0.0156], ['#F27D77', 0.0781, 0.0156],
  ['#CB491C', 0.3906, 0.0156], ['#F1C40F', 0.3281, 0.0156], ['#8E44AD', 0.1719, 0.0156],
], 'seven colors of a twelve-color noise picture are unchanged');

assert.deepEqual(rounded(extractColors(noise(HEXES, mulberry32(7)), 12, 12, mulberry32(5))), [
  ['#7F8C8D', 0.6719, 0.0156], ['#ECF0F1', 0.1406, 0.0156], ['#34495E', 0.1094, 0.0156], ['#FD79A8', 0.0781, 0.0156],
  ['#C0392B', 0.0156, 0.0156], ['#F1C40F', 0.3281, 0.0156], ['#8E44AD', 0.1719, 0.0156], ['#E67E22', 0.2031, 0.0156],
  ['#27AE60', 0.2344, 0.0156], ['#2980B9', 0.3594, 0.0156], ['#16A085', 0.9844, 0.0156], ['#D35400', 0.3906, 0.0156],
], 'a full pool of twelve is unchanged');

assert.deepEqual(rounded(extractColors(patches([{ hex: '#CC2222', share: 0.6 }, { hex: '#223344', share: 0.39 }, { hex: '#22CC44', share: 0.01 }]), 7, 12, mulberry32(9))), [
  ['#CC2222', 0.0156, 0.0156], ['#22CC44', 0.7031, 0.9844], ['#223344', 0.2344, 0.6094], ['#CC2222', 0.0156, 0.0156],
  ['#CC2222', 0.0156, 0.0156], ['#CC2222', 0.0156, 0.0156], ['#CC2222', 0.0156, 0.0156],
], 'a small vivid patch still earns its own color');

// A cluster is an average, so a vivid patch on a dark ground comes out muted. `vivid` is what its most vivid pixels look like.
{
  const lab = (h) => rgbToOklab(hexToRgb(h));
  const [one] = extractColors(patches([{ hex: '#400808', share: 0.75 }, { hex: '#E01010', share: 0.25 }]), 1, 12, mulberry32(1));
  assert.equal(typeof one.vivid, 'string', 'every cluster has a vivid face');
  assert.ok(toOklch(lab(one.vivid)).C > toOklch(lab(one.hex)).C + 0.05, 'a muddy average has a clearly more vivid face');
  assert.ok(deltaE(lab(one.vivid), lab('#E01010')) < 0.03, 'and it is the color the vivid pixels really are');
  const flat = extractColors(patches([{ hex: '#336699', share: 1 }]), 3, 12, mulberry32(1));
  assert.ok(flat.every((c) => c.vivid === '#336699'), 'a flat picture has nothing vivid to find, and keeps its color exactly');
}

console.log('ok 05-extract');
