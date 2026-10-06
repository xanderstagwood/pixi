// What a click or a drag on the lizard button asks for, and how its icon moves meanwhile. No page in here.

const FAR = 24; // font pixels a drag must go to choose, and the furthest the icon follows the pointer freely
const FRAMES = 32;

/** The photo set a click asks for: left the lizard, right the crab, middle the birds, with alt the stag and the bones. */
export function categoryFor({ button, alt }) {
  if (button === 2) return alt ? 'bones' : 'crab';
  if (button === 1) return 'bird';
  return button === 0 && alt ? 'stag' : 'lizard';
}

/** The photo set a drag points at (right the crab, up the bird, left the stag, down the bones), or null if it has not gone far enough. */
export function direction(dx, dy) {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < FAR) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'crab' : 'stag';
  return dy < 0 ? 'bird' : 'bones';
}

/** How far the icon moves for a pointer that has moved `d`: with it at first, then less and less, never past a stop. */
export function resist(d) {
  const a = Math.abs(d);
  return Math.sign(d) * (a <= FAR ? a : FAR + 16 * (1 - Math.exp(-(a - FAR) / FAR)));
}

/**
 * The icon let go at `from` springs back to the middle: past it, back, and smaller each time, like a thing on a rubber band.
 * @returns {{x: number, y: number}[]} whole-pixel positions to step through, first where it was let go, last the middle
 */
export function springBack({ x, y }) {
  if (!x && !y) return [{ x: 0, y: 0 }];
  const at = (t) => Math.exp(-5 * t) * Math.cos(2 * Math.PI * 1.25 * t);
  const frames = Array.from({ length: FRAMES }, (_, i) => ({ x: Math.round(x * at(i / (FRAMES - 1))), y: Math.round(y * at(i / (FRAMES - 1))) }));
  frames[0] = { x, y };
  frames[FRAMES - 1] = { x: 0, y: 0 };
  return frames;
}
