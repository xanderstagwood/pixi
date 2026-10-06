import { rgbToHex } from './color.js';
import { TELLABLE, deltaE, oklchToRgb } from './oklab.js';
import { CHROMATIC, familiesOf, seen } from './scheme.js';

// Make the pop pop: the hero is the most vivid chip, so it stands out most when the colors beside it are quieter.
// The hero's own family is tempered, and a free chip far louder than the rest is brought down to meet them. The
// chips the palette is built around (the hero, the accent, the anchors) keep their chroma, and nothing is raised:
// a dull chip is what makes a vivid one read stronger.
const TEMPER = 0.7; // share of its chroma a free chip of the hero's family keeps
const CEILING = 1.2; // a free chip is never louder than this many times the typical chroma
const FLOOR = 0.07; // a family quieter than this, on average, has no pop to make: tempering it would only dull it

const median = (v) => { const s = [...v].sort((a, b) => a - b); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };

/**
 * @param {{hex: string, role: string}[]} chips the palette; `role` is '' for a chip free to be changed
 * @returns {string[]} the hex of each chip, with its chroma tempered
 */
export function intensify(chips) {
  const out = chips.map((c) => c.hex);
  const hero = chips.findIndex((c) => c.role === 'hero');
  if (hero < 0) return out;
  const s = chips.map(seen);
  const family = familiesOf(s).find((g) => g.includes(s[hero]));
  if (!family || family.reduce((sum, c) => sum + c.C, 0) / family.length < FLOOR) return out;

  const free = (i) => !chips[i].role && s[i].C >= CHROMATIC;
  const tempered = s.map((c, i) => (free(i) && family.includes(c) ? c.C * TEMPER : c.C));
  const typical = median(tempered.filter((_, i) => free(i)));

  chips.forEach((c, i) => {
    if (!free(i)) return;
    const C = Math.min(tempered[i], typical * CEILING);
    if (C === s[i].C) return;
    const hex = rgbToHex(oklchToRgb({ L: s[i].L, C, h: s[i].h }));
    const others = out.filter((_, k) => k !== i).map((h) => seen({ hex: h }).lab);
    const nearest = (lab) => Math.min(...others.map((o) => deltaE(lab, o)));
    if (nearest(seen({ hex }).lab) >= Math.min(nearest(s[i].lab), TELLABLE)) out[i] = hex;
  });
  return out;
}
