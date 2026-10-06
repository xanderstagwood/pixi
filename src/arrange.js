import { hexToRgb } from './color.js';
import { TELLABLE, deltaE, rgbToOklab } from './oklab.js';
import { classify } from './perceive.js';

// What a finished order costs, and which of each color's candidates fits it best. The order itself is made in
// gradient.js: a clean ramp, dark to light or light to dark, with warm to cool settling what the ramp leaves open.
//
// Each color is judged as a person would judge it (perceive.js): how warm it looks and how light it looks. A step that
// a viewer could not tell from level (under a just-noticeable difference) is not held against the order.

const TEMP_TOLERANCE = 0.2; // warmth steps smaller than this read as level: a near-black and an indigo are both just cool
const SHADE_TOLERANCE = 0.04; // so do lightness steps smaller than this
const WEIGHT = { temperature: 0.15, shade: 1 }; // the value ramp leads; warmth only settles what the ramp leaves open
const STEEP = 100; // going against the ramp costs this much more than anything warmth can win back: the ramp is never given up
const ZIGZAG = 0.25; // among orders that fit equally, prefer the one closest to a clean sort
// A gradient should not lurch: big steps between neighbours cost, squared, so two colors that are level
// on temperature go in whichever order makes the gentler run of lightness. Lightness lurches are what
// an eye notices most, so it counts for more than warmth.
const SMOOTH = { temperature: 0.1, shade: 1.5 };

/** Steps that go against `dir` (+1 rising, -1 falling), beyond the tolerance. */
function against(x, dir, tolerance, from = 0, to = x.length - 1) {
  let sum = 0;
  for (let k = from; k < to; k++) sum += Math.max(0, -dir * (x[k + 1] - x[k]) - tolerance);
  return sum;
}

/** Sum of squared steps: small when neighbours are close, and evenest for a given span when the steps are equal. */
function lurch(x) {
  let sum = 0;
  for (let k = 0; k < x.length - 1; k++) sum += (x[k + 1] - x[k]) ** 2;
  return sum;
}

/** How far a run of numbers wanders beyond a straight sort: total movement minus net movement. */
function zigzag(x) {
  let total = 0;
  for (let k = 0; k < x.length - 1; k++) total += Math.abs(x[k + 1] - x[k]);
  return total - Math.abs(x[x.length - 1] - x[0]);
}

/** Cost of a run of warmth values for a temperature pattern; 0 is a perfect fit. */
export function temperatureCost(w, pattern) {
  const dir = pattern === 'cool-to-warm' ? 1 : -1;
  return against(w, dir, TEMP_TOLERANCE) + ZIGZAG * zigzag(w) + SMOOTH.temperature * lurch(w);
}

/** Cost of a run of lightness values for a shade pattern; 0 is a perfect fit. */
export function shadeCost(s, pattern) {
  return STEEP * against(s, pattern === 'dark-to-light' ? 1 : -1, SHADE_TOLERANCE) + ZIGZAG * zigzag(s) + SMOOTH.shade * lurch(s);
}

/** Warmth and lightness for each color, as an eye judges them. */
const judge = (hexes) => hexes.map(classify);

/** Cost of a run of colors, in order, against a pair of patterns. */
export function patternCost(hexes, temperature, shade) {
  const seen = judge(hexes);
  return WEIGHT.temperature * temperatureCost(seen.map((c) => c.warmth), temperature)
    + WEIGHT.shade * shadeCost(seen.map((c) => c.shade), shade);
}

const lab = (hex) => rgbToOklab(hexToRgb(hex));

/**
 * Picks which of each color's candidates to keep, so the finished order fits its patterns as well as it
 * can and no two chips end up too alike to tell apart: a candidate that would crowd another chip is never kept. A candidate is a small nudge on its base
 * color; the base wins unless a nudge is a clear improvement. A little chance keeps runs different.
 * @param {string[][]} candidates per color (indexed as `order` is), base first
 * @param {{order: number[], temperature: string, shade: string}} plan from `arrange`
 * @returns {number[]} the candidate to keep for each color
 */
export function decide(candidates, plan, random = Math.random) {
  const keep = candidates.map(() => 0);
  const cost = () => {
    const run = plan.order.map((i) => candidates[i][keep[i]]);
    let alike = 0;
    for (let k = 0; k < run.length - 1; k++) alike += Math.max(0, 0.05 - deltaE(lab(run[k]), lab(run[k + 1])));
    return patternCost(run, plan.temperature, plan.shade) + 4 * alike;
  };
  for (let pass = 0; pass < 2; pass++) {
    for (const i of plan.order) {
      let bestCost = Infinity, bestIndex = 0;
      const others = () => plan.order.filter((j) => j !== i).map((j) => lab(candidates[j][keep[j]]));
      const crowd = (c) => Math.min(...others().map((o) => deltaE(lab(candidates[i][c]), o)));
      const room = Math.min(crowd(0), TELLABLE); // a nudge never leaves this chip closer to another than it was, or than a tellable gap
      for (let c = 0; c < candidates[i].length; c++) {
        if (c > 0 && crowd(c) < room) continue;
        keep[i] = c;
        const total = cost() + (c === 0 ? 0 : 0.02) + random() * 0.015;
        if (total < bestCost) { bestCost = total; bestIndex = c; }
      }
      keep[i] = bestIndex;
    }
  }
  return keep;
}
