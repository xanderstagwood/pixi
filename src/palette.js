import { variations } from './color.js';
import { arrange, decide, fit, turnsOnMiddle } from './arrange.js';
import { choose } from './chooser.js';
import { extractColors } from './extract.js';

const POOL = 12; // colors of a picture the seven are chosen from

/**
 * Everything about a palette that is settled before anything moves. The seven are chosen from the
 * picture's twelve for contrast and company (chooser.js). Every palette gets a temperature pattern and a
 * shade pattern together (arrange.js). A shade pattern that turns needs colors that support it, so up to two
 * are fitted to it from the colors left over, never the accent or the value anchors. Then each color keeps
 * whichever of its five candidates makes the order fit its patterns best (decide). A picture that is answered
 * exactly keeps its colors exactly: nothing is fitted or nudged.
 * @param {{data: Uint8ClampedArray, width: number, height: number}} pixels
 * @param {() => number} random seeds the extraction and breaks ties, so a fixed one makes the palette repeatable
 * @param {number} chips how many colors a palette holds
 * @returns {null | {clusters: {hex: string, x: number, y: number}[], candidates: string[][], keep: number[], slotOf: number[], colors: string[], coordinates: {x: number, y: number}[]}}
 *   null when the picture has no opaque pixel
 */
export function buildPalette(pixels, random = Math.random, chips = 7) {
  const pool = extractColors(pixels, POOL, undefined, random);
  if (!pool.length) return null;

  const { picks, roles, mode, spare } = choose(pool, chips, random);
  let clusters = picks;
  let arrangement = arrange(clusters.map((c) => c.hex), random);
  if (mode !== 'exact' && turnsOnMiddle(arrangement.shade)) {
    const locked = roles.flatMap((role, i) => (role ? [i] : []));
    ({ colors: clusters, arrangement } = fit(clusters, spare, arrangement, locked));
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
