import { GROUND, brighter, glint, hit, inkFor, inkOver, mix, rgbToHex } from './color.js';
import { nameColors } from './colorname.js';
import { tagLayout } from './credit.js';

// The finished palette card, drawn straight to a canvas in font-pixel units (see pixel.js)
// so it is crisp on screen and the very same drawing exports as a PNG at a bigger scale.
// The card is a window onto the bloxel grid it was analysed in: same block size, same
// pixels. The source image is never kept, only the grid's cell colors.

export const CELL = 16; // font pixels per bloxel
export const CHIPS = 7;
// The chips' left and right edges stop halfway through a bloxel, never lining up with one: 9
// bloxels wide on a card an even number wide. Vertically they are centered to the pixel instead.
const CHIP = { w: 144, h: 32, pitch: 42 };
export const CHIP_W = CHIP.w;
const CHIPS_H = (CHIPS - 1) * CHIP.pitch + CHIP.h;
const INK = '#F3F2F1';
export const CHIP_HIT = 1.6; // a chip's light hit is a bigger step than a bloxel's
export const EXPORT_SCALE = 8; // a downloaded card is 2560 x 3840
// A 6px capital centered between the 1px highlight and the 1px shadow sits on this baseline;
// in the footer's 16px line it sits 11px down.
const LABEL_BASE = 1 + (CHIP.h - 2 - 6) / 2 + 6;
const FOOT_BASE = 11;
// The Pixi logo, drawn from Sprite's 8x8 icon: the cells that are filled, minus its two empty top rows.
const PIXI = [[0, 0], [3, 0], [1, 1], [3, 2], [5, 2], [1, 3], [3, 3], [0, 4], [3, 4], [2, 5]];

// Every card is this many bloxels, whatever the screen: a screen only decides how big a font pixel is drawn (pixel.js).
const cells = { cols: 20, rows: 30 };

export const cardCells = () => cells;

/**
 * Positions inside the card, in font pixels. A footer line runs along the bottom (the name at the left,
 * the credit at the right). The chips sit in the middle of the card, lifted half a bloxel less a third so the
 * footer has its room; the block and the card are both whole font pixels, so every position is too. Sideways
 * they stay half a bloxel off the bloxel lines (see CHIP).
 */
export function layout() {
  const w = cells.cols * CELL, h = cells.rows * CELL;
  const name = { x: 12, y: h - 32, w: 160, h: 16 };
  return { w, h, name, chips: { ...CHIP, x: (w - CHIP.w) / 2, y: (h - CHIPS_H) / 2 - CELL / 2 + Math.round(CELL / 3) } };
}

// Past the edge of a grid the picture is mirrored back, so a card is full of bloxels whatever size the viewport
// it was made in, or is shown in, gives it.
const mirror = (v, n) => { const m = ((v % (2 * n)) + 2 * n) % (2 * n); return m < n ? m : 2 * n - 1 - m; };
const gridIndex = (grid, first, c, r) => (mirror(first.r + r, grid.rows) * grid.cols + mirror(first.c + c, grid.cols)) * 4;

const measure = document.createElement('canvas').getContext('2d');
/**
 * Device pixels from a box's left edge to where `text` starts so it sits centered. Rounded to
 * a whole device pixel, not a whole font pixel: on a display where a font pixel is several
 * device pixels this allows the half-font-pixel nudge that odd-width text needs to look centered.
 */
export function textOffset(text, boxWidth, s, size = 16) {
  measure.font = `${size * s}px "Stagwood Sprite 64", monospace`;
  return Math.round((boxWidth * s - measure.measureText(text).width) / 2);
}

const widthOf = (text) => { measure.font = '16px "Stagwood Sprite 64", monospace'; return measure.measureText(text).width; };

/**
 * The credit tags along the top of a card made from a photo, with where each one goes and where it links, in font
 * pixels. The artist's tag goes to the artist's page, Unsplash's to the photo's.
 * @returns {{text: string, x: number, y: number, w: number, h: number, href: string}[]} none for a card of one's own picture
 */
export function creditTags(palette) {
  const { credit } = palette;
  if (!credit) return [];
  const { artist, unsplash } = tagLayout({ width: layout().w, artist: credit.artist, widthOf });
  return [{ ...artist, href: credit.artistLink }, { ...unsplash, href: credit.link }];
}

/** Where a card's tags link to at a point on it (font pixels from its top left), or '' if the point is on none. */
export const tagAt = (palette, x, y) => creditTags(palette).find((t) => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h)?.href ?? '';

