// choose: which seven of a picture's twelve colors make the palette. Contrast, cohesion or variety, a surprise
// accent, and no tricks visible: where a user can check the answer by eye, the answer is exact.
import assert from 'node:assert/strict';
import { hexToRgb, rgbToHex } from '../src/color.js';
import { extractColors } from '../src/extract.js';
import { deltaE, oklchToRgb, rgbToOklab, toOklch } from '../src/oklab.js';
import { buildPalette } from '../src/palette.js';
import { PLENTIFUL, choose, richness } from '../src/chooser.js';
import { clear, flat, mulberry32, patches } from './img.mjs';

const lab = (hex) => rgbToOklab(hexToRgb(hex));
const lch = (hex) => toOklch(lab(hex));
const hex = (L, C, h) => rgbToHex(oklchToRgb({ L, C, h }));
const entry = (h, share) => ({ hex: h, x: 0.5, y: 0.5, share });
const hexes = (picks) => picks.map((p) => p.hex);
const count = (list, h) => list.filter((x) => x === h).length;
const hueGap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const minGap = (list) => Math.min(...list.flatMap((a, i) => list.slice(i + 1).map((b) => deltaE(lab(a), lab(b)))));
const seeds = (n) => Array.from({ length: n }, (_, i) => mulberry32(i + 1));

// A dragonfly on a dark ground: reds, browns, grays, and a 0.6% splash of green.
const DRAGONFLY = [
  ['#0F1210', 0.45], ['#1C1F1E', 0.12], ['#5A5A60', 0.10], ['#8A8790', 0.06], ['#B9B6BD', 0.03], ['#B3340F', 0.07],
  ['#E0501A', 0.04], ['#8A3408', 0.05], ['#522410', 0.04], ['#6B4A32', 0.03], ['#A66A3C', 0.016],
].map(([h, s]) => entry(h, s));
const GREEN = '#4EA02A';
const withGreen = [...DRAGONFLY, entry(GREEN, 0.006)];
// The dragonfly's real twelve (400px sample): eight grays, a few small reds, one small green.
const REAL_DRAGONFLY = [
  ['#0F1415', 0.644], ['#28312C', 0.08], ['#616268', 0.066], ['#464C4E', 0.066], ['#7C757E', 0.061], ['#432312', 0.025],
  ['#80310F', 0.016], ['#9E9297', 0.016], ['#7E584A', 0.009], ['#BC3A0C', 0.006], ['#527126', 0.006], ['#B36031', 0.005],
].map(([h, s]) => entry(h, s));
const RAINBOW = Array.from({ length: 12 }, (_, i) => entry(hex(i % 2 ? 0.75 : 0.55, 0.14, i * 30), 1 / 12));
const GRAYS = Array.from({ length: 12 }, (_, i) => entry(hex(0.2 + i * 0.065, 0, 0), 1 / 12));

// Exact where it can be checked: one color, two colors, few colors.
{
  const flatPool = Array.from({ length: 12 }, () => entry('#FFFFFF', 1 / 12));
  const { picks, mode } = choose(flatPool, 7, mulberry32(1));
  assert.equal(picks.length, 7, 'a flat picture still gets seven chips');
  assert.deepEqual(hexes(picks), Array(7).fill('#FFFFFF'), 'seven pure whites for a pure white picture');
  assert.equal(mode, 'exact', 'a flat picture is answered exactly');
}
{
  const nearFlat = ['#FFFFFF', '#FEFEFE', '#FDFDFD', '#FEFEFE', '#FFFFFF', '#FDFDFD'].map((h, i) => entry(h, i === 0 ? 0.5 : 0.1));
  const { picks } = choose(nearFlat, 7, mulberry32(1));
  assert.equal(new Set(hexes(picks)).size, 1, 'differences nobody can see count as one color');
  assert.ok(nearFlat.some((e) => e.hex === picks[0].hex), 'and the color is the picture\'s own');
}
{
  const two = [entry('#000000', 0.7), entry('#FFFFFF', 0.3)];
  const { picks } = choose(two, 7, mulberry32(1));
  assert.equal(count(hexes(picks), '#000000'), 5, 'a 70% color gets five of seven chips');
  assert.equal(count(hexes(picks), '#FFFFFF'), 2, 'a 30% color gets two');
}
{
  const few = [entry('#CC2222', 0.4), entry('#2244CC', 0.3), entry('#22CC44', 0.15), entry('#EEDD22', 0.1), entry('#772299', 0.05)];
  const { picks } = choose(few, 7, mulberry32(1));
  assert.equal(picks.length, 7, 'five colors fill seven chips');
  assert.deepEqual([...new Set(hexes(picks))].sort(), few.map((e) => e.hex).sort(), 'every color of the picture is there and nothing else');
  assert.ok(count(hexes(picks), '#CC2222') >= count(hexes(picks), '#772299'), 'the bigger area never gets fewer chips');
}

