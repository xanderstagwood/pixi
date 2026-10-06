import { variations } from './color.js';
import { decide } from './arrange.js';
import { calmClash } from './clash.js';
import { choose } from './chooser.js';
import { lift } from './contrast.js';
import { extractColors } from './extract.js';
import { gradient } from './gradient.js';
import { harmonize } from './harmony.js';
import { intensify } from './intensity.js';

const POOL = 12; // colors of a picture the seven are chosen from

/**
 * Everything about a palette that is settled before anything moves. The seven are chosen from the
 * picture's twelve for contrast and company (chooser.js). The free chips are nudged a little toward the palette's
 * own hue so they flow together (harmony.js), and the hero's family is tempered so the hero pops (intensity.js), and a vivid red beside a vivid green is faded to one of them (clash.js). The chips are ordered as one ramp, each color family in a block, and
 * their lightness fitted to it (gradient.js), and the lightest and darkest pushed apart if the card is flat (contrast.js). Then each color keeps whichever of its five candidates makes the order
 * fit best, never one that crowds another chip (decide). A picture that is answered exactly keeps its colors
 * exactly: nothing is nudged or fitted.
 * @param {{data: Uint8ClampedArray, width: number, height: number}} pixels
 * @param {() => number} random seeds the extraction and breaks ties, so a fixed one makes the palette repeatable
 * @param {number} chips how many colors a palette holds
 * @returns {null | {clusters: {hex: string, x: number, y: number}[], candidates: string[][], keep: number[], slotOf: number[], colors: string[], coordinates: {x: number, y: number}[]}}
 *   null when the picture has no opaque pixel
 */
export function buildPalette(pixels, random = Math.random, chips = 7) {
  // A cluster shows as its vivid face: the palette is made of the picture's best colors, not its averages.
  const pool = extractColors(pixels, POOL, undefined, random).map((c) => ({ ...c, hex: c.vivid }));
  if (!pool.length) return null;

  const { picks, roles, mode } = choose(pool, chips, random);
  let clusters = picks;
  if (mode !== 'exact') {
    const nudged = harmonize(clusters.map((c, i) => ({ hex: c.hex, role: roles[i] })), mode);
    const strong = intensify(nudged.map((hex, i) => ({ hex, role: roles[i] })));
    const tuned = calmClash(strong.map((hex, i) => ({ hex, role: roles[i] })));
    clusters = clusters.map((c, i) => ({ ...c, hex: tuned[i] }));
  }
  // The order, and the chips' lightness fitted to it as one gradient (an exact palette is only ordered).
  const plan = gradient(clusters.map((c, i) => ({ hex: c.hex, role: roles[i] })), random, mode !== 'exact');
  const hexes = mode === 'exact' ? plan.hexes : lift(plan.hexes); // then the range, if the card came out flat
  clusters = clusters.map((c, i) => ({ ...c, hex: hexes[i] }));
  const arrangement = { order: plan.order, temperature: plan.temperature, shade: plan.shade };
  const candidates = clusters.map((c) => (mode === 'exact' ? [c.hex] : variations(c.hex)));
  const keep = decide(candidates, arrangement, random);
  const slotOf = []; // cluster index -> slot (0 = bottom row); the arrangement lists the top row first
  arrangement.order.forEach((cluster, row) => { slotOf[cluster] = chips - 1 - row; });

  const colors = [], coordinates = [];
  clusters.forEach((c, i) => {
    colors[slotOf[i]] = candidates[i][keep[i]];
    coordinates[slotOf[i]] = { x: c.x, y: c.y };
  });
  return { clusters, candidates, keep, slotOf, colors, coordinates };
}
