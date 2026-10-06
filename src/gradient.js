import { hexToRgb, rgbToHex } from './color.js';
import { TELLABLE, deltaE, oklchToRgb, rgbToOklab, toOklch } from './oklab.js';
import { classify } from './perceive.js';

// Orders a palette as one clean ramp and fits the chips' lightness to it. The colored families each sit in one
// block, so the hues never alternate down the card; the neutrals have no hue to keep together and slot in by
// lightness. Which family goes where is whatever needs the least change of lightness to make a ramp, with
// warm to cool (or cool to warm) settling a tie. Then each chip's lightness is moved toward the ramp, keeping its
// hue and chroma. A little of this is faking it: the picture's colors are shaded to read as a gradient.

const CAP = { free: 0.18, pop: 0.09 }; // the most a chip's lightness may move: the hero and accent less, the anchors not at all
const EVEN = 0.5; // how far a chip is also drawn toward even steps between the ends of the ramp
const TEMP_COST = 0.002; // what one family out of warm-to-cool order costs: only enough to settle a tie
const STEP = 0.06; // the least a ramp steps in lightness from one chip to the next, or two chips would be twins
const OVER = 10; // how much worse it is to ask a chip to move further than its cap

const capOf = (role) => (role === 'dark' || role === 'light' ? 0 : role ? CAP.pop : CAP.free);

/** Pool-adjacent-violators: the closest rising run to `values`. */
function rising(values) {
  const blocks = [];
  for (const v of values) {
    blocks.push({ sum: v, n: 1 });
    while (blocks.length > 1 && blocks[blocks.length - 2].sum / blocks[blocks.length - 2].n > blocks[blocks.length - 1].sum / blocks[blocks.length - 1].n) {
      const last = blocks.pop();
      blocks[blocks.length - 1].sum += last.sum;
      blocks[blocks.length - 1].n += last.n;
    }
  }
  return blocks.flatMap((b) => Array(b.n).fill(b.sum / b.n));
}
/** The closest run to `values` that steps by at least STEP each time, rising or falling. */
const steps = (values) => rising(values.map((v, i) => v - i * STEP)).map((v, i) => v + i * STEP);
const fitted = (values, ascending) => (ascending ? steps(values) : steps(values.map((v) => -v)).map((v) => -v));

const permutations = (list) => (list.length < 2 ? [list] : list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [x, ...rest])));

/**
 * @param {{hex: string, group: string | number, role: string}[]} chips `group` is the chip's color family, or 'neutral';
 *   `role` is '' for a free chip, or 'hero', 'accent', 'dark' or 'light'
 * @param {() => number} random picks which way the ramp and the temperature run
 * @param {boolean} fit false leaves the colors exactly as they are and only orders them
 * @returns {{order: number[], hexes: string[], temperature: string, shade: string}} `order` lists indices of `chips`, top row first;
 *   `hexes` is each chip's color after fitting, indexed like `chips`
 */
export function gradient(chips, random = Math.random, fit = true) {
  const seen = chips.map((c) => ({ ...toOklch(rgbToOklab(hexToRgb(c.hex))), warmth: classify(c.hex).warmth, cap: capOf(c.role) }));
  const ascending = random() < 0.5; // dark to light, from the top row down
  const warmFirst = random() < 0.5;
  const keys = [...new Set(chips.map((c) => c.group).filter((g) => g !== 'neutral'))];
  const members = (k) => chips.map((_, i) => i).filter((i) => chips[i].group === k);
  const byLight = (a, b) => (ascending ? seen[a].L - seen[b].L : seen[b].L - seen[a].L);
  const warmth = (k) => members(k).reduce((s, i) => s + seen[i].warmth, 0) / members(k).length;

  const cost = (seq) => {
    const L = seq.map((i) => seen[i].L), f = fitted(L, ascending);
    return seq.reduce((s, i, k) => { const d = Math.abs(f[k] - L[k]); return s + d * d + (d > seen[i].cap ? OVER * (d - seen[i].cap) ** 2 : 0); }, 0);
  };
  const withNeutrals = (base) => {
    const seq = [...base];
    for (const w of chips.map((_, i) => i).filter((i) => chips[i].group === 'neutral').sort(byLight)) {
      let best = 0, bestCost = Infinity;
      for (let p = 0; p <= seq.length; p++) { const c = cost([...seq.slice(0, p), w, ...seq.slice(p)]); if (c < bestCost) { bestCost = c; best = p; } }
      seq.splice(best, 0, w);
    }
    return seq;
  };
  const crooked = (perm) => perm.slice(1).filter((k, j) => (warmFirst ? warmth(k) > warmth(perm[j]) : warmth(k) < warmth(perm[j]))).length;

  let order = null, lowest = Infinity;
  for (const perm of permutations(keys)) {
    const seq = withNeutrals(perm.flatMap((k) => members(k).sort(byLight)));
    const total = cost(seq) + TEMP_COST * crooked(perm);
    if (total < lowest) { lowest = total; order = seq; }
  }

  const hexes = chips.map((c) => c.hex);
  if (fit && order.length > 1) {
    const L = order.map((i) => seen[i].L), f = fitted(L, ascending);
    const last = order.length - 1;
    const moved = new Map(); // chip -> how far its lightness moved
    order.forEach((i, k) => {
      const target = f[k] + EVEN * (f[0] + ((f[last] - f[0]) * k) / last - f[k]);
      const move = Math.max(-seen[i].cap, Math.min(seen[i].cap, target - L[k]));
      if (Math.abs(move) < 1e-4) return;
      hexes[i] = rgbToHex(oklchToRgb({ L: L[k] + move, C: seen[i].C, h: seen[i].h }));
      moved.set(i, Math.abs(move));
    });
    // Every shade is applied together, then any pair left closer than it was (or than a tellable gap) is eased: the one that moved most goes back.
    const was = chips.map((c) => rgbToOklab(hexToRgb(c.hex)));
    const now = (i) => rgbToOklab(hexToRgb(hexes[i]));
    for (let again = true; again;) {
      again = false;
      for (let a = 0; a < chips.length && !again; a++) {
        for (let b = a + 1; b < chips.length && !again; b++) {
          if (deltaE(now(a), now(b)) >= Math.min(deltaE(was[a], was[b]), TELLABLE) - 1e-9) continue;
          const back = (moved.get(a) ?? 0) >= (moved.get(b) ?? 0) ? a : b;
          if (!moved.has(back)) continue;
          hexes[back] = chips[back].hex;
          moved.delete(back);
          again = true;
        }
      }
    }
  }

  const top = order.slice(0, Math.ceil(order.length / 2)), bottom = order.slice(-Math.ceil(order.length / 2));
  const mean = (idx) => idx.reduce((s, i) => s + seen[i].warmth, 0) / idx.length;
  return { order, hexes, temperature: mean(top) >= mean(bottom) ? 'warm-to-cool' : 'cool-to-warm', shade: ascending ? 'dark-to-light' : 'light-to-dark' };
}
