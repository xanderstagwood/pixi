// imagesFrom: the image files on a clipboard, so ctrl+v can start palettes. Fake clipboardData stands in for the browser's.
import assert from 'node:assert/strict';
import { imagesFrom } from '../src/paste.js';

const file = (type, name = 'f') => ({ type, name });
const item = (kind, f) => ({ kind, type: f.type, getAsFile: () => f });
const png = file('image/png', 'a.png'), jpg = file('image/jpeg', 'b.jpg'), pdf = file('application/pdf', 'c.pdf');

assert.deepEqual(imagesFrom({ items: [item('file', png)] }), [png], 'one image item gives that file');
assert.deepEqual(imagesFrom({ items: [{ kind: 'string', type: 'text/plain', getAsFile: () => null }] }), [], 'a text-only clipboard gives nothing');
assert.deepEqual(imagesFrom({ items: [{ kind: 'file', type: 'image/png', getAsFile: () => null }] }), [], 'an item with no file is skipped without a throw');
assert.deepEqual(imagesFrom({ items: [item('file', pdf)] }), [], 'a non-image file is skipped');
assert.deepEqual(imagesFrom({ items: [item('file', png), item('file', pdf), item('file', jpg)] }), [png, jpg], 'several images come back in order, other files skipped');
assert.deepEqual(imagesFrom({ files: [png, pdf] }), [png], 'with no items, the files list is used');
assert.deepEqual(imagesFrom(null), [], 'null gives nothing');
assert.deepEqual(imagesFrom(undefined), [], 'undefined gives nothing');

console.log('ok 03-paste');
