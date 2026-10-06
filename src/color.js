import { shuffle } from './anim.js';
import { oklchToRgb, rgbToOklab, toOklch } from './oklab.js';

// Pure color math. Colors travel as '#RRGGBB' strings; {r,g,b} is 0-255, hsl is h 0-360, s/l 0-1.

/** The ground between bloxels: pure black, so no bloxel can be darker than it and ring itself with a lighter grid line. Mirrors --ground in style.css. */
export const GROUND = '#000000';

export const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return { r: n >> 16, g: (n >> 8) & 255, b: n & 255 };
};

export const rgbToHex = ({ r, g, b }) =>
  '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase();

export function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

export function hslToRgb({ h, s, l }) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
  return { r: f(0), g: f(8), b: f(4) };
}

export const hexToHsl = (hex) => rgbToHsl(hexToRgb(hex));
export const hslToHex = (hsl) => rgbToHex(hslToRgb(hsl));

/** Perceptual-ish brightness 0-1, used to pick readable label ink. */
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** WCAG contrast ratio between two colors, 1 (none) to 21 (black on white). */
export function contrast(a, b) {
  const lum = (hex) => {
    const { r, g, b: blue } = hexToRgb(hex);
    const lin = (v) => ((v / 255) <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(blue);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const INK_CHROMA = 0.05; // the most chroma label ink carries: enough to be of its chip's color, not enough to fight it
const INK_CONTRAST = 5; // what it asks of a label, a little over the 4.5 that reads comfortably
const INK_DARK = 0.2, INK_LIGHT = 0.985; // where it may go at the furthest: the card's own grays

/**
 * The ink for text over one or more colors (a chip, or the bloxels behind a line of text): the hue and a little of the
 * chroma of their average, as close to its lightness as still reads on every one of them. Pure black and white would sit
 * on the palette like stickers; this belongs to it. Over colors too mixed or too mid-toned to reach the contrast, the
 * furthest ink on the better side.
 */
export function inkOver(backgrounds) {
  const labs = backgrounds.map((hex) => rgbToOklab(hexToRgb(hex)));
  const mean = { L: 0, a: 0, b: 0 };
  for (const l of labs) { mean.L += l.L / labs.length; mean.a += l.a / labs.length; mean.b += l.b / labs.length; }
  const { L, C, h } = toOklch(mean);
  const ink = (l) => rgbToHex(oklchToRgb({ L: l, C: Math.min(C, INK_CHROMA), h }));
  const reads = (hex) => Math.min(...backgrounds.map((b) => contrast(hex, b)));
  const far = reads(ink(INK_DARK)) >= reads(ink(INK_LIGHT)) ? INK_DARK : INK_LIGHT;
  let near = 0, away = 1; // how far from the average lightness toward `far`
  for (let i = 0; i < 16; i++) {
    const t = (near + away) / 2;
    if (reads(ink(L + (far - L) * t)) >= INK_CONTRAST) away = t; else near = t;
  }
  return ink(L + (far - L) * away);
}

/** The ink for text on a chip. */
export const inkFor = (hex) => inkOver([hex]);

const lifted = new Map();

/**
 * A slightly brighter shade of `hex`, for a light hit along the top edge of whatever sits on that color.
 * Lifted in OKLCH: hue and chroma stay (a touch more chroma, since brightening alone reads washed out),
 * so it is the same color, brighter, and never a veil of white over it. The step grows with lightness:
 * a dark color needs only a whisper to catch the light, and the same step that suits a mid-tone is a
 * glare on near-black. `strength` scales the step (1 for bloxels, more for a bigger element).
 */
export function brighter(hex, strength = 1) {
  const key = `${hex}${strength}`;
  if (!lifted.has(key)) {
    const { L, C, h } = toOklch(rgbToOklab(hexToRgb(hex)));
    const step = strength * (0.01 + 0.03 * L);
    // A vivid color sits near the edge of what a screen can show, and lifting it whole would squeeze its
    // chroma. Take the biggest share of the step that keeps at least 96% of the chroma.
    let out = hex;
    for (const share of [1, 0.75, 0.5, 0.3]) {
      const rgb = oklchToRgb({ L: Math.min(1, L + share * step), C: C * 1.06, h });
      out = rgbToHex(rgb);
      if (toOklch(rgbToOklab(rgb)).C >= 0.96 * C) break;
    }
    lifted.set(key, out);
  }
  return lifted.get(key);
}

/** The light hit on a bloxel of this color (`brighter`, as a hex code), a little stronger than the base step. */
export const hit = (r, g, b) => brighter(rgbToHex({ r, g, b }), 1.3);

const GLINT_STEP = 4.2; // the light hit's `brighter` strength at a full glint (amount 1)

/**
 * A color lit by `amount` (0 to 1, and past 1 for a flare) as {r, g, b}: what a twinkling bloxel is drawn in.
 * It is `brighter()`, the same OKLCH lift the light hits use, at `amount` times 4.2 strength, so a glint keeps
 * its hue and chroma instead of washing toward white. Amounts are rounded to sixteenths so `brighter`'s cache stays small.
 */
export function glint(r, g, b, amount) {
  const q = Math.round(amount * 16);
  return q <= 0 ? { r, g, b } : hexToRgb(brighter(rgbToHex({ r, g, b }), (q / 16) * GLINT_STEP));
}

/** Mix of `hex` toward `toward` ('#RRGGBB'), `amount` 0-1. */
export function mix(hex, toward, amount) {
  const a = hexToRgb(hex), b = hexToRgb(toward);
  return rgbToHex({ r: a.r + (b.r - a.r) * amount, g: a.g + (b.g - a.g) * amount, b: a.b + (b.b - a.b) * amount });
}

/**
 * A run of `length` colors drawn from `colors`, every one shown as often as the others give or take
 * one, shuffled, and never the same twice in a row. Decided up front, so what a chip will show is
 * known before the scanner that hunts it sets off.
 */
export function sequence(colors, length) {
  const out = [];
  while (out.length < length) {
    for (const c of shuffle(colors)) {
      if (out.length < length && c !== out[out.length - 1]) out.push(c);
    }
  }
  return out;
}

/**
 * Five subtle takes on one color, made in OKLCH so a step looks the same size on every color:
 * the base, a touch darker and richer, a touch lighter and softer, and the hue nudged either way.
 * Chroma is trimmed to stay in gamut rather than letting the clamp bend the hue. Index 0 is the base.
 */
export function variations(hex) {
  const { L, C, h } = toOklch(rgbToOklab(hexToRgb(hex)));
  const make = (dL, scale, dh) => rgbToHex(oklchToRgb({ L: Math.min(1, Math.max(0, L + dL)), C: C * scale, h: (h + dh + 360) % 360 }));
  return [hex, make(-0.05, 1.06, 0), make(0.05, 0.94, 0), make(0, 1, -8), make(0, 1, 8)];
}
