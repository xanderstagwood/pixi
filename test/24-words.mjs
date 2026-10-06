// words: the whimsy lists the palette names are made of. They are edited by hand, so each must be whole: every theme has
// words of each kind and words that point at it, every mood has words, and every word is one the pixel font draws.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { themes, moods, secrets } = JSON.parse(readFileSync(new URL('../data/words.json', import.meta.url), 'utf8'));
const listed = (text) => text.split(',');
const drawable = (list) => list.every((w) => /^[a-z]{3,12}$/.test(w));

for (const [name, theme] of Object.entries(themes)) {
  for (const kind of ['k', 'n', 'a', 'v']) {
    assert.ok(theme[kind], `theme ${name} has ${kind} words`);
    if (kind !== 'k') assert.ok(drawable(listed(theme[kind])), `theme ${name}: every ${kind} word is plain lowercase the font draws`); // k is matched against names, never drawn
  }
}
for (const [name, text] of Object.entries(moods)) assert.ok(text && drawable(listed(text)), `mood ${name} has words, all of them drawable`);
assert.ok(Object.keys(themes).length >= 30 && Object.keys(moods).length === 6, 'the themes and the six moods are all there');

assert.ok(secrets.length >= 30 && secrets.every(([name, hex]) => name.length <= 24 && /^[A-Za-z' .]+$/.test(name) && /^#[0-9A-F]{6}$/i.test(hex)), 'there are plenty of secret names, each one that fits a card and has a color');
assert.equal(new Set(secrets.map(([name]) => name)).size, secrets.length, 'and none twice');

console.log('ok 24-words');
