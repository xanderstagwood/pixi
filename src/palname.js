import { nameColors } from './colorname.js';
import { hexToRgb } from './color.js';
import { deltaE, rgbToOklab, toOklch } from './oklab.js';

/** The grid a color's look is read off: hues and lightnesses in equal steps, chroma in three (grey, muted, vivid). */
export const GRID = { hues: 24, lights: 8, chromas: [0.04, 0.12] };

const DARK = 0.5, LIGHT = 0.7; // mean lightness: below is dark, from here light
const VIVID = 0.1; // mean chroma from which a palette is loud rather than soft
const AGREE = 0.12; // how far, in OKLab, a chip's color may be from the color its word usually has before the word stops counting much
const NAMED = 0.1; // what a chip whose name uses a theme's word adds to the theme, beside how well the theme's colors cover the palette
const MIN_SCORE = 0.05; // a theme that suits the palette less than this is no theme
const LOOKS = 0.6; // how often a name's mood word is what the chips look like, not the palette's overall mood
const SECRET_NEAR = 0.05; // how close a chip must be to a secret name's color
const SECRET_ODDS = 0.03; // how often a palette that has one takes the secret name: nearly every palette has some secret's color in it, so this alone makes the names rare
const FITS = 24; // characters the name box on a card holds, at the most (it is 160 font pixels, a letter about 6)
const TRIES = 12;

/** Which of the six moods a palette's colors make: dark, mid or light, soft or vivid. */
export function moodOf(colors) {
  const lch = colors.map((hex) => toOklch(rgbToOklab(hexToRgb(hex))));
  const mean = (key) => lch.reduce((sum, c) => sum + c[key], 0) / lch.length;
  const L = mean('L');
  return `${L < DARK ? 'dark' : L < LIGHT ? 'mid' : 'light'}-${mean('C') >= VIVID ? 'vivid' : 'soft'}`;
}

const SMALL = new Set(['of', 'the', '&']); // left lower case inside a name
/** Which cell of the GRID a color falls in (a grey has no hue, so it has one cell per lightness): where the words that say what it looks like are kept. */
export function lookCell(hex) {
  const { L, C, h } = toOklch(rgbToOklab(hexToRgb(hex)));
  const c = GRID.chromas.filter((edge) => C >= edge).length;
  const l = Math.min(GRID.lights - 1, Math.floor(L * GRID.lights));
  return (c * GRID.lights + l) * GRID.hues + (c ? Math.floor(h / (360 / GRID.hues)) % GRID.hues : 0);
}

const title = (text) => text.replace(/(^|\s)([a-z]+)/g, (all, space, word, at) => (at > 0 && SMALL.has(word) ? all : space + word[0].toUpperCase() + word.slice(1)));

/**
 * @param {{themes: Record<string, {k: string, n: string, a: string, v: string}>, moods: Record<string, string>, colors?: Record<string, string>, looks?: Record<string, string>, secrets?: [string, string][]}} words
 *   data/words.json; `colors` is the hex each theme word usually has in a color name, `looks` the words that say what a
 *   color looks like, by its lookCell, `secrets` hand-written names, each with the color that earns it
 * @returns {(colors: string[], chipNames: string[], random?: () => number) => string} a palette's name: the theme whose
 *   words' usual colors cover the palette best (a chip whose name uses a theme's word helps it a little, as far as the
 *   chip has that word's color; none suiting is wonder), the mood of its colors, and a shape to join them. Words are
 *   drawn at random from `random`, so a fixed one repeats a name.
 */
