// colorname: each chip is called by the nearest name in a list, never by the same name as another chip of its card.
import assert from 'node:assert/strict';
import { createNamer } from '../src/colorname.js';

const list = [['Ember', '#CC3311'], ['Coal', '#111111'], ['Snow', '#F5F5F5'], ['Rust', '#C23A14']];
const name = createNamer(list);

assert.deepEqual(name(['#111111']), ['Coal'], 'a color on the list is called by its name');
assert.deepEqual(name(['#0A0A0A', '#FAFAFA']), ['Coal', 'Snow'], 'any other is called by the nearest');
assert.deepEqual(name(['#CC3311', '#CD3413']), ['Ember', 'Rust'], 'two chips never share a name: the second takes the next nearest');
assert.deepEqual(name(['#CD3413', '#CC3311']), ['Ember', 'Rust'], 'and each name is a close one whichever chip comes first');
assert.deepEqual(name(['#111111', '#111111', '#111111', '#111111', '#111111']).slice(4), ['#111111'], 'with no name left a chip keeps its hex');

console.log('ok 23-colorname');