// Pure black and white: only when the picture really is that.
{
  const base = RAINBOW.slice(0, 10).map((e) => ({ ...e, share: 0.01 }));
  const lowShare = choose([...base, entry('#000000', 0.04), entry('#FFFFFF', 0.04)], 7, mulberry32(1));
  assert.ok(!hexes(lowShare.picks).includes('#000000') && !hexes(lowShare.picks).includes('#FFFFFF'), 'a speck of pure black or white is never a chip');
  const mostlyBlack = choose([...base, entry('#000000', 0.85), entry('#FFFFFF', 0.01)], 7, mulberry32(1));
  assert.ok(hexes(mostlyBlack.picks).includes('#000000'), 'a picture that is mostly pure black gets black');
  assert.ok(!hexes(mostlyBlack.picks).includes('#FFFFFF'), 'but its single white speck still is not a chip');
}

// The accent: a small vivid color far from the rest, only when it is earned.
for (const rng of seeds(20)) {
  const { picks, roles } = choose(withGreen, 7, rng);
  assert.ok(hexes(picks).includes(GREEN), 'the splash of green is a chip every time');
  assert.equal(roles[hexes(picks).indexOf(GREEN)], 'accent', 'and it is marked as the accent');
}
// The real dragonfly is 93% gray and dark: color is a sliver, and the red family is still not the accent.
const DARK_DRAGONFLY = [
  ['#0F1210', 0.60], ['#1C1F1E', 0.15], ['#5A5A60', 0.10], ['#8A8790', 0.06], ['#B9B6BD', 0.03], ['#B3340F', 0.02],
  ['#E0501A', 0.01], ['#8A3408', 0.012], ['#522410', 0.01], ['#6B4A32', 0.01], ['#A66A3C', 0.004], [GREEN, 0.006],
].map(([h, s]) => entry(h, s));
for (const rng of seeds(20)) {
  const { picks, roles } = choose(DARK_DRAGONFLY, 7, rng);
  assert.equal(roles[hexes(picks).indexOf(GREEN)], 'accent', 'on a mostly gray picture the far green is still the accent, not the most vivid red');
}
assert.ok(!choose(DRAGONFLY, 7, mulberry32(1)).roles.includes('accent'), 'with no green to find, there is no accent');
assert.ok(!choose(RAINBOW, 7, mulberry32(1)).roles.includes('accent'), 'a many-hued picture needs no accent');
{
  const dot = [...GRAYS, entry('#D01818', 0.01)].slice(1);
  const { picks } = choose(dot, 7, mulberry32(1));
  assert.ok(hexes(picks).includes('#D01818'), 'one vivid dot on a gray picture is found');
}
{
  const reds = Array.from({ length: 6 }, (_, i) => entry(hex(0.35 + i * 0.07, 0.13, 350 + (i % 3) * 8), 0.15));
  const near = choose([...reds, entry(hex(0.6, 0.2, 20), 0.01), ...GRAYS.slice(0, 5)], 7, mulberry32(1));
  assert.ok(!near.roles.includes('accent'), 'a vivid color only 30 degrees away, across the wrap at 0, is not an accent');
  const far = choose([...reds, entry(hex(0.6, 0.2, 100), 0.01), ...GRAYS.slice(0, 5)], 7, mulberry32(1));
  assert.ok(far.roles.includes('accent'), 'one 110 degrees away is');
}
{
  const grays = choose(GRAYS, 7, mulberry32(1));
  assert.ok(!grays.roles.includes('accent'), 'a gray picture has no accent');
  assert.ok(hexes(grays.picks).every((h) => lch(h).C < 0.01), 'and no color is invented for it');
}

// The hero: the picture's most eye-catching color is always there, and it is not the accent.
for (const rng of seeds(20)) {
  const { picks, roles } = choose(REAL_DRAGONFLY, 7, rng);
  assert.ok(hexes(picks).includes('#BC3A0C'), 'the vivid red is a chip, every time');
  assert.equal(roles.indexOf('hero'), hexes(picks).indexOf('#BC3A0C'), 'and it is the hero');
  assert.equal(roles[hexes(picks).indexOf('#527126')], 'accent', 'with the green still the accent');
  const grays = picks.filter((p) => lch(p.hex).C < 0.04).length;
  assert.ok(grays <= 4, 'and the palette is not drowned in grays');
}
assert.ok(!choose(GRAYS, 7, mulberry32(1)).roles.includes('hero'), 'a gray picture has no hero');

