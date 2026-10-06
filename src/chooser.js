import { hexToRgb } from './color.js';
import { deltaE, rgbToOklab, toOklch } from './oklab.js';

// Which seven of a picture's twelve colors make the palette. The aim is contrast and colors that work together,
// not a faithful copy. Wherever a person can check the answer by eye (one color, two colors, a handful) the
// answer is exact, and no color is ever invented: every chip is a color the picture holds.

const JND = 0.02; // colors closer than this cannot be told apart, so they count as one
const DISTINCT = 0.06; // a clearly different color, for counting how rich a picture is
export const PLENTIFUL = 11; // this many clearly different colors in the picture: pick a family; fewer: spread out
const PURE_BLACK = 0.09; // OKLab lightness below which a color is pure black (about #030303)
const PURE_WHITE = 0.99; // and above which it is pure white (about #FCFCFC)
const PURE_SHARE = 0.8; // pure black or white is a chip only when the picture is at least this much of it
const CHROMATIC = 0.04; // chroma at which a color reads as a color and not a gray
const ACCENT_CHROMA = 0.08; // an accent has to be vivid
const VIVID = 0.15; // very vivid colors get the smaller size floor
const ACCENT_GAP = 70; // degrees of hue an accent sits away from the rest
const NARROW = 0.85; // share of the other colors' area that has to sit within ACCENT_GAP of their hue
const NEUTRAL_AREA = 0.15; // a picture with no more color than this is a gray picture with a few colors in it
const SIZE_FLOOR = { vivid: 0.001, mild: 0.003 }; // share of the picture below which a color is a speck
const WOBBLE = 3; // cohesion picks at random among this many best fits, so a rainbow does not always give the same family

const gap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const seen = (e) => { const lab = rgbToOklab(hexToRgb(e.hex)); return { ...e, lab, ...toOklch(lab) }; };
const far = (a, b, lightness = 1) => Math.hypot(lightness * (a.lab.L - b.lab.L), a.lab.a - b.lab.a, a.lab.b - b.lab.b);

/** How many clearly different colors a pool holds. */
export function richness(pool) {
  const kept = [];
  for (const e of pool.map(seen)) if (kept.every((k) => deltaE(e.lab, k.lab) >= DISTINCT)) kept.push(e);
  return kept.length;
}

/** The pool with colors nobody can tell apart merged, the biggest area of each lending its place. */
function merged(pool) {
  const reps = [];
  for (const e of pool.map(seen).sort((a, b) => b.share - a.share)) {
    const twin = reps.find((r) => deltaE(e.lab, r.lab) < JND);
    if (twin) twin.share += e.share; else reps.push({ ...e });
  }
  return reps;
}

/** `chips` chips shared out by area, each color at least one: what a picture of a few colors is asked for. */
function exactly(reps, chips) {
  const total = reps.reduce((s, r) => s + r.share, 0) || 1;
  const counts = reps.map(() => 1);
  for (let left = chips - reps.length; left > 0; left--) {
    let best = 0;
    reps.forEach((r, i) => { if ((r.share / total) * chips - counts[i] > (reps[best].share / total) * chips - counts[best]) best = i; });
    counts[best]++;
  }
  return reps.flatMap((r, i) => Array(counts[i]).fill({ hex: r.hex, x: r.x, y: r.y }));
}

/**
 * The one small vivid color that would complement the rest, if the picture has one that earns it: far in hue
 * from where the rest of its color sits, and the rest narrow enough to be a single family. A picture that is
 * nearly all gray and has no such color keeps its most vivid one, so a single bright dot on gray is not lost.
 */
