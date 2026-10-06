// scaleFor: the card is always 20 x 30 cells, so what changes with the screen is how many device pixels one
// font pixel gets. It is the largest whole number that still leaves the card and its buttons room to breathe.
import assert from 'node:assert/strict';
import { scaleFor } from '../src/pixel.js';

assert.equal(scaleFor(1920, 1080), 1, 'a 1080p monitor holds the card at one device pixel per font pixel');
assert.equal(scaleFor(2560, 1440), 2, 'a 1440p monitor has room for it twice as big');
assert.equal(scaleFor(3840, 2160), 3, 'a 4K monitor, three times');
assert.equal(scaleFor(2880, 1800), 2, 'a retina laptop (1440 x 900 css) keeps the old size');
assert.equal(scaleFor(1170, 2532), 3, 'a phone with a tall screen gets a crisp pixel for each of its');
assert.equal(scaleFor(360, 640), 1, 'never below one device pixel, even where the card cannot fit');
assert.equal(scaleFor(0, 0), 1, 'a window with no size yet is one');
assert.ok(scaleFor(900, 3000) <= 2, 'a narrow window is limited by its width: 900 / 352');

console.log('ok 19-scale');