/**
 * @param {HTMLCanvasElement} canvas resized to the card at `s` device px per font pixel
 * @param {{grid: {cols: number, rows: number, rgb: Uint8ClampedArray, cx: number, cy: number}, colors: string[], name: string, copied?: number}} palette colors in stack order, bottom row first
 * @param {number} s whole device pixels per font pixel, so every edge and glyph stays crisp
 * @param {{ui?: boolean, dim?: boolean}} opts ui adds on-screen-only hints (the name placeholder); exports leave
 *        them out. dim veils the blocks and chips (a card that is not in the center) but never the text
 * @returns {string} the ink the name was drawn in, for the caret that types it
 */
export function renderCard(canvas, palette, s, { ui = false, dim = false } = {}) {
  const L = layout();
  canvas.width = L.w * s;
  canvas.height = L.h * s;
  const g = canvas.getContext('2d');
  g.fillStyle = GROUND;
  g.fillRect(0, 0, canvas.width, canvas.height);

  // The window onto the grid.
  const { grid } = palette;
  const first = { c: Math.round(grid.cx - cells.cols / 2), r: Math.round(grid.cy - cells.rows / 2) };
  const cell = CELL * s;
  for (let r = 0; r < cells.rows; r++) {
    for (let c = 0; c < cells.cols; c++) {
      const i = gridIndex(grid, first, c, r);
      const x = c * cell + s, y = r * cell + s;
      g.fillStyle = `rgb(${grid.rgb[i]},${grid.rgb[i + 1]},${grid.rgb[i + 2]})`;
      g.fillRect(x, y, cell - 2 * s, cell - 2 * s); // a font pixel on every side: two between blocks
      g.fillStyle = hit(grid.rgb[i], grid.rgb[i + 1], grid.rgb[i + 2]);
      g.fillRect(x, y, cell - 2 * s, s); // the light hit along the top, as bloxel.js draws it...
      g.fillRect(x, y, s, cell - 2 * s); // ...and down the left
    }
  }

  g.textBaseline = 'alphabetic';
  // A chip is its color with a light line along the top and a shadow line along the bottom,
  // lifted off the blocks by a soft shadow.
  const chip = (row, hex, text) => {
    const x = L.chips.x * s, y = (L.chips.y + row * CHIP.pitch) * s, w = CHIP.w * s, h = CHIP.h * s;
    g.save();
    g.shadowColor = 'rgba(0, 0, 0, 0.4)';
    g.shadowBlur = 6 * s;
    g.shadowOffsetY = 2 * s;
    g.fillStyle = hex;
    g.fillRect(x, y, w, h);
    g.restore();
    g.fillStyle = brighter(hex, CHIP_HIT);
    g.fillRect(x, y, w, s);
    g.fillStyle = mix(hex, '#000000', 0.4);
    g.fillRect(x, y + h - s, w, s);
    g.font = `${16 * s}px "Stagwood Sprite 64", monospace`;
    g.fillStyle = inkFor(hex);
    g.fillText(text, x + textOffset(text, CHIP.w, s), y + LABEL_BASE * s);
  };

  const n = palette.colors.length, names = nameColors(palette.colors); // a click still copies the hex
  palette.colors.forEach((hex, i) => chip(n - 1 - i, hex, palette.copied === i ? `COPIED ${hex}` : names[i]));

  if (dim) { // a veil of the ground color, laid before the name so the name is the same color on every card
    g.fillStyle = 'rgba(0, 0, 0, 0.5)';
    g.fillRect(0, 0, canvas.width, canvas.height);
  }

  // The lines of text over the bloxels: the name at the bottom left, "curated by Pixi" and the logo at the bottom
  // right, and for a photo the credit tags along the top, all in the 16px face. Each takes its ink from the bloxels
  // behind it (inkOver): dark over light ones, light over dark, with a little of their color, so it reads and still
  // belongs. The gaps between bloxels are black, which dark ink cannot be read on, so the ink is edged by a font pixel
  // of the bloxels' average color: the letters carry their own backing across a gap, and the grid stays visible.
  g.font = `${16 * s}px "Stagwood Sprite 64", monospace`;
  const behind = (x, y, w, h) => {
    const out = [];
    for (let r = Math.floor(y / CELL); r <= Math.floor((y + h - 1) / CELL); r++) {
      for (let c = Math.floor(x / CELL); c <= Math.floor((x + w - 1) / CELL); c++) {
        const i = gridIndex(grid, first, c, r);
        out.push({ r: grid.rgb[i], g: grid.rgb[i + 1], b: grid.rgb[i + 2] });
      }
    }
    return out;
  };
  const write = (draw, x, y, w, alpha = 1) => {
    const colors = behind(x, y, w, 16);
    const mean = (k) => Math.round(colors.reduce((sum, c) => sum + c[k], 0) / colors.length);
    const ink = inkOver(colors.map(rgbToHex));
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = rgbToHex({ r: mean('r'), g: mean('g'), b: mean('b') });
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        g.save();
        g.translate(dx * s, dy * s);
        draw();
        g.restore();
      }
    }
    g.fillStyle = ink;
    draw();
    g.restore();
    return ink;
  };
  const width = (text) => g.measureText(text).width / s;
  const base = (y) => (y + FOOT_BASE) * s;

  const label = palette.name || (ui ? 'NAME' : '');
  const nameInk = label ? write(() => g.fillText(label, L.name.x * s, base(L.name.y)), L.name.x, L.name.y, width(label), palette.name ? 1 : 0.6) : INK;

  const words = 'curated by Pixi', icon = 6, gap = 4, edge = L.w - 12;
  const credit = { x: edge - icon - gap - width(words), w: width(words) + gap + icon };
  write(() => {
    g.fillText(words, Math.round(credit.x * s), base(L.name.y));
    for (const [cx, cy] of PIXI) g.fillRect((edge - icon + cx) * s, base(L.name.y) - 5 * s + cy * s, s, s); // a 6px icon as tall as a capital, sitting one pixel low
  }, credit.x, L.name.y, credit.w);

  for (const t of creditTags(palette)) write(() => g.fillText(t.text, t.x * s, base(t.y)), t.x, t.y, t.w);
  return nameInk;
}

