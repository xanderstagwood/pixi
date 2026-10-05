// clickIntent: what a click on a card means. The "+" card starts a palette at once, focused or not.
import assert from 'node:assert/strict';
import { clickIntent } from '../src/carousel.js';

assert.equal(clickIntent({ isAdd: true, isFocused: true, onCanvas: true }), 'new', 'a focused new card starts a palette');
assert.equal(clickIntent({ isAdd: true, isFocused: false, onCanvas: true }), 'new', 'an unfocused new card starts a palette without a second click');
assert.equal(clickIntent({ isAdd: true, isFocused: false, onCanvas: false }), 'new', 'the new card starts a palette wherever on it the click lands');
assert.equal(clickIntent({ isAdd: false, isFocused: false, onCanvas: true }), 'focus', 'an unfocused palette card only takes focus');
assert.equal(clickIntent({ isAdd: false, isFocused: true, onCanvas: true }), 'copy', 'a focused palette card copies a chip when its canvas is clicked');
assert.equal(clickIntent({ isAdd: false, isFocused: true, onCanvas: false }), 'none', 'a focused palette card ignores a click off its canvas');
for (const isFocused of [true, false]) {
  assert.notEqual(clickIntent({ isAdd: true, isFocused, onCanvas: true }), 'copy', 'the new card never copies a chip');
}

console.log('ok 02-new-card');
