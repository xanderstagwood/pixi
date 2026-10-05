import { variations } from './color.js';
import { extractColors } from './extract.js';
import { arrange, decide, fit, turnsOnMiddle } from './arrange.js';

const POOL = 12; // colors of a picture drawn on when a pattern needs the seven to be fitted (arrange.js fit)

/**
 * Everything about a palette that is settled before anything moves. Every palette gets a temperature
 * pattern and a shade pattern together (arrange.js). A shade pattern that turns needs colors that support
 * it, so those are fitted to it from a larger pool. Then each color keeps whichever of its five
 * candidates makes the order fit its patterns best (decide).
 * @param {{data: Uint8ClampedArray, width: number, height: number}} pixels
 * @param {() => number} random seeds the extraction and breaks ties, so a fixed one makes the palette repeatable
 * @param {number} chips how many colors a palette holds
 * @returns {null | {clusters: {hex: string, x: number, y: number}[], candidates: string[][], keep: number[], slotOf: number[], colors: string[], coordinates: {x: number, y: number}[]}}
 *   null when the picture has no opaque pixel
 */
export function buildPalette(pixels, random = Math.random, chips = 7) {
  let clusters = extractColors(pixels, chips, undefined, random);
  if (!clusters.length) return null;

  let arrangement = arrange(clusters.map((c) => c.hex), random);
  if (turnsOnMiddle(arrangement.shade)) {
    ({ colors: clusters, arrangement } = fit(clusters, extractColors(pixels, POOL, undefined, random), arrangement));
  }
  const candidates = clusters.map((c) => variations(c.hex));
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
