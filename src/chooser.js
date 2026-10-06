import { TELLABLE, deltaE } from './oklab.js';
import { detect, seen } from './scheme.js';

// Which seven of a picture's twelve colors make the palette. The aim is contrast and colors that work together,
// not a faithful copy. Wherever a person can check the answer by eye (one color, two colors, a handful) the
// answer is exact, and no color is ever invented: every chip is a color the picture holds.

const JND = 0.02; // colors closer than this cannot be told apart, so they count as one
const FAMILY_GAP = 25; // degrees of hue between one color family and the next: shades of one hue are one color to look at
const MAX_IN_FAMILY = 3; // chips one color family may take while the picture offers anything else
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
const VIVID_PULL = 0.5; // how far a color's chroma counts in its favor when a family is gathered, so a palette is not all grays
const RAMP = 1.5; // how much more a step in lightness counts than a step in hue when a group is spread into a ramp
const NEIGHBOURHOOD = 4; // hue families a rainbow gives up: a stretch of the wheel

const gap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const far = (a, b, lightness = 1) => Math.hypot(lightness * (a.lab.L - b.lab.L), a.lab.a - b.lab.a, a.lab.b - b.lab.b);

const sameFamily = (a, b) => (a.C >= CHROMATIC) === (b.C >= CHROMATIC) && (a.C < CHROMATIC || gap(a.h, b.h) < FAMILY_GAP);
const roomFor = (color, others) => others.filter((o) => sameFamily(color, o)).length < MAX_IN_FAMILY;

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

// What each scheme asks of seven chips, about 60/30/10: its color groups in order of weight, with how many chips
// each gets. A group is a hue family (by size, biggest first) or the neutrals.
const THREE = (f) => [[f[0], 3], [f[1], 2], [f[2], 1], ['neutral', 1]];
const FOUR = (f) => [[f[0], 2], [f[1], 2], [f[2], 1], [f[3], 1], ['neutral', 1]];
const PAIR = (f) => [[f[0], 4], [f[1], 2], ['neutral', 1]];
const RECIPES = {
  tonal: (f) => [[f[0], 5], ['neutral', 2]],
  'neutral-pop': (f) => (f[1] ? [['neutral', 4], [f[0], 2], [f[1], 1]] : [['neutral', 4], [f[0], 3]]),
  analogous: (f) => [[f[0], 3], [f[1], 2], [f[2] ?? 'neutral', 1], ['neutral', 1]],
  dichromatic: PAIR,
  complementary: PAIR,
  'split-complementary': THREE,
  triadic: THREE,
  tetradic: FOUR,
  square: FOUR,
};

/** A rainbow has more families than any scheme can use: a stretch of the wheel round a random one is taken. */
function neighbourhood(families, random) {
  const seed = families[Math.floor(random() * families.length)];
  return [...families].sort((a, b) => gap(a.hue, seed.hue) - gap(b.hue, seed.hue)).slice(0, NEIGHBOURHOOD);
}

/**
 * Picks the palette's colors from a picture's pool. Pure black and white are left out unless the picture is
 * mostly that. A picture of `chips` colors or fewer is answered exactly. Otherwise the picture's scheme
 * (scheme.js) says how many chips each color group gets, about 60/30/10; the lightest and darkest color anchor
 * the value range, the most vivid color (the hero) and an earned accent have their places, and each group is
 * filled as a ramp from dark to light. A group that cannot fill its share hands the rest on.
 * @param {{hex: string, x: number, y: number, share: number}[]} pool the picture's colors with the share of it each covers
 * @param {number} chips how many to pick
 * @param {() => number} random picks the neighbourhood of a rainbow, so the same rainbow is not always the same palette
 * @returns {{picks: {hex: string, x: number, y: number}[], roles: string[], mode: string}}
 *   `mode` is 'exact' or the scheme's name; `roles` is parallel to `picks` ('accent', 'hero', 'dark', 'light' or '')
 */
