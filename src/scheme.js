import { hexToRgb } from './color.js';
import { rgbToOklab, toOklch } from './oklab.js';

// What direction a picture's colors can go in, read from the colors themselves: how much of the picture is neutral,
// how many hue families it has and how far apart they sit. Nothing here knows the picture's name or subject, so
// any picture gets an honest answer, and a scheme is only named when the picture really holds its families.

const CHROMATIC = 0.04; // chroma at which a color reads as a color and not a gray
const FAMILY_GAP = 25; // degrees of hue between one color family and the next
const NEUTRAL_DOMINANT = 0.7; // this much neutral and the picture is neutrals with a few pops
const SIGNIFICANT = 0.08; // share of the picture's color a family needs to count as one of its hues
const WIDE = 150; // two hues at least this far apart are complementary
const NEAR = 60; // and at most this far apart, analogous
const SPAN = 90; // three or more hues inside this much of the wheel are analogous

export const SCHEMES = ['tonal', 'neutral-pop', 'analogous', 'dichromatic', 'complementary', 'split-complementary', 'triadic', 'tetradic', 'square'];

const gap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

/** An entry with its OKLab position and its lightness, chroma and hue worked out. */
export const seen = (e) => { const lab = rgbToOklab(hexToRgb(e.hex)); return { ...e, lab, ...toOklch(lab) }; };

/** Groups chromatic colors into hue families: runs of hues with no gap of FAMILY_GAP or more, joined across the wrap at 0. */
function familiesOf(colors) {
  const sorted = colors.filter((c) => c.C >= CHROMATIC).sort((a, b) => a.h - b.h);
  const groups = [];
  for (const c of sorted) {
    const last = groups[groups.length - 1];
    if (last && c.h - last[last.length - 1].h < FAMILY_GAP) last.push(c); else groups.push([c]);
  }
  if (groups.length > 1 && groups[0][0].h + 360 - groups[groups.length - 1].at(-1).h < FAMILY_GAP) groups[0].unshift(...groups.pop());
  return groups;
}

/** The hue a family sits at: the circular mean of its colors, the vivid and the big counting for more. */
function hueOf(members) {
  let x = 0, y = 0;
  for (const c of members) {
    x += c.C * c.share * Math.cos((c.h * Math.PI) / 180);
    y += c.C * c.share * Math.sin((c.h * Math.PI) / 180);
  }
  return x || y ? ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360 : members[0].h;
}

/** Arcs of the wheel between hues in order round it, so they add up to 360. */
const arcs = (hues) => {
  const sorted = [...hues].sort((a, b) => a - b);
  return sorted.map((h, i) => (i ? h - sorted[i - 1] : h + 360 - sorted[sorted.length - 1]));
};

function threeHues(hues) {
  const [a, b, c] = hues;
  if (360 - Math.max(...arcs(hues)) <= SPAN) return 'analogous';
  for (const [one, two, three] of [[a, b, c], [b, a, c], [c, a, b]]) {
    if (gap(one, two) >= 120 && gap(one, three) >= 120 && gap(two, three) <= SPAN) return 'split-complementary';
  }
  return 'triadic';
}

/**
 * Reads a pool of a picture's colors and names the scheme it can support.
 * @param {{hex: string, share: number}[]} pool the picture's colors with the share of it each covers
 * @returns {{name: string, neutral: number, families: {hue: number, share: number, members: object[]}[]}}
 *   `neutral` is the share of the picture that is neutral; `families` are its hue families, biggest first
 */
export function detect(pool) {
  const colors = pool.map(seen);
  const total = colors.reduce((s, c) => s + c.share, 0) || 1;
  const neutral = colors.filter((c) => c.C < CHROMATIC).reduce((s, c) => s + c.share, 0) / total;
  const families = familiesOf(colors)
    .map((members) => ({ hue: hueOf(members), share: members.reduce((s, c) => s + c.share, 0) / total, members }))
    .sort((a, b) => b.share - a.share);
  const color = families.reduce((s, f) => s + f.share, 0) || 1;
  const hues = families.filter((f) => f.share / color >= SIGNIFICANT).map((f) => f.hue);

  let name;
  if (!families.length) name = 'tonal';
  else if (neutral >= NEUTRAL_DOMINANT) name = 'neutral-pop';
  else if (hues.length === 1) name = 'tonal';
  else if (hues.length === 2) {
    const g = gap(hues[0], hues[1]);
    name = g >= WIDE ? 'complementary' : g <= NEAR ? 'analogous' : 'dichromatic';
  } else if (hues.length === 3) name = threeHues(hues);
  else if (hues.length === 4) name = arcs(hues).every((a) => a >= 60 && a <= 120) ? 'square' : 'tetradic';
  else name = 'analogous';
  return { name, neutral, families };
}
