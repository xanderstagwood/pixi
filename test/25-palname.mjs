// palname: a palette is called by a theme its chips' names point at and the mood of its colors, in a few shapes.
import assert from 'node:assert/strict';
import { createPalNamer, lookCell, moodOf } from '../src/palname.js';
import { mulberry32 } from './img.mjs';

const words = {
  themes: {
    sea: { k: 'sea,lagoon,tide', n: 'reef,cove', a: 'briny', v: 'drift' },
    fire: { k: 'ember,flame', n: 'cinder,spark', a: 'smoldering', v: 'kindle' },
    wonder: { k: 'gloaming', n: 'sprig,pip', a: 'fey', v: 'unfurl' },
  },
  moods: { 'dark-soft': 'hushed', 'dark-vivid': 'fierce', 'mid-soft': 'gentle', 'mid-vivid': 'jaunty', 'light-soft': 'pearly', 'light-vivid': 'giddy' },
};
const name = createPalNamer(words);

assert.equal(moodOf(['#101418', '#1A1F24']), 'dark-soft', 'dark and grey is dark and soft');
assert.equal(moodOf(['#F8F4EC', '#EDE6D8']), 'light-soft', 'pale and creamy is light and soft');
assert.equal(moodOf(['#FF2A00', '#FFB000']), 'light-vivid', 'bright and saturated is light and vivid');
assert.equal(moodOf(['#7A0A0A', '#8A1A00']), 'dark-vivid', 'deep and saturated is dark and vivid');

const sea = ['Lagoon Mist', 'Tide Pool', 'Slate'];
const used = new Set();
for (let seed = 1; seed < 40; seed++) {
  const n = name(['#223344', '#334455', '#445566'], sea, mulberry32(seed));
  assert.ok(/[A-Z]/.test(n[0]) && n.length <= 24, `"${n}" is capitalized and fits the name box`);
  assert.ok(/reef|cove|briny|drift|hushed/i.test(n), `"${n}" has a sea word or the mood in it`);
  used.add(n);
}
assert.ok(used.size > 5, 'different seeds give different names');
assert.equal(name(['#223344', '#334455', '#445566'], sea, mulberry32(3)), name(['#223344', '#334455', '#445566'], sea, mulberry32(3)), 'the same seed gives the same name');
assert.ok(/sprig|pip|fey|unfurl|hushed/i.test(name(['#223344'], ['Plain Gray'], mulberry32(1))), 'chips that point at no theme fall back to wonder');
assert.ok(/cinder|spark|smoldering|kindle|fierce|hushed/i.test(name(['#223344', '#334455', '#445566'], ['Ember Glow', 'Flame', 'Tide'], mulberry32(2))), 'the theme most chips point at wins');

// A word counts for its theme only as far as the chip it is in has the color the word usually has: "Chocolate Mint" is a
// green, so its chocolate does not make the palette a tea palette.
{
  const hued = {
    themes: {
      tea: { k: 'chocolate,cocoa', n: 'kettle,scone', a: 'cozy', v: 'brew' },
      forest: { k: 'mint,leaf', n: 'fern,grove', a: 'mossy', v: 'sway' },
      wonder: { k: 'gloaming', n: 'sprig,pip', a: 'fey', v: 'unfurl' },
    },
    moods: words.moods,
    colors: { chocolate: '4B2E1E', cocoa: '5A3A28', mint: '3FA35B', leaf: '4C8C3A' },
  };
  const greens = ['#2E5A2B', '#4C8C3A'], browns = ['#4B2E1E', '#6A4430'];
  const greenName = createPalNamer(hued), brown = createPalNamer(hued);
  for (let seed = 1; seed < 30; seed++) {
    const n = greenName(greens, ['Chocolate Mint', 'Cocoa Leaf'], mulberry32(seed));
    assert.ok(!/kettle|scone|cozy|brew/i.test(n), `"${n}" is no tea name for a palette of greens`);
    const b = brown(browns, ['Chocolate Mint', 'Cocoa Leaf'], mulberry32(seed));
    assert.ok(!/fern|grove|mossy|sway/i.test(b), `"${b}" is no forest name for a palette of browns`);
  }
}

// The look of a color: which cell of the lightness, chroma and hue grid it falls in, where the words that describe it live.
assert.equal(lookCell('#101010'), lookCell('#161616'), 'two near-blacks look alike');
assert.notEqual(lookCell('#101010'), lookCell('#EEEEEE'), 'a black and a white do not');
assert.equal(lookCell('#808080'), lookCell('#7A7A7A'), 'greys of one lightness share a cell whatever their faint tint');
assert.notEqual(lookCell('#D03030'), lookCell('#3030D0'), 'a red and a blue do not');
assert.notEqual(lookCell('#B04040'), lookCell('#8A7A7A'), 'a vivid red and a muted one do not');
{
  const looks = { ...words, looks: Object.fromEntries([lookCell('#101010'), lookCell('#EEEEEE')].map((cell, i) => [cell, i ? 'luminousword' : 'inkyword'])) };
  const names = Array.from({ length: 60 }, (_, seed) => createPalNamer(looks)(['#101010', '#111111'], ['Black', 'Black'], mulberry32(seed + 1)));
  assert.ok(names.some((n) => /inky/i.test(n)), 'a dark palette is sometimes called by what its own colors look like');
  assert.ok(!names.some((n) => /luminous/i.test(n)), 'and never by what a pale color looks like');
}

// Now and then a palette with one particular color in it is given a hand-written name for it.
{
  const secret = { ...words, secrets: [['Toadstool Pop', '#D6402B'], ['Midnight Snack', '#1B1A2E']] };
  const red = ['#223344', '#D8442D'], dull = ['#223344', '#556677'];
  assert.equal(createPalNamer(secret)(red, ['x', 'y'], () => 0), 'Toadstool Pop', 'a palette with the color in it, on a lucky roll, takes the name');
  assert.notEqual(createPalNamer(secret)(red, ['x', 'y'], () => 0.99), 'Toadstool Pop', 'an unlucky roll gives the usual name, so the secret stays a surprise');
  assert.ok(!/Toadstool Pop/.test(createPalNamer(secret)(dull, ['x', 'y'], () => 0)), 'a palette without the color never takes it');
  assert.equal(createPalNamer(secret)(['#1C1B2D', '#D7432C'], ['x', 'y'], () => 0), 'Toadstool Pop', 'with two to choose from, the first named takes it');
  const lucky = Array.from({ length: 400 }, (_, seed) => createPalNamer(secret)(red, ['x', 'y'], mulberry32(seed + 1))).filter((n) => n === 'Toadstool Pop').length;
  assert.ok(lucky > 3 && lucky < 60, `it is rare (${lucky} of 400), not never and not often`);
}

console.log('ok 25-palname');
