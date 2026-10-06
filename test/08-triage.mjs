// triage: which dropped files get in, and why the others do not, so a turned-away drop can be answered.
import assert from 'node:assert/strict';
import { triage } from '../src/triage.js';

const file = (type, size = 1000, name = 'f') => ({ type, size, name });
const img = (n) => file('image/png', 1000, `i${n}`);
const MAX = 25 * 1024 * 1024;

{
  const files = [img(1), img(2)];
  assert.deepEqual(triage(files, { room: 9, maxBytes: MAX }), { take: files, refused: [] }, 'pictures within the limits all get in');
}
assert.deepEqual(triage([file('application/pdf')], { room: 9, maxBytes: MAX }), { take: [], refused: ['not-image'] }, 'a document is turned away as not a picture');
assert.deepEqual(triage([file('image/png', MAX + 1)], { room: 9, maxBytes: MAX }), { take: [], refused: ['too-big'] }, 'a picture over the size limit is too big');
assert.equal(triage([file('image/png', MAX)], { room: 9, maxBytes: MAX }).take.length, 1, 'exactly the size limit still gets in');
{
  const files = Array.from({ length: 12 }, (_, i) => img(i));
  const { take, refused } = triage(files, { room: 9, maxBytes: MAX });
  assert.deepEqual(take, files.slice(0, 9), 'the first nine get in, in order');
  assert.deepEqual(refused, ['too-many'], 'the rest are too many');
}
assert.deepEqual(triage([img(1)], { room: 0, maxBytes: MAX }), { take: [], refused: ['too-many'] }, 'a full batch turns away even one more');
{
  const good = img(1);
  assert.deepEqual(triage([good, file('text/plain')], { room: 9, maxBytes: MAX }), { take: [good], refused: ['not-image'] }, 'the good one gets in and the stray is still answered');
}
assert.deepEqual(triage([file('application/pdf'), file('text/plain')], { room: 9, maxBytes: MAX }).refused, ['not-image'], 'one reason is given once');
{
  const { refused } = triage([file('image/png', MAX + 1), file('application/pdf'), img(1), img(2)], { room: 1, maxBytes: MAX });
  assert.deepEqual(refused, ['too-big', 'not-image', 'too-many'], 'reasons come in the order they were met');
}
assert.deepEqual(triage([file('application/pdf', MAX + 1)], { room: 9, maxBytes: MAX }).refused, ['not-image'], 'not a picture outranks too big');
assert.deepEqual(triage([], { room: 9, maxBytes: MAX }), { take: [], refused: [] }, 'dropping nothing is not an offence');

console.log('ok 08-triage');
