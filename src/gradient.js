import { hexToRgb, rgbToHex } from './color.js';
import { TELLABLE, deltaE, oklchToRgb, rgbToOklab, toOklch } from './oklab.js';
import { classify } from './perceive.js';

// Orders a palette as one clean ramp and fits the chips' lightness to it. The hues each sit in one
// block (a vivid red and a muted tan are two blocks, though their hues chain together), so they never alternate down the card; the neutrals have no hue to keep together and slot in by
// lightness, except a tinted gray, which is a shadow of its hue and joins that block, so a hero is not boxed in between grays. Which family goes where is whatever needs the least change of lightness to make a ramp, with
// warm to cool (or cool to warm) settling a tie. Then each chip's lightness is moved toward the ramp, keeping its
// hue and chroma. A little of this is faking it: the picture's colors are shaded to read as a gradient.

const CAP = { free: 0.18, pop: 0.09 }; // the most a chip's lightness may move: the hero and accent less, the anchors not at all
const EVEN = 0.5; // how far a chip is also drawn toward even steps between the ends of the ramp
const TEMP_COST = 0.002; // what one family out of warm-to-cool order costs: only enough to settle a tie
const STEP = 0.06; // the least a ramp steps in lightness from one chip to the next, or two chips would be twins
const OVER = 10;
const CHROMATIC = 0.04; // chroma at which a chip has a hue to keep together; below it, a neutral
const BLOCK_NEAR = 14; // degrees: a chip this close in hue to a block's leader (its most vivid chip) belongs to that block
const BLOCK_FAR = 22; // and one closer than this does too, unless its chroma is far from the leader's (a vivid red and a muted tan)
const BLOCK_CHROMA = 2.2; // how many times more (or less) chroma than the leader counts as far
const TINTED = 0.015; // a neutral with this much chroma is a shadow of the hue it leans to, and joins that hue's block

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

/** Which hue block each chip belongs to: 'neutral', or the index of its block. The most vivid chips lead the blocks. */
function blocksOf(seen) {
  const leaders = [], block = seen.map(() => 'neutral');
  seen.map((c, i) => i).filter((i) => seen[i].C >= CHROMATIC).sort((a, b) => seen[b].C - seen[a].C).forEach((i) => {
    const same = (l) => {
      const apart = Math.abs(((seen[l].h - seen[i].h + 540) % 360) - 180);
      return apart < BLOCK_NEAR || (apart < BLOCK_FAR && seen[l].C / seen[i].C < BLOCK_CHROMA);
    };
    let at = leaders.findIndex(same);
    if (at < 0) { leaders.push(i); at = leaders.length - 1; }
    block[i] = at;
  });
  seen.forEach((c, i) => {
    if (block[i] !== 'neutral' || c.C < TINTED || !c.cap) return; // the anchors stay free: they are the ends of the ramp
    const apart = (l) => Math.abs(((seen[l].h - c.h + 540) % 360) - 180);
    const near = leaders.reduce((best, l, k) => (apart(l) < apart(leaders[best]) ? k : best), 0);
    if (leaders.length && apart(leaders[near]) < BLOCK_FAR) block[i] = near;
  });
  return block;
}

const permutations = (list) => (list.length < 2 ? [list] : list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [x, ...rest])));

/**
 * @param {{hex: string, role: string}[]} chips `role` is '' for a free chip, or 'hero', 'accent', 'dark' or 'light'
 * @param {() => number} random picks which way the ramp and the temperature run
 * @param {boolean} fit false leaves the colors exactly as they are and only orders them
 * @returns {{order: number[], hexes: string[], temperature: string, shade: string}} `order` lists indices of `chips`, top row first;
 *   `hexes` is each chip's color after fitting, indexed like `chips`
 */
export function gradient(chips, random = Math.random, fit = true) {
  const seen = chips.map((c) => ({ ...toOklch(rgbToOklab(hexToRgb(c.hex))), warmth: classify(c.hex).warmth, cap: capOf(c.role) }));
  const ascending = random() < 0.5; // dark to light, from the top row down
  const warmFirst = random() < 0.5;
  const block = blocksOf(seen);
  const keys = [...new Set(block.filter((g) => g !== 'neutral'))];
  const members = (k) => chips.map((_, i) => i).filter((i) => block[i] === k);
  const byLight = (a, b) => (ascending ? seen[a].L - seen[b].L : seen[b].L - seen[a].L);
  const warmth = (k) => members(k).reduce((s, i) => s + seen[i].warmth, 0) / members(k).length;

  const cost = (seq) => {
    const L = seq.map((i) => seen[i].L), f = fitted(L, ascending);
    return seq.reduce((s, i, k) => { const d = Math.abs(f[k] - L[k]); return s + d * d + (d > seen[i].cap ? OVER * (d - seen[i].cap) ** 2 : 0); }, 0);
  };
  const withNeutrals = (base) => {
    const seq = [...base];
    for (const w of chips.map((_, i) => i).filter((i) => block[i] === 'neutral').sort(byLight)) {
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