export function createPalNamer(words) {
  const split = (text) => text.split(',');
  const themes = Object.entries(words.themes).map(([name, t]) => ({ name, k: new Set(split(t.k)), n: split(t.n), a: split(t.a), v: split(t.v) }));
  const moods = Object.fromEntries(Object.entries(words.moods).map(([name, text]) => [name, split(text)]));
  const wonder = themes.find((t) => t.name === 'wonder');
  const secrets = (words.secrets ?? []).map(([name, hex]) => ({ name, lab: rgbToOklab(hexToRgb(hex)) }));
  const usual = new Map(Object.entries(words.colors ?? {}).map(([w, hex]) => [w, rgbToOklab(hexToRgb(`#${hex}`))]));
  themes.forEach((t) => { t.hues = [...t.k].map((w) => usual.get(w)).filter(Boolean); });
  // 1 for a chip with the color a word usually has, falling away as it differs; a word with no usual color counts in full.
  const near = (u, chip) => {
    const far = Math.hypot(u.L - chip.L, u.a - chip.a, u.b - chip.b) / AGREE;
    return Math.exp(-far * far);
  };
  const agreement = (word, chip) => (usual.has(word) ? near(usual.get(word), chip) : 1);

  return (colors, chipNames, random = Math.random) => {
    const pick = (list) => list[Math.floor(random() * list.length)];
    const labs = colors.map((hex) => rgbToOklab(hexToRgb(hex)));
    const earned = secrets.filter((x) => labs.some((chip) => deltaE(chip, x.lab) < SECRET_NEAR));
    if (earned.length && random() < SECRET_ODDS) return pick(earned.map((x) => x.name));
    // How well a theme suits the palette: its colors cover the chips (each as covered as its nearest theme color is near
    // it), and the chips cover its colors (a theme of every color suits no palette in particular).
    const mean = (list, of) => list.reduce((sum, x) => sum + of(x), 0) / (list.length || 1);
    const votes = themes.map((t) => mean(labs, (chip) => Math.max(0, ...t.hues.map((u) => near(u, chip)))) * mean(t.hues, (u) => Math.max(0, ...labs.map((chip) => near(u, chip)))));
    chipNames.forEach((name, i) => {
      for (const word of name.toLowerCase().match(/[a-z]+/g) ?? []) themes.forEach((t, j) => { if (t.k.has(word)) votes[j] += NAMED * agreement(word, labs[i]); });
    });
    const top = Math.max(...votes);
    const theme = top >= MIN_SCORE ? pick(themes.filter((_, i) => votes[i] > top - 1e-9)) : wonder;
    // What the palette looks like, in the words of its own chips; a chip's cell with none (the gamut has no such color) is no help.
    const looks = colors.flatMap((hex) => (words.looks?.[lookCell(hex)] ?? '').split(',').filter(Boolean));
    const mood = looks.length && random() < LOOKS ? pick(looks) : pick(moods[moodOf(colors)]);
    const shapes = [
      () => `${mood} ${pick(theme.n)}`,
      () => `${pick(theme.a)} ${pick(theme.n)}`,
      () => `${pick(theme.n)} & ${pick(theme.n)}`,
      () => `${pick(theme.n)} ${pick(theme.n)}`,
      () => `${mood} ${pick(theme.a)} ${pick(theme.n)}`,
      () => `the ${pick(theme.a)} ${pick(theme.n)}`,
      () => `${pick(theme.n)} of ${pick(theme.n)}`,
    ];
    for (let i = 0; i < TRIES; i++) {
      const name = title(pick(shapes)()), parts = name.toLowerCase().split(' ');
      if (name.length <= FITS && new Set(parts).size === parts.length) return name; // not "Tiara of Tiara"
    }
    return title(`${mood} ${pick(theme.n)}`).slice(0, FITS);
  };
}

let namer = null;

/** A fresh palette's name from its colors, or '' while the word lists are not here (the caller keeps what it had). */
export const namePalette = (colors) => (namer ? namer(colors, nameColors(colors)) : '');

/** Fetches the word lists (see data/words.NOTICE). */
export async function loadPalNames() {
  const response = await fetch('data/words.json');
  if (!response.ok) throw new Error(`palette names: ${response.status}`);
  namer = createPalNamer(await response.json());
}