function accentOf(colors, total) {
  const chromatic = colors.filter((c) => c.C >= CHROMATIC);
  if (!chromatic.length) return null;
  const big = (c) => c.share / total >= (c.C >= VIVID ? SIZE_FLOOR.vivid : SIZE_FLOOR.mild);
  const vivid = chromatic.filter((c) => c.C >= ACCENT_CHROMA && big(c));
  const baseOf = (list) => {
    let x = 0, y = 0;
    for (const c of list) { x += c.C * c.share * Math.cos((c.h * Math.PI) / 180); y += c.C * c.share * Math.sin((c.h * Math.PI) / 180); }
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  };
  const first = baseOf(chromatic);
  const found = vivid.filter((c) => gap(c.h, first) >= ACCENT_GAP).sort((a, b) => b.C * gap(b.h, first) - a.C * gap(a.h, first))[0];
  if (found) {
    const others = chromatic.filter((c) => c !== found), base = baseOf(others);
    const area = others.reduce((s, c) => s + c.share, 0);
    const near = others.filter((c) => gap(c.h, base) <= ACCENT_GAP).reduce((s, c) => s + c.share, 0);
    if (gap(found.h, base) >= ACCENT_GAP && near >= NARROW * area) return found;
  }
  const area = chromatic.reduce((s, c) => s + c.share, 0) / total;
  return area <= NEUTRAL_AREA ? [...vivid].sort((a, b) => b.C - a.C)[0] ?? null : null;
}

/**
 * Picks the palette's colors from a picture's pool. Pure black and white are left out unless the picture is
 * mostly that. A picture of `chips` colors or fewer is answered exactly. Otherwise the lightest and the darkest
 * color anchor the value range, an earned accent gets a slot, and the rest are a family (a picture with plenty of
 * colors) or spread as far apart as they can be (one with few).
 * @param {{hex: string, x: number, y: number, share: number}[]} pool the picture's colors with the share of it each covers
 * @param {number} chips how many to pick
 * @param {() => number} random picks the neighbourhood of a family, so the same rainbow is not always the same palette
 * @returns {{picks: {hex: string, x: number, y: number}[], roles: string[], mode: 'exact' | 'cohesive' | 'varied', spare: object[]}}
 *   `roles` is parallel to `picks` ('accent', 'dark', 'light' or ''), `spare` the colors not picked
 */
export function choose(pool, chips = 7, random = Math.random) {
  const reps = merged(pool);
  if (reps.length <= chips) return { picks: exactly(reps, chips), roles: Array(chips).fill(''), mode: 'exact', spare: [] };

  const total = reps.reduce((s, r) => s + r.share, 0) || 1;
  const pure = (c) => c.L < PURE_BLACK || c.L > PURE_WHITE;
  let colors = reps.filter((c) => !pure(c) || c.share / total >= PURE_SHARE);
  if (colors.length < chips) colors = reps;

  const accent = accentOf(colors, total);
  const dark = colors.reduce((a, c) => (c.L < a.L ? c : a));
  const light = colors.reduce((a, c) => (c.L > a.L ? c : a));
  const picks = [], roles = [];
  for (const [color, role] of [[accent, 'accent'], [dark, 'dark'], [light, 'light']]) {
    if (!color) continue;
    const at = picks.indexOf(color);
    if (at < 0) { picks.push(color); roles.push(role); }
  }

  const mode = richness(colors) >= PLENTIFUL ? 'cohesive' : 'varied';
  const rest = colors.filter((c) => !picks.includes(c));
  while (picks.length < chips) {
    const scored = rest
      .map((c) => ({ c, d: mode === 'cohesive' ? picks.reduce((s, p) => s + far(c, p, 0.5), 0) / picks.length : -Math.min(...picks.map((p) => far(c, p))) }))
      .sort((a, b) => a.d - b.d);
    const at = mode === 'cohesive' ? Math.floor(random() * Math.min(WOBBLE, scored.length)) : 0;
    picks.push(scored[at].c);
    roles.push('');
    rest.splice(rest.indexOf(scored[at].c), 1);
  }
  const bare = ({ hex, x, y }) => ({ hex, x, y });
  return { picks: picks.map(bare), roles, mode, spare: rest.map(bare) };
}
