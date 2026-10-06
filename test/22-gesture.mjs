// gesture: which photo set a click or a drag on the lizard button asks for, and how the icon moves while it is dragged
// and when it is let go. Pure: nothing here touches the page.
import assert from 'node:assert/strict';
import { categoryFor, direction, resist, springBack } from '../src/gesture.js';

// Clicks: left is the lizard, right the crab, middle the birds; alt turns left into the stag and right into the bones.
assert.equal(categoryFor({ button: 0, alt: false }), 'lizard');
assert.equal(categoryFor({ button: 2, alt: false }), 'crab');
assert.equal(categoryFor({ button: 1, alt: false }), 'bird');
assert.equal(categoryFor({ button: 0, alt: true }), 'stag');
assert.equal(categoryFor({ button: 2, alt: true }), 'bones');
assert.equal(categoryFor({ button: 1, alt: true }), 'bird', 'alt means nothing to the middle button');
assert.equal(categoryFor({ button: 4, alt: false }), 'lizard', 'a button it does not know is a plain click');

// Drags: right the crab, up the bird, left the stag, down the bones, once it has gone far enough; the longer way wins.
assert.equal(direction(30, 0), 'crab');
assert.equal(direction(0, -30), 'bird');
assert.equal(direction(-30, 0), 'stag');
assert.equal(direction(0, 30), 'bones');
assert.equal(direction(30, -10), 'crab', 'the longer way wins');
assert.equal(direction(-10, -30), 'bird');
assert.equal(direction(20, 0), null, 'not far enough yet');
assert.equal(direction(8, 6), null, 'a small movement is a click');
assert.equal(direction(24, 0), 'crab', 'exactly the distance counts');

// While dragging, the icon follows the pointer freely nearly to the edge of its button (`limit`), then resists a little.
assert.equal(resist(0, 100), 0);
assert.equal(resist(60, 100), 60, 'it follows closely');
assert.equal(resist(-60, 100), -60, 'in either direction');
assert.equal(resist(100, 100), 100, 'right up to the limit');
assert.ok(resist(130, 100) > 100 && resist(130, 100) < 130, 'past it, it moves less than the pointer');
assert.ok(resist(1000, 100) < 110, 'and only a little further, however far the pointer goes');
assert.ok(resist(140, 100) > resist(120, 100), 'it never goes backward');

// Let go, it springs back to the middle, overshoots and settles.
{
  const frames = springBack({ x: 20, y: 0 });
  assert.deepEqual(frames[0], { x: 20, y: 0 }, 'it starts where it was let go');
  assert.deepEqual(frames[frames.length - 1], { x: 0, y: 0 }, 'it ends at the center');
  assert.ok(frames.some((f) => f.x < 0), 'and swings past it on the way');
  assert.ok(frames.every((f) => Number.isInteger(f.x) && Number.isInteger(f.y)), 'in whole pixels, so the icon stays crisp');
  const up = springBack({ x: 0, y: -20 });
  assert.ok(up.some((f) => f.y > 0) && up.every((f) => f.x === 0), 'the same, along the other axis');
  assert.deepEqual(springBack({ x: 0, y: 0 }), [{ x: 0, y: 0 }], 'nothing to spring back from');
}

console.log('ok 22-gesture');
