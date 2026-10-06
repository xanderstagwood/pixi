// photos: the picture sets Pixi can pull from. A pick is random without repeating until the whole category has been
// seen, and the data file holds what attribution needs for every photo.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATEGORIES, createPicker } from '../src/photos.js';
import { mulberry32 } from './img.mjs';

const photos = JSON.parse(readFileSync(new URL('../data/photos.json', import.meta.url)));

assert.deepEqual(CATEGORIES, ['lizard', 'crab', 'bird', 'stag', 'bones']);
for (const category of CATEGORIES) assert.ok(photos.some((p) => p.category === category), `${category} has photos`);
for (const p of photos) {
  assert.ok(CATEGORIES.includes(p.category), `${p.id} is in a known category`);
  assert.match(p.url, /^https:\/\/images\.unsplash\.com\//, `${p.id} is served from Unsplash's image host`);
  assert.match(p.link, /^https:\/\/unsplash\.com\/photos\/.*utm_source=pixi/, `${p.id} links to its page, with the referral`);
  assert.match(p.artistLink, /^https:\/\/unsplash\.com\/@.*utm_source=pixi/, `${p.id} links to its artist, with the referral`);
  assert.ok(p.artist, `${p.id} has an artist`);
}

{
  const sample = ['a', 'b', 'c', 'd'].map((id) => ({ id, category: 'lizard' })).concat([{ id: 'x', category: 'crab' }]);
  const pick = createPicker(sample, mulberry32(3));
  const first = [pick('lizard'), pick('lizard'), pick('lizard'), pick('lizard')].map((p) => p.id);
  assert.deepEqual([...first].sort(), ['a', 'b', 'c', 'd'], 'every photo of a category comes once before any comes twice');
  assert.equal(pick('crab').id, 'x', 'and a category only gives its own');
  const next = [];
  for (let i = 0; i < 40; i++) next.push(pick('lizard').id);
  assert.ok(next.every((id, i) => i === 0 || id !== next[i - 1]), 'a fresh bag never opens with the photo that closed the last');
  assert.ok(new Set(next).size === 4, 'all of them keep coming');
  assert.throws(() => pick('dragon'), 'a category with no photos is an error, not a silent nothing');
}

{
  const sample = ['a', 'b', 'c'].map((id) => ({ id, category: 'bird' }));
  const run = (seed) => { const p = createPicker(sample, mulberry32(seed)); return [p('bird').id, p('bird').id, p('bird').id]; };
  assert.deepEqual(run(5), run(5), 'the same seed picks the same way');
  const one = createPicker([{ id: 'only', category: 'bones' }], mulberry32(1));
  assert.deepEqual([one('bones').id, one('bones').id], ['only', 'only'], 'a category of one just repeats it');
}

console.log('ok 18-photos');
