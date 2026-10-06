// palname: a palette is called by a theme its chips' names point at and the mood of its colors, in a few shapes.
import assert from 'node:assert/strict';
import { createPalNamer, moodOf } from '../src/palname.js';
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
  const n = name(['#223344', '#334455'], sea, mulberry32(seed));
  assert.ok(/[A-Z]/.test(n[0]) && n.length <= 24, `"${n}" is capitalized and fits the name box`);
  assert.ok(/reef|cove|briny|drift|hushed/i.test(n), `"${n}" has a sea word or the mood in it`);
  used.add(n);
}
assert.ok(used.size > 5, 'different seeds give different names');
assert.equal(name(['#223344'], sea, mulberry32(3)), name(['#223344'], sea, mulberry32(3)), 'the same seed gives the same name');
assert.ok(/sprig|pip|fey|unfurl|hushed/i.test(name(['#223344'], ['Plain Gray'], mulberry32(1))), 'chips that point at no theme fall back to wonder');
assert.ok(/cinder|spark|smoldering|kindle|fierce|hushed/i.test(name(['#223344'], ['Ember Glow', 'Flame', 'Tide'], mulberry32(2))), 'the theme most chips point at wins');

console.log('ok 25-palname');
