import { rgbToHex } from './color.js';
import { TELLABLE, deltaE, oklchToRgb } from './oklab.js';
import { seen } from './scheme.js';

// A vivid red beside a vivid green reads as Christmas. When a palette holds both, the one that is the hero (or, with
// no red or green hero, the more vivid) keeps its vividness and the other is faded and moved darker or lighter than
// it: the picture's colors are adjusted for a pleasing card, not copied. The hero and the anchors are never touched.
const VIVID = 0.1; // chroma at which a red or a green is loud
const FADE = 0.05; // chroma a faded chip is left with
const AWAY = 0.1; // how much further from the vivid chip's lightness a faded chip is moved
const RED = [30, 22]; // hue and reach, in degrees, of what counts as red
const GREEN = [135, 28]; // and as green

const gap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const within = (c, [hue, reach]) => c.C >= VIVID && gap(c.h, hue) <= reach;

/**
 * @param {{hex: string, role: string}[]} chips the palette; `role` is '' for a free chip
 * @returns {string[]} the hex of each chip, with a clashing red or green faded
 */
export function calmClash(chips) {
  const out = chips.map((c) => c.hex);
  const s = chips.map(seen);
  const reds = s.filter((c) => within(c, RED)), greens = s.filter((c) => within(c, GREEN));
  if (!reds.length || !greens.length) return out;

  const top = (list) => list.reduce((best, c) => (c.C > best.C ? c : best));
  const heroed = (list) => list.find((c) => chips[s.indexOf(c)].role === 'hero');
  const winner = heroed(reds) ? reds : heroed(greens) ? greens : top(reds).C >= top(greens).C ? reds : greens;
  const loser = winner === reds ? greens : reds;
  const vivid = top(winner);

  chips.forEach((c, i) => {
    if (!loser.includes(s[i]) || c.role === 'hero' || c.role === 'dark' || c.role === 'light') return;
    const dir = s[i].L < vivid.L ? -1 : 1;
    const others = out.filter((_, k) => k !== i).map((h) => seen({ hex: h }).lab);
    const nearest = (lab) => Math.min(...others.map((o) => deltaE(lab, o)));
    const room = Math.min(nearest(s[i].lab), TELLABLE);
    // The side it already lies on first, then further, then the far side: a faded chip must not crowd a neighbor.
    for (const step of [AWAY * dir, 2 * AWAY * dir, -AWAY * dir, -2 * AWAY * dir]) {
      const hex = rgbToHex(oklchToRgb({ L: Math.max(0.05, Math.min(0.95, s[i].L + step)), C: Math.min(s[i].C, FADE), h: s[i].h }));
      if (nearest(seen({ hex }).lab) >= room) { out[i] = hex; break; }
    }
  });
  return out;
}
