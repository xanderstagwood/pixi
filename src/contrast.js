import { hexToRgb, rgbToHex } from './color.js';
import { oklchToRgb, rgbToOklab, toOklch } from './oklab.js';

// A palette needs a real range from dark to light to read as one. When its lightest and darkest chips are close in
// lightness, those two are nudged apart; the rest are left as they are. The ends only ever move outward, so the ramp
// stays one way.
const FLOOR = 0.5; // the least lightness range a palette should have
const NUDGE = 0.06; // the most either end is moved
const DARKEST = 0.08; // lightness the ends are never pushed past: below this a color rounds to pure black,
const LIGHTEST = 0.98; // and above this to pure white

/**
 * @param {string[]} hexes the palette's colors
 * @returns {string[]} the colors, with the lightest and darkest moved outward if the range is under the floor
 */
export function lift(hexes) {
  const out = [...hexes];
  if (hexes.length < 2) return out;
  const lch = hexes.map((h) => toOklch(rgbToOklab(hexToRgb(h))));
  const lowest = lch.reduce((best, c, i) => (c.L < lch[best].L ? i : best), 0);
  const highest = lch.reduce((best, c, i) => (c.L > lch[best].L ? i : best), 0);
  const range = lch[highest].L - lch[lowest].L;
  if (range >= FLOOR) return out;
  const move = Math.min(NUDGE, (FLOOR - range) / 2);
  const shift = (i, L) => rgbToHex(oklchToRgb({ ...lch[i], L }));
  out[lowest] = shift(lowest, Math.max(lch[lowest].L - move, Math.min(lch[lowest].L, DARKEST)));
  out[highest] = shift(highest, Math.min(lch[highest].L + move, Math.max(lch[highest].L, LIGHTEST)));
  return out;
}
