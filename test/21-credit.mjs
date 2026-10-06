// credit: what a card says about its photo. Artist names are cleaned down to what the pixel font can draw, the
// bird category is spelled the way Pixi spells it, and the two tags are laid out along the top of the card
// without running into each other.
import assert from 'node:assert/strict';
import { categoryName, creditName, ellipsize, tagLayout } from '../src/credit.js';

assert.equal(creditName('Dikaseva'), 'Dikaseva', 'plain names pass through');
assert.equal(creditName('Jiří Suchý'), 'Jiří Suchý', 'accents the font draws are kept');
assert.equal(creditName('Jiří Suchý', ''), 'Jiri Suchy', 'and the ones it lacks are stripped to their letter');
assert.equal(creditName('Őszi ünde'), 'Oszi ünde', 'an accent the font lacks goes even where its letter has others');
assert.equal(creditName('Jiří Suchý', 'íř'), 'Jiří Suchy', 'and kept where the font has them');
assert.equal(creditName('Pawłowski Øyvind', ''), 'Pawlowski Oyvind', 'letters with a stroke have no accent to strip, so they are swapped');
assert.equal(creditName('Pawłowski Øyvind'), 'Pawłowski Oyvind', 'unless the font draws them');
assert.equal(creditName('Sam 🐷'), 'Sam', 'what cannot be drawn is dropped, and the space it leaves with it');
assert.equal(creditName('𝕡𝕒𝕤𝕟'), 'pasn', 'styled letters turn into plain ones');
assert.equal(creditName('庆'), 'an Unsplash artist', 'a name with nothing drawable left is credited anonymously');
assert.equal(creditName('  A   B  '), 'A B', 'spaces are tidied');

assert.equal(categoryName('bird'), 'birb', 'birds are birbs, on purpose');
assert.equal(categoryName('lizard'), 'lizard');
assert.equal(categoryName('bones'), 'bones');

const width = (s) => s.length * 5;
assert.equal(ellipsize('short', 100, width), 'short', 'text that fits is left alone');
assert.equal(ellipsize('a very long name indeed', 60, width), 'a very lo...', 'text that does not fit is cut, with dots');
assert.ok(width(ellipsize('a very long name indeed', 60, width)) <= 60, 'and the cut text fits');
assert.equal(ellipsize('anything', 10, width), '', 'room for not even the dots is no text');

{
  const { artist, unsplash } = tagLayout({ width: 320, artist: 'Dikaseva', widthOf: width });
  assert.equal(artist.text, 'photo by Dikaseva');
  assert.equal(unsplash.text, 'provided by Unsplash');
  assert.equal(artist.x, 12, 'the credit starts at the card margin');
  assert.equal(unsplash.x + unsplash.w, 320 - 12, 'and the Unsplash tag ends at the other');
  assert.ok(artist.x + artist.w < unsplash.x, 'they do not touch');
  assert.equal(artist.y, unsplash.y, 'on one line');
  const long = tagLayout({ width: 320, artist: 'A'.repeat(80), widthOf: width });
  assert.ok(long.artist.x + long.artist.w + 8 <= long.unsplash.x, 'a long name is shortened to leave the other tag its room');
  assert.ok(long.artist.text.endsWith('...'));
}

console.log('ok 21-credit');
