import { variations } from './color.js';
import { arrange, decide } from './arrange.js';
import { choose } from './chooser.js';
import { extractColors } from './extract.js';
import { harmonize } from './harmony.js';

const POOL = 12; // colors of a picture the seven are chosen from

/**
 * Everything about a palette that is settled before anything moves. The seven are chosen from the
 * picture's twelve for contrast and company (chooser.js). Every palette gets a shade pattern (a clean ramp, dark to
 * light or light to dark) and a temperature pattern together (arrange.js). The free chips are nudged a little toward
 * the palette's own hue so they flow together (harmony.js). Then each color keeps whichever of its five candidates
 * makes the order fit its patterns best, never one that crowds another chip (decide). A picture that is answered
 * exactly keeps its colors exactly: nothing is nudged.
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
  const arrangement = arrange(clusters.map((c) => c.hex), random);
  if (mode !== 'exact') {
    const tuned = harmonize(clusters.map((c, i) => ({ hex: c.hex, role: roles[i] })));
    clusters = clusters.map((c, i) => ({ ...c, hex: tuned[i] }));
  }
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
