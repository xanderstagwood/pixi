// Builds data/words.json from seeds.json. The whimsy words (n nouns, a adjectives, v verbs) and the moods are written by
// hand in seeds.json: Datamuse (https://www.datamuse.com/api/) brings in place names and the wrong kinds of word when asked
// for them. What it is good at is breadth, so each theme's seeds are grown with it into the words that a color name might
// use for the theme (k): a chip called "Lagoon Mist" can then pick the sea. Only words that mean what the seeds mean
// count (not ones that merely turn up near them: `pond` turns up near everything), and a word that means something to
// more than TWO themes belongs to none of them, unless it is one of a theme's own seeds.
// The looks (what each color of a grid looks like, in the words of color-description, https://github.com/words/color-description)
// come from that package: npm i --no-save color-description first.
// Run by hand when the seeds change: node scripts/words/build.mjs (needs the network; the app never does).
import { readFileSync, writeFileSync } from 'node:fs';
import { hexToRgb, rgbToHex } from '../../src/color.js';
import { oklabToRgb, oklchToRgb, rgbToOklab } from '../../src/oklab.js';
import { GRID, lookCell } from '../../src/palname.js';
import ColorDescription from 'color-description';

const here = new URL('.', import.meta.url);
const seeds = JSON.parse(readFileSync(new URL('seeds.json', here), 'utf8'));
const names = JSON.parse(readFileSync(new URL('../../data/colornames.json', here), 'utf8'));
const vocab = new Set(names.flatMap(([name]) => name.toLowerCase().match(/[a-z]+/g)));
const DRAW = /^[a-z]{3,12}$/; // what a chip's pixel font draws, and fits

async function ask(params, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const response = await fetch(`https://api.datamuse.com/words?${new URLSearchParams({ max: 60, ...params })}`);
      if (response.ok) return response.json();
    } catch { /* retry */ }
    await new Promise((done) => setTimeout(done, 500 * (i + 1)));
  }
  throw new Error(`datamuse failed: ${JSON.stringify(params)}`);
}

/** Runs `job` over `items`, four at a time. */
async function each(items, job) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => { while (next < items.length) { const i = next++; out[i] = await job(items[i]); } }));
  return out;
}

const TWO = 2;

/** The words of a color name that Datamuse says mean what the seeds mean. */
async function related(list) {
  const topics = list.slice(0, 5).join(',');
  const hits = (await each(list, (seed) => ask({ ml: seed, topics }))).flat();
  return new Set(hits.map((h) => h.word.toLowerCase()).filter((w) => vocab.has(w)));
}

/** The color a word usually has in a color name: the average, in OKLab, of the colors whose names use it (as hex without the #). */
function usualColors(wanted) {
  const sums = new Map();
  for (const [name, hex] of names) {
    const { L, a, b } = rgbToOklab(hexToRgb(hex));
    for (const word of new Set(name.toLowerCase().match(/[a-z]+/g))) {
      if (!wanted.has(word)) continue;
      const s = sums.get(word) ?? [0, 0, 0, 0];
      sums.set(word, [s[0] + L, s[1] + a, s[2] + b, s[3] + 1]);
    }
  }
  return Object.fromEntries([...sums].map(([word, [L, a, b, n]]) => [word, rgbToHex(oklabToRgb({ L: L / n, a: a / n, b: b / n })).slice(1).toLowerCase()]));
}

const NOT_LOOKS = new Set(['unsaturated', 'saturated', 'greyish', 'grey', 'almost', 'fairly', 'rather', 'very']); // technical, not whimsy
const ROOMY = /^[a-z]{4,10}$/;

/** What the colors of each cell of the GRID look like: its middle color's best few single words, by cell (see lookCell). */
function looks() {
  const cd = new ColorDescription('#000000');
  const out = {};
  const chromas = [0.02, 0.08, 0.16];
  for (let c = 0; c < chromas.length; c++) for (let l = 0; l < GRID.lights; l++) for (let h = 0; h < (c ? GRID.hues : 1); h++) {
    const hex = rgbToHex(oklchToRgb({ L: (l + 0.5) / GRID.lights, C: chromas[c], h: (h + 0.5) * (360 / GRID.hues) }));
    const cell = lookCell(hex);
    cd.color = hex;
    const nouns = new Set(cd.nouns);
    const picked = cd.descriptiveWords.filter((w) => ROOMY.test(w) && !NOT_LOOKS.has(w) && !nouns.has(w) && !w.endsWith('ish')).slice(0, 8);
    if (picked.length) out[cell] = picked.join(',');
  }
  return out;
}

const words = (list) => [...new Set(list.filter((w) => DRAW.test(w)))].join(',');
const out = { themes: {}, moods: {}, colors: {}, looks: looks() };
const meant = {};
await each(Object.entries(seeds.themes), async ([name, t]) => { meant[name] = await related(t.seeds.filter((w) => !w.includes(' '))); });
const spread = new Map();
Object.values(meant).forEach((set) => set.forEach((w) => spread.set(w, (spread.get(w) ?? 0) + 1)));
for (const [name, t] of Object.entries(seeds.themes)) {
  const own = t.seeds.filter((w) => vocab.has(w));
  const k = [...new Set([...own, ...[...meant[name]].filter((w) => spread.get(w) <= TWO)])];
  out.themes[name] = { k: k.join(','), n: words(t.n), a: words(t.a), v: words(t.v) };
}
out.colors = usualColors(new Set(Object.values(out.themes).flatMap((t) => t.k.split(','))));
for (const [name, list] of Object.entries(seeds.moods)) out.moods[name] = words(list);

writeFileSync(new URL('../../data/words.json', here), JSON.stringify(out));
console.log(`data/words.json: ${JSON.stringify(out).length} bytes`);
