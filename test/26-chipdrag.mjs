// chipdrag: a chip is picked up by its row and dropped into another. As in Sprite's tiles, the slot is the one under the
// pointer, and the chips between slide one row to open the gap.
import assert from 'node:assert/strict';
import { moveItem, shifts, slotAt } from '../src/chipdrag.js';

assert.deepEqual(moveItem(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd'], 'a chip moved up the list takes its new place and the others close the gap');
assert.deepEqual(moveItem(['a', 'b', 'c', 'd'], 3, 1), ['a', 'd', 'b', 'c'], 'and moved the other way');
assert.deepEqual(moveItem(['a', 'b', 'c'], 1, 1), ['a', 'b', 'c'], 'a chip put back where it was changes nothing');
const list = ['a', 'b', 'c'];
moveItem(list, 0, 2);
assert.deepEqual(list, ['a', 'b', 'c'], 'the list given is left alone, so a drag can be previewed and thrown away');

// Seven chips, 42 font pixels apart from a top of 100: row 0 is the top row, which is the last in the list (the list runs bottom first).
const slot = (y) => slotAt(y, 100, 42, 7);
assert.equal(slot(100), 6, 'a pointer on the top row is over the top of the stack');
assert.equal(slot(141), 6, 'and still there until the next row starts');
assert.equal(slot(142), 5, 'which it takes at once');
assert.equal(slot(100 + 42 * 6 + 10), 0, 'the bottom row is the bottom slot');
assert.equal(slot(-500), 6, 'a pointer far above the stack is over the top');
assert.equal(slot(9000), 0, 'and far below, the bottom');

// Rows each chip moves while another is carried: dragged up the list (down the card) the ones passed rise... down a row, and back.
assert.deepEqual(shifts(4, 0, 2), [0, 1, 1, 0], 'the chips a chip passes on its way up the list drop one row down the card to make room');
assert.deepEqual(shifts(4, 3, 1), [0, -1, -1, 0], 'and the other way they rise one row');
assert.deepEqual(shifts(4, 1, 1), [0, 0, 0, 0], 'over its own slot nothing moves');

console.log('ok 26-chipdrag');
