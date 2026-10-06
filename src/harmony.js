import { hexToRgb, rgbToHex } from './color.js';
import { deltaE, oklchToRgb, rgbToOklab, toOklch } from './oklab.js';

// A little nudging so a palette's chips flow together, as a grade over a photograph does. The chips the palette is
// built around (the hero, the accent, the dark and light anchors) are never touched; the rest lean toward the
// palette's own hue and neutrals take a faint tint of it.
const TURN = 10; // degrees of hue a chip may be turned, at most
const PULL = 0.5; // share of the way toward the palette's hue a chip is turned
const REACH = 60; // a hue farther than this from the palette's is another family, and is left alone
const TINT = 0.015; // chroma a neutral is given: enough to feel the palette's hue, not enough to see a color
const CHROMATIC = 0.04; // below this a chip is a neutral
const MIN_APART = 0.06; // a nudge never leaves two chips closer than this (or closer than they were)

const lab = (hex) => rgbToOklab(hexToRgb(hex));
const lch = (hex) => toOklch(lab(hex));

/**
 * @param {{hex: string, role: string}[]} chips the palette; `role` is '' for a chip free to be nudged
 * @returns {string[]} the hex of each chip, nudged
 */
export function harmonize(chips) {
  const seen = chips.map((c) => lch(c.hex));
  let x = 0, y = 0;
  chips.forEach((c, i) => {
    if (c.role === 'accent' || seen[i].C < CHROMATIC) return; // the accent is there to stand out from the palette, so it cannot set its hue
    x += seen[i].C * Math.cos((seen[i].h * Math.PI) / 180);
    y += seen[i].C * Math.sin((seen[i].h * Math.PI) / 180);
  });
  const out = chips.map((c) => c.hex);
  if (!x && !y) return out;
  const base = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

  chips.forEach((c, i) => {
    if (c.role) return;
    const o = seen[i];
    const toward = ((base - o.h + 540) % 360) - 180; // signed, the short way round
    let next;
    if (o.C < CHROMATIC) next = { L: o.L, C: Math.max(o.C, TINT), h: base };
    else if (Math.abs(toward) <= REACH) next = { L: o.L, C: o.C, h: (o.h + Math.max(-TURN, Math.min(TURN, toward * PULL)) + 360) % 360 };
    else return;
    const hex = rgbToHex(oklchToRgb(next));
    const others = out.filter((_, k) => k !== i).map(lab);
    const nearest = (l) => Math.min(...others.map((m) => deltaE(l, m)));
    if (nearest(lab(hex)) >= Math.min(nearest(lab(c.hex)), MIN_APART)) out[i] = hex;
  });
  return out;
}