/**
 * The blocks of a card that may twinkle: those in view and clear of the chips (with their shadow) and
 * the footer, so a lit block never lands on top of anything else.
 * @returns {{c: number, r: number, rgb: number[]}[]}
 */
export function twinkleCells(palette) {
  const L = layout();
  const { grid } = palette;
  const first = { c: Math.round(grid.cx - cells.cols / 2), r: Math.round(grid.cy - cells.rows / 2) };
  const topRows = palette.credit ? 2 : 0; // the credit runs along the top
  const block = { x0: L.chips.x - 8, x1: L.chips.x + L.chips.w + 8, y0: L.chips.y - 4, y1: L.chips.y + (CHIPS - 1) * CHIP.pitch + CHIP.h + 12 };
  const out = [];
  for (let r = 0; r < cells.rows; r++) {
    for (let c = 0; c < cells.cols; c++) {
      const x = c * CELL, y = r * CELL;
      const overChips = x < block.x1 && x + CELL > block.x0 && y < block.y1 && y + CELL > block.y0;
      if (overChips || y + CELL > L.name.y - 4 || r < topRows) continue;
      const i = gridIndex(grid, first, c, r);
      out.push({ c, r, rgb: [grid.rgb[i], grid.rgb[i + 1], grid.rgb[i + 2]] });
    }
  }
  return out;
}

/**
 * Draws one block of a card lit by `amount` (0 to 1) on a transparent layer laid over the card, so the
 * card itself, and the PNG made from it, never carries a twinkle. 0 clears the block.
 */
export function paintTwinkle(ctx, { c, r, rgb }, s, amount) {
  const cell = CELL * s, x = c * cell, y = r * cell;
  ctx.clearRect(x, y, cell, cell);
  if (amount <= 0) return;
  const lit = glint(rgb[0], rgb[1], rgb[2], amount);
  ctx.fillStyle = `rgb(${lit.r},${lit.g},${lit.b})`;
  ctx.fillRect(x + s, y + s, cell - 2 * s, cell - 2 * s);
  ctx.fillStyle = hit(lit.r, lit.g, lit.b);
  ctx.fillRect(x + s, y + s, cell - 2 * s, s);
  ctx.fillRect(x + s, y + s, s, cell - 2 * s);
}

/** The card as a PNG blob at export size. */
export function cardPng(palette) {
  const c = document.createElement('canvas');
  renderCard(c, palette, EXPORT_SCALE);
  return new Promise((done) => c.toBlob(done, 'image/png'));
}

/** Which chip a click at (x, y) font pixels hits: its index (0 = bottom row), or -1. */
export function chipAt(x, y, count) {
  const { chips } = layout();
  const row = Math.floor((y - chips.y) / chips.pitch);
  const inside = x >= chips.x && x < chips.x + chips.w && (y - chips.y) - row * chips.pitch < chips.h;
  return inside && row >= 0 && row < count ? count - 1 - row : -1;
}