// Value range: a dark and a light anchor, from what the picture holds.
{
  const { picks, roles } = choose(DRAGONFLY, 7, mulberry32(2));
  assert.ok(hexes(picks).includes('#0F1210'), 'the picture\'s darkest real color is a chip');
  assert.ok(hexes(picks).includes('#B9B6BD'), 'and its lightest is');
  assert.ok(roles.includes('dark') && roles.includes('light'), 'both are marked as anchors');
}

// Plentiful picks a family, limited spreads out, and the line between them is pinned. What is counted is hue
// families, not shades: twelve reds are one color to look at, and a rainbow is twelve.
const families = (n) => Array.from({ length: 12 }, (_, i) => entry(hex(0.35 + 0.12 * Math.floor(i / n), 0.12, (360 / n) * (i % n)), 1 / 12));
assert.equal(richness(families(PLENTIFUL)), PLENTIFUL, 'the fixture holds exactly the threshold of hue families');
assert.equal(choose(families(PLENTIFUL), 7, mulberry32(1)).mode, 'cohesive', 'at the threshold it picks a family');
assert.equal(choose(families(PLENTIFUL - 1), 7, mulberry32(1)).mode, 'varied', 'one below it spreads out');
{
  const shades = [...Array.from({ length: 11 }, (_, i) => entry(hex(0.25 + i * 0.05, 0.16, 30 + (i % 3) * 4), 0.05)), entry('#100E07', 0.4)];
  assert.ok(richness(shades) <= 2, 'eleven shades of one red and a black are two colors, not twelve');
  assert.equal(choose(shades, 7, mulberry32(1)).mode, 'varied', 'so they are spread out, not gathered');
}
{
  const crowd = [0, 90, 180, 270].flatMap((h) => [0.45, 0.48, 0.51].map((L) => entry(hex(L, 0.12, h), 1 / 12)));
  assert.equal(choose(crowd, 7, mulberry32(1)).mode, 'cohesive', 'four families gather');
  for (const rng of seeds(20)) {
    assert.ok(minGap(hexes(choose(crowd, 7, rng).picks)) >= 0.055, 'even a family keeps its chips apart, near-twins are not both chips');
  }
}
{
  const blues = Array.from({ length: 12 }, (_, i) => entry(hex(0.3 + i * 0.045, 0.08, 255 + (i % 3) * 3), 1 / 12));
  const { picks, mode } = choose(blues, 7, mulberry32(1));
  assert.equal(mode, 'varied', 'a picture of blues is limited');
  assert.ok(minGap(hexes(picks)) >= 0.03, 'its chips are all tellable apart');
}

// The road at night: black, a little olive, and eight shades of red and orange. Spread, not a crowd of reds.
const ROAD = [
  ['#010100', 0.83], ['#100E07', 0.114], ['#1E2113', 0.034], ['#FC0201', 0.006], ['#580706', 0.0037], ['#940E08', 0.0033],
  ['#D00806', 0.003], ['#FB2804', 0.0028], ['#FC4F05', 0.0016], ['#5F6C60', 0.001], ['#D14B0E', 0.0009], ['#F8AB0E', 0.0003],
].map(([h, s]) => entry(h, s));
for (const rng of seeds(20)) {
  const { picks } = choose(ROAD, 7, rng);
  assert.ok(minGap(hexes(picks)) >= 0.08, 'no two chips of the road are near-twins');
  assert.ok(picks.filter((p) => lch(p.hex).C > 0.1 && hueGap(lch(p.hex).h, 32) < 15).length <= 3, 'at most three of the seven are the same red');
  const Ls = picks.map((p) => lch(p.hex).L);
  assert.ok(Math.max(...Ls) - Math.min(...Ls) >= 0.55, 'and the seven span the range from dark to bright');
}

// A color family can only take so many of the seven when the picture offers anything else.
{
  const reds = Array.from({ length: 8 }, (_, i) => entry(hex(0.3 + i * 0.07, 0.17, 30 + (i % 3) * 3), 0.05));
  const others = [entry('#0E0E10', 0.3), entry('#2B3A2A', 0.1), entry('#7A8F78', 0.05), entry(hex(0.82, 0.14, 85), 0.05)];
  for (const rng of seeds(20)) {
    const { picks } = choose([...reds, ...others], 7, rng);
    const inFamily = picks.filter((p) => lch(p.hex).C > 0.1 && hueGap(lch(p.hex).h, 32) < 15).length;
    assert.ok(inFamily <= 3, 'eight reds and four other colors never give more than three reds');
    assert.ok(others.slice(1).every((o) => hexes(picks).includes(o.hex)), 'the other colors of the picture all get their chip');
  }
  assert.equal(choose(reds.map((r, i) => ({ ...r, hex: hex(0.3 + i * 0.07, 0.17, 30) })), 7, mulberry32(1)).picks.length, 7, 'a picture of nothing but reds still fills seven chips');
}

