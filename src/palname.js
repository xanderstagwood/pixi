import { hexToRgb } from './color.js';
import { rgbToOklab, toOklch } from './oklab.js';

const DARK = 0.5, LIGHT = 0.7; // mean lightness: below is dark, from here light
const VIVID = 0.1; // mean chroma from which a palette is loud rather than soft
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
const title = (text) => text.replace(/(^|\s)([a-z]+)/g, (all, space, word, at) => (at > 0 && SMALL.has(word) ? all : space + word[0].toUpperCase() + word.slice(1)));

/**
 * @param {{themes: Record<string, {k: string, n: string, a: string, v: string}>, moods: Record<string, string>}} words data/words.json
 * @returns {(colors: string[], chipNames: string[], random?: () => number) => string} a palette's name: a theme that its
 *   chips' names point at (the most chips win; none at all is wonder), the mood of its colors, and a shape to join them.
 *   Words are drawn at random from `random`, so a fixed one repeats a name.
 */
export function createPalNamer(words) {
  const split = (text) => text.split(',');
  const themes = Object.entries(words.themes).map(([name, t]) => ({ name, k: new Set(split(t.k)), n: split(t.n), a: split(t.a), v: split(t.v) }));
  const moods = Object.fromEntries(Object.entries(words.moods).map(([name, text]) => [name, split(text)]));
  const wonder = themes.find((t) => t.name === 'wonder');

  return (colors, chipNames, random = Math.random) => {
    const pick = (list) => list[Math.floor(random() * list.length)];
    const seen = chipNames.flatMap((name) => name.toLowerCase().match(/[a-z]+/g) ?? []);
    const votes = themes.map((t) => seen.filter((w) => t.k.has(w)).length);
    const top = Math.max(...votes);
    const theme = top ? pick(themes.filter((_, i) => votes[i] === top)) : wonder;
    const mood = pick(moods[moodOf(colors)]);
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
