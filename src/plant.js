import { hexToRgb } from './color.js';

/**
 * Makes sure every chip color is a real bloxel. A palette color is an average nudged by `variations`,
 * so the picture rarely holds it; each color is put on the free cell nearest the spot it was sampled
 * from, so the drone that hunts it has something to land on. A color the grid already holds is claimed
 * where it is, nearest its spot, and nothing is changed for it.
 * @param {Uint8ClampedArray} rgba cell colors, row by row, four bytes a cell; not changed
 * @param {number} cols
 * @param {number} rows
 * @param {string[]} colors hex colors to plant, in order: an earlier one wins a contested cell
 * @param {{cx: number, cy: number}[]} spots the cell each color was sampled from
 * @returns {{rgba: Uint8ClampedArray, cells: number[]}} a planted copy, and the cell each color holds (-1 if the grid is full)
 */
export function plant(rgba, cols, rows, colors, spots) {
  const out = rgba.slice();
  const taken = new Set();
  const cells = colors.map((hex, i) => {
    const { r, g, b } = hexToRgb(hex);
    const { cx, cy } = spots[i];
    const away = (c) => (c % cols - cx) ** 2 + (Math.floor(c / cols) - cy) ** 2;
    let held = -1, free = -1;
    for (let c = 0; c < cols * rows; c++) {
      if (taken.has(c)) continue;
      if (out[c * 4] === r && out[c * 4 + 1] === g && out[c * 4 + 2] === b && (held < 0 || away(c) < away(held))) held = c;
      if (free < 0 || away(c) < away(free)) free = c;
    }
    const cell = held >= 0 ? held : free;
    if (cell < 0) return -1;
    taken.add(cell);
    out.set([r, g, b], cell * 4);
    return cell;
  });
  return { rgba: out, cells };
}