// The two slots the picture is built around are never near-twins: a hero that only echoes the accent is a wasted chip.
{
  const neutrals = [0.15, 0.3, 0.45, 0.6, 0.8].map((L) => entry(hex(L, 0, 0), 0.15));
  const pool = [...neutrals, entry('#FC0201', 0.02), entry('#F10A06', 0.015), entry('#6E8A5A', 0.01), entry('#5B6B80', 0.01)];
  for (const rng of seeds(20)) {
    const { picks, roles } = choose(pool, 7, rng);
    const both = ['accent', 'hero'].map((r) => picks[roles.indexOf(r)]).filter(Boolean);
    assert.ok(both.length < 2 || deltaE(lab(both[0].hex), lab(both[1].hex)) >= 0.08, 'the accent and the hero are not the same red twice');
    assert.ok(minGap(hexes(picks)) >= 0.06, 'and no two of the seven are near-twins');
  }
}

// No tricks visible: real colors only, repeatable with a seed, and unpredictable without one.
for (const pool of [withGreen, RAINBOW, GRAYS]) {
  const all = new Set(pool.map((e) => e.hex));
  assert.ok(hexes(choose(pool, 7, mulberry32(4)).picks).every((h) => all.has(h)), 'every chip is a color the picture holds');
}
assert.deepEqual(choose(RAINBOW, 7, mulberry32(9)), choose(RAINBOW, 7, mulberry32(9)), 'a seed repeats a palette');
assert.ok(new Set(seeds(20).map((r) => hexes(choose(RAINBOW, 7, r).picks).sort().join())).size >= 2, 'a rainbow does not always give the same family');

// Through the whole pipeline.
{
  const dragonfly = patches([
    { hex: '#0F1210', share: 0.55 }, { hex: '#5A5A60', share: 0.18 }, { hex: '#B3340F', share: 0.10 }, { hex: '#8A3408', share: 0.08 },
    { hex: '#E0501A', share: 0.05 }, { hex: '#522410', share: 0.034 }, { hex: GREEN, share: 0.006 },
  ]);
  for (const rng of seeds(20)) {
    const { colors } = buildPalette(dragonfly, rng);
    assert.ok(colors.some((c) => lch(c).C > 0.06 && hueGap(lch(c).h, 138) < 25), 'the dragonfly palette has its green');
  }
  const pool = extractColors(dragonfly, 12, 12, mulberry32(1));
  assert.ok(Math.abs(pool.reduce((s, c) => s + c.share, 0) - 1) < 1e-9, 'the pool\'s shares add up to the whole picture');
}
{
  // The road as a picture: fitting a shade pattern may swap two chips for colors left over, but not for more of the same red.
  const road = patches([
    { hex: '#010100', share: 0.5 }, { hex: '#100E07', share: 0.12 }, { hex: '#1E2113', share: 0.06 }, { hex: '#5F6C60', share: 0.02 },
    { hex: '#FC0201', share: 0.05 }, { hex: '#D00806', share: 0.05 }, { hex: '#940E08', share: 0.04 }, { hex: '#580706', share: 0.04 },
    { hex: '#FB2804', share: 0.03 }, { hex: '#FC4F05', share: 0.03 }, { hex: '#D14B0E', share: 0.03 }, { hex: '#F8AB0E', share: 0.02 },
  ]);
  for (const rng of seeds(40)) {
    const { colors } = buildPalette(road, rng);
    const reds = colors.filter((c) => lch(c).C > 0.1 && hueGap(lch(c).h, 32) < 15).length;
    assert.ok(reds <= 3, 'fitting a pattern never crowds the road palette with a fourth red');
  }
}
for (const h of ['#FFFFFF', '#000000', '#CC2222']) {
  assert.deepEqual(buildPalette(flat(h), mulberry32(1)).colors, Array(7).fill(h), `a flat ${h} picture gives seven exactly ${h}`);
}
{
  const bw = buildPalette(patches([{ hex: '#000000', share: 0.5 }, { hex: '#FFFFFF', share: 0.5 }]), mulberry32(1)).colors;
  assert.deepEqual([...new Set(bw)].sort(), ['#000000', '#FFFFFF'], 'a black and white picture gives black and white and nothing else');
  assert.ok(count(bw, '#000000') >= 3 && count(bw, '#FFFFFF') >= 3, 'in shares near its areas');
}
for (const [width, height] of [[1, 1], [2, 1]]) {
  const tiny = { data: new Uint8ClampedArray(width * height * 4).fill(255), width, height };
  assert.equal(buildPalette(tiny, mulberry32(1)).colors.length, 7, `a ${width}x${height} picture does not break it`);
}
assert.equal(buildPalette(clear(), mulberry32(1)), null, 'a fully transparent picture still has no palette');

console.log('ok 06-chooser');
