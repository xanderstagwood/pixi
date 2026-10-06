// Builds data/words.json from seeds.json. The whimsy words (n nouns, a adjectives, v verbs) and the moods are written by
// hand in seeds.json: Datamuse (https://www.datamuse.com/api/) brings in place names and the wrong kinds of word when asked
// for them. What it is good at is breadth, so each theme's seeds are grown with it into the words that a color name might
// use for the theme (k): a chip called "Lagoon Mist" can then pick the sea.
// Run by hand when the seeds change: node scripts/words/build.mjs (needs the network; the app never does).
import { readFileSync, writeFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const seeds = JSON.parse(readFileSync(new URL('seeds.json', here), 'utf8'));
const vocab = new Set(JSON.parse(readFileSync(new URL('../../data/colornames.json', here), 'utf8')).flatMap(([name]) => name.toLowerCase().match(/[a-z]+/g)));
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

/** The words of a color name that mean what the seeds mean: the seeds, and what Datamuse relates to them. */
async function triggers(list) {
  const topics = list.slice(0, 5).join(',');
  const hits = (await each(list, (seed) => Promise.all([ask({ ml: seed, topics }), ask({ rel_trg: seed })]))).flat(2);
  return [...new Set([...list, ...hits.map((h) => h.word.toLowerCase())])].filter((w) => vocab.has(w));
}

const words = (list) => [...new Set(list.filter((w) => DRAW.test(w)))].join(',');
const out = { themes: {}, moods: {} };
await each(Object.entries(seeds.themes), async ([name, t]) => {
  out.themes[name] = { k: (await triggers(t.seeds.filter((w) => !w.includes(' ')))).join(','), n: words(t.n), a: words(t.a), v: words(t.v) };
});
for (const [name, list] of Object.entries(seeds.moods)) out.moods[name] = words(list);

writeFileSync(new URL('../../data/words.json', here), JSON.stringify(out));
console.log(`data/words.json: ${JSON.stringify(out).length} bytes`);
