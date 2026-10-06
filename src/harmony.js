import { hexToRgb, rgbToHex } from './color.js';
import { TELLABLE, deltaE, oklchToRgb, rgbToOklab, toOklch } from './oklab.js';

// A little nudging so a palette's chips flow together, as a grade over a photograph does. The chips the palette is
// built around (the hero, the accent, the dark and light anchors) are never touched; the rest lean toward the
// palette's own hue and neutrals take a faint tint of it.
const TURN = 10; // degrees of hue a chip may be turned, at most, when there is no scheme to lean toward
const GRAB = 30; // a free chip this near a scheme's target hue is drawn to it by PULL of the way, so 15 degrees at the most
const PULL = 0.5; // share of the way toward the palette's hue a chip is turned
const REACH = 60; // a hue farther than this from the palette's is another family, and is left alone
const TINT = 0.015; // chroma a neutral is given: enough to feel the palette's hue, not enough to see a color
const CHROMATIC = 0.04; // below this a chip is a neutral

// Where each scheme's hues sit, as degrees from the hero's. A palette's hues are drawn toward these, so a complement is
// nearer to exactly opposite and a triad to a third of the wheel. The tonal palette and the neutral-and-pop have only the hero's own.
const SHAPES = {
  tonal: [], 'neutral-pop': [], analogous: [-30, 30], dichromatic: [-120, 120], complementary: [180],
  'split-complementary': [150, 210], triadic: [120, 240], tetradic: [60, 120, 180, 240, 300], square: [90, 180, 270],
};

const lab = (hex) => rgbToOklab(hexToRgb(hex));
const lch = (hex) => toOklch(lab(hex));

/**
 * @param {{hex: string, role: string}[]} chips the palette; `role` is '' for a chip free to be nudged
 * @param {string} [mode] the palette's scheme, which gives it target hues around the hero's
 * @returns {string[]} the hex of each chip, nudged
 */
export function harmonize(chips, mode) {
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
  const heroAt = chips.findIndex((c) => c.role === 'hero');
  const home = heroAt >= 0 ? seen[heroAt].h : base;
  const targets = SHAPES[mode] && [home, ...SHAPES[mode].map((d) => (home + d + 360) % 360)];
  const lean = (h, to) => ((to - h + 540) % 360) - 180; // signed, the short way round

  chips.forEach((c, i) => {
    if (c.role) return;
    const o = seen[i];
    const toward = lean(o.h, base);
    const aim = o.C >= CHROMATIC && targets ? targets.map((t) => lean(o.h, t)).sort((a, b) => Math.abs(a) - Math.abs(b))[0] : Infinity;
    let next;
    if (o.C < CHROMATIC) next = { L: o.L, C: Math.max(o.C, TINT), h: base };
    else if (Math.abs(aim) <= GRAB) next = { L: o.L, C: o.C, h: (o.h + aim * PULL + 360) % 360 };
    else if (Math.abs(toward) <= REACH) next = { L: o.L, C: o.C, h: (o.h + Math.max(-TURN, Math.min(TURN, toward * PULL)) + 360) % 360 };
    else return;
    const hex = rgbToHex(oklchToRgb(next));
    const others = out.filter((_, k) => k !== i).map(lab);
    const nearest = (l) => Math.min(...others.map((m) => deltaE(l, m)));
    if (nearest(lab(hex)) >= Math.min(nearest(lab(c.hex)), TELLABLE)) out[i] = hex;
  });
  return out;
}
