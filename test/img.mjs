// Fixtures for the checks: synthetic images shaped like what extractColors takes.
import { hexToRgb } from '../src/color.js';

/** Seeded rng, so a random-seeded pipeline gives the same answer every run. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIDE = 32;
const paint = (data, i, hex) => {
  const { r, g, b } = hexToRgb(hex);
  data.set([r, g, b, 255], i * 4);
};
const image = (fill) => {
  const data = new Uint8ClampedArray(SIDE * SIDE * 4);
  for (let i = 0; i < SIDE * SIDE; i++) fill(data, i);
  return { data, width: SIDE, height: SIDE };
};

/** One color everywhere. */
export const flat = (hex) => image((d, i) => paint(d, i, hex));

/** Colored regions in order, each taking its `share` (fractions summing to 1) of the pixels. */
export function patches(list) {
  const ends = [];
  list.reduce((sum, p) => (ends.push(sum + p.share), sum + p.share), 0);
  return image((d, i) => {
    const at = i / (SIDE * SIDE);
    paint(d, i, list[Math.max(0, ends.findIndex((e) => at < e))].hex);
  });
}

/** Every pixel one of `hexes`, picked by `rng`. */
export const noise = (hexes, rng) => image((d, i) => paint(d, i, hexes[Math.floor(rng() * hexes.length)]));

/** A fully transparent image. */
export const clear = () => ({ data: new Uint8ClampedArray(SIDE * SIDE * 4), width: SIDE, height: SIDE });
