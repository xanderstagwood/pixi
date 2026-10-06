import { hexToRgb } from './color.js';
import { rgbToOklab } from './oklab.js';

/**
 * @param {[string, string][]} list [name, hex] pairs
 * @returns {(hexes: string[]) => string[]} each color's nearest name by OKLab distance, so what an eye reads as close is
 *   close; a name goes to one chip only (the next chip takes the next nearest), and a chip with none left keeps its hex
 */
export function createNamer(list) {
  const labs = list.map(([, hex]) => rgbToOklab(hexToRgb(hex)));
  return (hexes) => {
    const taken = new Set();
    return hexes.map((hex) => {
      const c = rgbToOklab(hexToRgb(hex));
      let best = -1, bd = Infinity;
      labs.forEach((l, i) => {
        const d = (l.L - c.L) ** 2 + (l.a - c.a) ** 2 + (l.b - c.b) ** 2;
        if (d < bd && !taken.has(i)) { bd = d; best = i; }
      });
      if (best < 0) return hex;
      taken.add(best);
      return list[best][0];
    });
  };
}

let namer = null;

/** The names, once `loadColorNames` has them; until then (or if they never come) a chip shows its hex. */
export const nameColors = (hexes) => (namer ? namer(hexes) : hexes);

/** Fetches the name list (a snapshot of color-name-list's best-of, see data/colornames.NOTICE). */
export async function loadColorNames() {
  const response = await fetch('data/colornames.json');
  if (!response.ok) throw new Error(`color names: ${response.status}`);
  namer = createNamer(await response.json());
}
