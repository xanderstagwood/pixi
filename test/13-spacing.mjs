// One shared rule after the colors are chosen: no step (the nudge, the variations) leaves two chips closer than
// TELLABLE, or closer than the chooser left them. A step that would break it is skipped.
import assert from 'node:assert/strict';
import { hexToRgb } from '../src/color.js';
import { choose } from '../src/chooser.js';
import { extractColors } from '../src/extract.js';
import { TELLABLE, deltaE, rgbToOklab } from '../src/oklab.js';
import { buildPalette } from '../src/palette.js';
import { harmonize } from '../src/harmony.js';
import { mulberry32, patches } from './img.mjs';

assert.equal(TELLABLE, 0.08, 'two chips closer than this are near-twins');

const lab = (h) => rgbToOklab(hexToRgb(h));
const minGap = (list) => Math.min(...list.flatMap((a, i) => list.slice(i + 1).map((b) => deltaE(lab(a), lab(b)))));

// The nudge keeps the rule.
{
  const chips = [{ hex: '#D00806', role: 'hero' }, { hex: '#A66A3C', role: '' }, { hex: '#B0501E', role: '' }, { hex: '#C45D15', role: '' }, { hex: '#8A5947', role: '' }];
  const before = chips.map((c) => c.hex);
  assert.ok(minGap(harmonize(chips)) >= Math.min(minGap(before), TELLABLE) - 1e-9, 'nudging never pushes two chips into near-twins');
}

// The whole pipeline keeps it, on pictures of every shape.
const PICTURES = {
  road: patches([
    { hex: '#010100', share: 0.5 }, { hex: '#100E07', share: 0.12 }, { hex: '#1E2113', share: 0.06 }, { hex: '#5F6C60', share: 0.02 },
    { hex: '#FC0201', share: 0.05 }, { hex: '#D00806', share: 0.05 }, { hex: '#940E08', share: 0.04 }, { hex: '#580706', share: 0.04 },
    { hex: '#FB2804', share: 0.03 }, { hex: '#FC4F05', share: 0.03 }, { hex: '#D14B0E', share: 0.03 }, { hex: '#F8AB0E', share: 0.02 },
  ]),
  pair: patches([
    { hex: '#C0501E', share: 0.14 }, { hex: '#E0702E', share: 0.14 }, { hex: '#A03A14', share: 0.12 }, { hex: '#F09A5A', share: 0.1 },
    { hex: '#1E5C8A', share: 0.14 }, { hex: '#2E7CB0', share: 0.14 }, { hex: '#0E3C5A', share: 0.12 }, { hex: '#7EB4D8', share: 0.1 },
  ]),
  tonal: patches([
    { hex: '#2A1F14', share: 0.14 }, { hex: '#4A3622', share: 0.14 }, { hex: '#6A4C30', share: 0.14 }, { hex: '#8A6640', share: 0.14 },
    { hex: '#AA8458', share: 0.14 }, { hex: '#CAA474', share: 0.12 }, { hex: '#EAC490', share: 0.1 }, { hex: '#6E6A66', share: 0.08 },
  ]),
  rainbow: patches(Array.from({ length: 10 }, (_, i) => ({ hex: ['#D03030', '#D07A30', '#D0C030', '#80C030', '#30B050', '#30B0A0', '#3070C0', '#6040C0', '#A040B0', '#C03080'][i], share: 0.1 }))),
};
for (const [name, image] of Object.entries(PICTURES)) {
  for (let seed = 1; seed <= 25; seed++) {
    const rng = mulberry32(seed);
    const pool = extractColors(image, 12, undefined, rng).map((c) => ({ ...c, hex: c.vivid }));
    const { picks, mode } = choose(pool, 7, rng);
    if (mode === 'exact') continue;
    const final = buildPalette(image, mulberry32(seed)).colors;
    assert.ok(minGap(final) >= Math.min(minGap(picks.map((p) => p.hex)), TELLABLE) - 1e-9, `${name} (seed ${seed}): the final palette is no more crowded than the chooser left it`);
  }
}

console.log('ok 13-spacing');
