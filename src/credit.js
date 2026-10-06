// What a card says about its photo, in the pixel font: the artist's credit and the Unsplash tag along the top.

// Letters beyond plain ASCII that the font draws. Anything else is stripped to its base letter, or dropped.
// ponytail: a list kept by hand, in step with the accents in fonts/stagwood-sprite-64.ttf: add a letter when it is drawn.
const DRAWN = 'ıáéíóúýćńÉàèìòùäëïöüåãõñčěšřžāēīōūçłø';
const STROKED = { ł: 'l', Ł: 'L', ø: 'o', Ø: 'O' }; // no accent to strip: these have a stroke through them

const MARGIN = 12; // font pixels from the card's edge, the same as the footer's
const TOP = 16; // the line sits in the second row of bloxels from the top, which is 16 tall like the line, with the caps in its middle
const LINE = 16;
const GAP = 8; // between the two tags at the least

/** The artist's name as the font can draw it. @param {string} drawn letters beyond ASCII the font has */
export function creditName(artist, drawn = DRAWN) {
  const plain = (c) => (c >= ' ' && c <= '~') || drawn.includes(c);
  let out = '';
  for (const c of artist) {
    if (plain(c)) { out += c; continue; }
    if (STROKED[c]) { out += STROKED[c]; continue; }
    for (const d of c.normalize('NFKD').replace(/\p{M}/gu, '')) if (plain(d)) out += d;
  }
  return out.replace(/\s+/g, ' ').trim() || 'an Unsplash artist';
}

const NAMES = { lizard: 'lizard, lizard, lizard...', crab: 'all become crab', bird: 'birb' }; // on purpose
/** What a category's photos are called, which is also what a fresh card from them is named. */
export const categoryName = (category) => NAMES[category] ?? category;

/** `name`, or the lowest number after it that no name in `taken` has: crab, crab 2, crab 3. */
export function numbered(name, taken) {
  let n = 1;
  while (taken.includes(n > 1 ? `${name} ${n}` : name)) n++;
  return n > 1 ? `${name} ${n}` : name;
}

/** Cuts `text` to fit `max` with `...` where it ends, or to nothing if even the dots will not fit. */
export function ellipsize(text, max, widthOf) {
  if (widthOf(text) <= max) return text;
  for (let n = text.length - 1; n > 0; n--) {
    const cut = `${text.slice(0, n).trimEnd()}...`;
    if (widthOf(cut) <= max) return cut;
  }
  return '';
}

/**
 * Where the two tags go along the top of a card, in font pixels: the credit at the left, Unsplash's at the right.
 * @param {{width: number, artist: string, widthOf: (text: string) => number}} card `widthOf` measures text in the 16px face
 */
export function tagLayout({ width, artist, widthOf }) {
  const brand = 'provided by Unsplash';
  const unsplash = { text: brand, w: widthOf(brand), x: 0, y: TOP, h: LINE };
  unsplash.x = width - MARGIN - unsplash.w;
  const text = ellipsize(`photo by ${creditName(artist)}`, unsplash.x - GAP - MARGIN, widthOf);
  return { artist: { text, w: widthOf(text), x: MARGIN, y: TOP, h: LINE }, unsplash };
}