export function choose(pool, chips = 7, random = Math.random) {
  const reps = merged(pool);
  if (reps.length <= chips) return { picks: exactly(reps, chips), roles: Array(chips).fill(''), mode: 'exact' };

  let total = reps.reduce((s, r) => s + r.share, 0) || 1;
  const pure = (c) => c.L < PURE_BLACK || c.L > PURE_WHITE;
  let colors = reps.filter((c) => !pure(c) || c.share / total >= PURE_SHARE);
  if (colors.length < chips) colors = reps;

  const scheme = detect(reps); // the whole picture, black and white included: they are what it is made of, even where they cannot be chips
  let families = scheme.families;
  if (families.length > NEIGHBOURHOOD) {
    families = neighbourhood(families, random);
    const kept = new Set(families.flatMap((f) => f.members.map((m) => m.hex)));
    const narrowed = colors.filter((c) => c.C < CHROMATIC || kept.has(c.hex));
    if (narrowed.length >= chips) { colors = narrowed; total = colors.reduce((s, c) => s + c.share, 0) || 1; }
  }

  const accent = accentOf(colors, total);
  const hero = colors.filter((c) => c !== accent && c.C >= ACCENT_CHROMA && c.share / total >= SIZE_FLOOR.mild && (!accent || far(c, accent) >= TELLABLE)).sort((a, b) => b.C - a.C)[0];
  const dark = colors.reduce((a, c) => (c.L < a.L ? c : a));
  const light = colors.reduce((a, c) => (c.L > a.L ? c : a));
  const picks = [], roles = [];
  for (const [color, role] of [[accent, 'accent'], [hero, 'hero'], [dark, 'dark'], [light, 'light']]) {
    if (!color) continue;
    if (!picks.includes(color)) { picks.push(color); roles.push(role); }
  }

  // Which group each color belongs to, and how many chips each group is still owed.
  const group = new Map(colors.map((c) => [c.hex, c.C < CHROMATIC ? 'neutral' : -1]));
  families.forEach((f, i) => f.members.forEach((m) => { if (group.get(m.hex) !== 'neutral' && group.has(m.hex)) group.set(m.hex, i); }));
  const recipe = families.length ? RECIPES[scheme.name](families) : [['neutral', chips]];
  const owed = new Map();
  for (const [member, count] of recipe) {
    const key = member === 'neutral' ? 'neutral' : member ? families.indexOf(member) : -1;
    if (key !== -1) owed.set(key, (owed.get(key) ?? 0) + count);
  }
  for (const p of picks) owed.set(group.get(p.hex), (owed.get(group.get(p.hex)) ?? 0) - 1);
  const order = [...owed.keys()].filter((k) => owed.get(k) > 0);
  for (let over = order.reduce((s, k) => s + owed.get(k), 0) - (chips - picks.length); over > 0; over--) {
    owed.set(order.findLast((k) => owed.get(k) > 0), owed.get(order.findLast((k) => owed.get(k) > 0)) - 1);
  }

  const rest = colors.filter((c) => !picks.includes(c));
  const join = (c) => { picks.push(c); roles.push(''); rest.splice(rest.indexOf(c), 1); };
  for (const key of order) {
    while (owed.get(key) > 0 && picks.length < chips) {
      const mine = rest.filter((c) => group.get(c.hex) === key);
      const apart = mine.filter((c) => picks.every((p) => far(c, p) >= TELLABLE));
      const same = picks.filter((p) => group.get(p.hex) === key);
      // A group becomes a ramp: each chip is the one farthest, mostly in lightness, from the group's chips so far.
      const ramp = (c) => Math.min(...(same.length ? same : picks).map((p) => far(c, p, RAMP))) + (key === 'neutral' ? 0 : VIVID_PULL * c.C);
      const best = apart.sort((a, b) => ramp(b) - ramp(a))[0];
      if (!best) break; // nothing left in this group that is not a near-twin: what it was owed goes to the others
      join(best);
      owed.set(key, owed.get(key) - 1);
    }
  }
  while (picks.length < chips) {
    // What is left over goes to the chip that is no near-twin and whose family has room; then any no near-twin; then whatever.
    const apart = rest.filter((c) => picks.every((p) => far(c, p) >= TELLABLE));
    const roomy = apart.filter((c) => roomFor(c, picks));
    const from = roomy.length ? roomy : apart.length ? apart : rest;
    join(from.sort((a, b) => Math.min(...picks.map((p) => far(b, p))) - Math.min(...picks.map((p) => far(a, p))))[0]);
  }
  const bare = ({ hex, x, y }) => ({ hex, x, y });
  return { picks: picks.map(bare), roles, mode: scheme.name };
}
