// plant: puts every chip color into the grid, byte-exact, beside where it was sampled.
import assert from 'node:assert/strict';
import { hexToRgb } from '../src/color.js';
import { plant } from '../src/plant.js';

const COLS = 8, ROWS = 8;
const grid = (hex = '#808080', cols = COLS, rows = ROWS) => {
  const { r, g, b } = hexToRgb(hex);
  const rgba = new Uint8ClampedArray(cols * rows * 4);
  for (let i = 0; i < cols * rows; i++) rgba.set([r, g, b, 255], i * 4);
  return rgba;
};
const colorAt = (rgba, i) => [...rgba.subarray(i * 4, i * 4 + 3)];
const rgbOf = (hex) => { const { r, g, b } = hexToRgb(hex); return [r, g, b]; };
const changed = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++; return n; };

const HEXES = ['#C0392B', '#2980B9', '#27AE60', '#F1C40F', '#8E44AD', '#E67E22', '#16A085'];
const SPOTS = [[1, 1], [6, 1], [3, 3], [1, 6], [6, 6], [4, 0], [0, 4]].map(([cx, cy]) => ({ cx, cy }));

{
  const input = grid();
  const { rgba, cells } = plant(input, COLS, ROWS, HEXES, SPOTS);
  HEXES.forEach((hex, i) => assert.deepEqual(colorAt(rgba, cells[i]), rgbOf(hex), `${hex} is in the grid byte-exact, at the cell reported for it`));
  assert.equal(new Set(cells).size, 7, 'no two colors share a cell');
  assert.equal(changed(input, rgba), 7, 'only the seven planted cells differ from the input');
  assert.deepEqual(cells, SPOTS.map(({ cx, cy }) => cy * COLS + cx), 'with free cells, each color sits on its own spot');
  assert.ok(Array.from({ length: COLS * ROWS }, (_, i) => rgba[i * 4 + 3]).every((a) => a === 255), 'alpha is untouched');
}

{
  const input = grid();
  const before = input.slice();
  plant(input, COLS, ROWS, HEXES, SPOTS);
  assert.deepEqual(input, before, 'the input array is not mutated');
}

{
  const spot = { cx: 3, cy: 3 };
  const { cells } = plant(grid(), COLS, ROWS, [HEXES[0], HEXES[1]], [spot, spot]);
  assert.equal(cells[0], 3 * COLS + 3, 'the first color takes the shared spot');
  const d = Math.hypot((cells[1] % COLS) - 3, Math.floor(cells[1] / COLS) - 3);
  assert.equal(d, 1, 'the second takes a free cell right beside it, not one further off');
}

{
  const input = grid();
  input.set([...rgbOf(HEXES[2]), 255], 5 * 4);
  const { rgba, cells } = plant(input, COLS, ROWS, [HEXES[2]], [{ cx: 0, cy: 0 }]);
  assert.equal(cells[0], 5, 'a color already in the grid is found there');
  assert.equal(changed(input, rgba), 0, 'and no cell is changed for it');
}

{
  const { rgba, cells } = plant(grid('#808080', 3, 2), 3, 2, HEXES, SPOTS.map(() => ({ cx: 1, cy: 0 })));
  assert.equal(cells.filter((c) => c >= 0).length, 6, 'a grid of six cells takes six colors');
  assert.equal(cells[6], -1, 'the one that did not fit reports no cell');
  assert.equal(rgba.length, 3 * 2 * 4, 'the grid keeps its size');
}

console.log('ok 04-plant');
