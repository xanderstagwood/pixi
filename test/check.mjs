// Run: node test/check.mjs. Smallest checks that fail if the pure logic breaks.
import assert from 'node:assert/strict';
import { crc32 as nodeCrc } from 'node:zlib';
import { brighter, glint, sequence, mix, variations, hexToRgb } from '../src/color.js';
import { extractColors } from '../src/extract.js';
import { arrange, decide, fit, shadeCost, temperatureCost, turnsOnMiddle } from '../src/arrange.js';
import { classify } from '../src/perceive.js';
import { oklabToRgb, rgbToOklab, toOklch } from '../src/oklab.js';
import * as f from '../src/export/formats.js';
import { zip } from '../src/export/zip.js';
import { createQueue } from '../src/queue.js';
import { createStore, pack, unpack } from '../src/store.js';
import { createTwinkle } from '../src/twinkle.js';
import { frames, unlessAway } from '../src/anim.js';

assert.equal(mix('#000000', '#FFFFFF', 0.5), '#808080');

// Five variations, base first: a darker one, a lighter one, and hue nudged 8 degrees either way.
const v = variations('#D04A2A');
const lch = v.map((h) => toOklch(rgbToOklab(hexToRgb(h))));
assert.equal(v.length, 5);
assert.equal(v[0], '#D04A2A');
assert.ok(lch[1].L < lch[0].L && lch[2].L > lch[0].L);
assert.ok(Math.abs(lch[3].h - lch[0].h + 8) < 1.5 && Math.abs(lch[4].h - lch[0].h - 8) < 1.5);

// A light hit is the same color, brighter: hue kept, chroma not lost, and a smaller step on a dark color than on a mid one.
const lchOf = (h) => toOklch(rgbToOklab(hexToRgb(h)));
for (const base of ['#A61520', '#333867', '#FC6D34', '#8FB8C9']) {
  const a = lchOf(base), b = lchOf(brighter(base));
  assert.ok(b.L > a.L, `${base} gets lighter`);
  assert.ok(Math.abs(b.h - a.h) < 4, `${base} keeps its hue`);
  assert.ok(b.C >= a.C * 0.95, `${base} keeps its chroma`);
}
assert.ok(lchOf(brighter('#1B1A19')).L - lchOf('#1B1A19').L < lchOf(brighter('#A61520')).L - lchOf('#A61520').L, 'near-black gets a smaller step');

// A glint is that same lift, scaled by how lit it is: nothing at 0, a steady climb in lightness, hue and chroma kept, even in a flare.
{
  const base = { r: 0xA6, g: 0x15, b: 0x20 };
  assert.deepEqual(glint(base.r, base.g, base.b, 0), base);
  const hex = (c) => '#' + [c.r, c.g, c.b].map((n) => n.toString(16).padStart(2, '0')).join('');
  const Ls = [0.4, 1, 1.6].map((amount) => lchOf(hex(glint(base.r, base.g, base.b, amount))));
  const from = lchOf(hex(base));
  assert.ok(from.L < Ls[0].L && Ls[0].L < Ls[1].L && Ls[1].L < Ls[2].L, 'lighter as it is lit harder');
  assert.ok(Ls.every((l) => Math.abs(l.h - from.h) < 4 && l.C >= from.C * 0.9), 'hue and chroma survive');
}

// A predetermined run of colors: right length, only the given colors, none twice in a row.
const run = sequence(['#111111', '#222222', '#333333', '#444444', '#555555'], 17);
assert.equal(run.length, 17);
assert.ok(run.every((c) => ['#111111', '#222222', '#333333', '#444444', '#555555'].includes(c)));
assert.ok(run.every((c, i) => i === 0 || c !== run[i - 1]));

// Two flat halves extract to their own colors, at a coordinate inside their half.
const w = 20, h = 10, data = new Uint8ClampedArray(w * h * 4);
for (let i = 0; i < w * h; i++) data.set(i % w < 10 ? [255, 0, 0, 255] : [0, 0, 255, 255], i * 4);
const got = extractColors({ data, width: w, height: h }, 2);
assert.deepEqual(got.map((c) => c.hex).sort().map((h) => classify(h).temperature), ['cool', 'warm']);
assert.ok(got.find((c) => c.hex === '#FF0000').x < 0.5 && got.find((c) => c.hex === '#0000FF').x > 0.5);

// OKLab round-trips a color.
const back = oklabToRgb(rgbToOklab({ r: 200, g: 30, b: 90 }));
assert.deepEqual([back.r, back.g, back.b].map(Math.round), [200, 30, 90]);

// An eye's verdicts: orange is warm and blue is cool; a pale yellow is light and a navy is dark.
assert.equal(classify('#FF5A1F').temperature, 'warm');
assert.equal(classify('#2E5AAC').temperature, 'cool');
assert.equal(classify('#F5E6A0').lightness, 'light');
assert.equal(classify('#101830').lightness, 'dark');
assert.equal(classify('#8A8A8A').temperature, 'neutral');
assert.ok(classify('#948A82').warmth > classify('#82888F').warmth, 'a warm gray reads warmer than a cool gray');

// Pattern costs: a fit costs clearly less than the reverse, and a plain slope is not a peak.
const cheaper = (fit, wrong) => wrong - fit > 0.1; // the smoothness part is the same either way, so compare the gap
assert.ok(cheaper(temperatureCost([0.9, 0.5, 0.1, -0.3, -0.8], 'warm-to-cool'), temperatureCost([0.9, 0.5, 0.1, -0.3, -0.8], 'cool-to-warm')));
assert.ok(cheaper(shadeCost([0.1, 0.3, 0.5, 0.7, 0.9], 'dark-to-light'), shadeCost([0.1, 0.3, 0.5, 0.7, 0.9], 'light-to-dark')));
assert.ok(cheaper(shadeCost([0.2, 0.5, 0.9, 0.5, 0.2], 'dark-light-dark'), shadeCost([0.2, 0.5, 0.9, 0.5, 0.2], 'light-dark-light')));
assert.ok(cheaper(shadeCost([0.9, 0.5, 0.2, 0.5, 0.9], 'light-dark-light'), shadeCost([0.9, 0.5, 0.2, 0.5, 0.9], 'dark-light-dark')));
assert.ok(shadeCost([0.1, 0.3, 0.5, 0.7, 0.9], 'dark-light-dark') > shadeCost([0.1, 0.3, 0.5, 0.7, 0.9], 'dark-to-light'), 'a plain slope is not a peak');
// Arranging: every palette gets both patterns, every color placed once, and the order fits what it says.
const palette = ['#E8552B', '#F2B540', '#2E6FA5', '#1F3A5F', '#8FB8C9', '#B85C38', '#3E2A2A'];
for (const roll of [0, 0.5, 0.99]) {
  const plan = arrange(palette, () => roll);
  assert.deepEqual([...plan.order].sort(), [0, 1, 2, 3, 4, 5, 6]);
  assert.ok(['warm-to-cool', 'cool-to-warm'].includes(plan.temperature));
  assert.ok(['dark-to-light', 'light-to-dark', 'dark-light-dark', 'light-dark-light'].includes(plan.shade));
  const seen = plan.order.map((i) => classify(palette[i]));
  const half = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const w = seen.map((c) => c.warmth);
  const lead = half(w.slice(0, 3)) - half(w.slice(-3)); // the top of the stack minus the bottom
  assert.ok(plan.temperature === 'warm-to-cool' ? lead > 0 : lead < 0, 'the order runs the way its temperature pattern says');
}
// A real palette that lurched: near-black then a lighter indigo at the bottom. Level on temperature, so the
// gentler gradient wins: the indigo goes above the black.
const lurching = ['#FC6D34', '#FA3535', '#A61520', '#7D1525', '#5A1832', '#111521', '#333867'];
for (const roll of [0, 0.3, 0.6, 0.99]) {
  const plan = arrange(lurching, () => roll);
  if (plan.temperature !== 'warm-to-cool') continue;
  const rows = plan.order.map((i) => lurching[i]);
  assert.ok(rows.indexOf('#333867') < rows.indexOf('#111521'), `indigo should sit above near-black: ${rows.join(' ')}`);
}
// A pattern that turns turns on the middle chip: a peak at the second chip costs more than the same run peaking mid-way.
assert.ok(shadeCost([0.3, 0.9, 0.7, 0.5, 0.4, 0.3, 0.2], 'dark-light-dark') > shadeCost([0.2, 0.4, 0.6, 0.9, 0.6, 0.4, 0.2], 'dark-light-dark') + 0.1);
assert.ok(shadeCost([0.8, 0.1, 0.3, 0.5, 0.6, 0.7, 0.8], 'light-dark-light') > shadeCost([0.8, 0.6, 0.4, 0.1, 0.4, 0.6, 0.8], 'light-dark-light') + 0.1);
// Whatever the palette, whenever the pattern turns the middle chip is the lightest (or darkest) of the seven.
let seed = 12345;
const rand01 = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const randomHex = () => '#' + [0, 1, 2].map(() => Math.floor(rand01() * 256).toString(16).padStart(2, '0')).join('');
let turned = 0;
for (let trial = 0; trial < 150; trial++) {
  const colors = Array.from({ length: 7 }, randomHex);
  const plan = arrange(colors, rand01);
  if (!turnsOnMiddle(plan.shade)) continue;
  turned++;
  const shades = plan.order.map((i) => classify(colors[i]).shade);
  const middle = shades[3];
  assert.ok(plan.shade === 'dark-light-dark' ? middle === Math.max(...shades) : middle === Math.min(...shades), `${plan.shade}: chip 4 must be the extreme, got ${shades.map((v) => v.toFixed(2))}`);
}
assert.ok(turned > 5, 'turning patterns are still chosen sometimes');
// Fitting: swaps at most two colors and never makes the fit worse.
const dull = ['#2A2622', '#3A332E', '#4A423A', '#5A5046', '#6A5E52', '#7A6C5E', '#8A7A6A'].map((hex) => ({ hex }));
const pool = [...dull, { hex: '#E8DCC8' }, { hex: '#0F0D0B' }, { hex: '#C9B99E' }, { hex: '#171310' }];
for (const shade of ['dark-light-dark', 'light-dark-light']) {
  const before = arrange(dull.map((c) => c.hex), () => 0);
  const plan = { ...before, temperature: 'warm-to-cool', shade };
  const out = fit(dull, pool, plan);
  assert.ok(out.colors.filter((c, i) => c.hex !== dull[i].hex).length <= 2);
  assert.ok(out.arrangement.cost <= fit(dull, [], plan).arrangement.cost + 1e-9, 'fitting never makes it worse');
}
// The choice of candidate keeps the count and stays in range.
const cands = palette.map((h) => [h, h, h]);
const kept = decide(cands, arrange(palette, () => 0));
assert.equal(kept.length, 7);
assert.ok(kept.every((c) => c >= 0 && c < 3));

// A small vivid patch is not lost among a large dull field, and a gradient spreads across its range.
const field = new Uint8ClampedArray(40 * 40 * 4);
for (let i = 0; i < 1600; i++) field.set(i % 40 > 36 && i < 160 ? [220, 30, 40, 255] : [120 + (i % 9), 118 + (i % 7), 112 + (i % 8), 255], i * 4);
for (let run = 0; run < 20; run++) {
  assert.ok(extractColors({ data: field, width: 40, height: 40 }, 3).some((c) => classify(c.hex).temperature === 'warm' && classify(c.hex).C > 0.15));
}
const ramp = new Uint8ClampedArray(60 * 10 * 4);
for (let i = 0; i < 600; i++) { const v = Math.round(((i % 60) / 59) * 255); ramp.set([v, v, v, 255], i * 4); }
for (let run = 0; run < 20; run++) {
  const spread = extractColors({ data: ramp, width: 60, height: 10 }, 5).map((c) => classify(c.hex).L);
  assert.ok(Math.max(...spread) - Math.min(...spread) > 0.5);
}

// Binary format headers and sizes.
const cols = ['#0000FF', '#808080', '#FF7F00'];
assert.equal(new TextDecoder().decode(f.ase(cols).slice(0, 4)), 'ASEF');
assert.equal(f.act(cols).length, 772);
assert.equal(f.aco(cols).length, 4 + 3 * 10 + 4 + 3 * (10 + 4 + 14));
assert.match(f.pal(cols), /^JASC-PAL\r\n0100\r\n3\r\n/);

// Zip: end record counts entries, each entry's stored CRC matches its bytes.
const blob = zip([{ name: 'a/x.txt', data: new TextEncoder().encode('hello') }, { name: 'b.bin', data: f.act(cols) }]);
const z = new Uint8Array(await blob.arrayBuffer());
const dv = new DataView(z.buffer);
assert.equal(dv.getUint16(z.length - 22 + 10, true), 2);
assert.equal(dv.getUint32(14, true), nodeCrc(new TextEncoder().encode('hello')));

// Queue: one at a time, in arrival order, late additions join the end, a failure does not stop the rest.
const seen = [];
let active = 0, most = 0;
const q = createQueue(async (x, left) => {
  active++; most = Math.max(most, active);
  await new Promise((r) => setTimeout(r, 5));
  seen.push(`${x}:${left}`);
  active--;
  if (x === 'b') throw new Error('boom');
}, { onError: () => {}, onIdle: () => { idled++; } });
let idled = 0;
q.add('a', 'b');
q.add('c');
await new Promise((r) => setTimeout(r, 100));
assert.deepEqual(seen, ['a:1', 'b:1', 'c:0']);
assert.equal(most, 1);
assert.equal(idled, 1);

// Cards kept between visits: the grid survives a round trip, bad data is skipped, a full browser keeps the newest.
const rgba = Uint8ClampedArray.from({ length: 6 * 4 }, (_, i) => (i % 4 === 3 ? 255 : (i * 37) % 256));
assert.deepEqual([...unpack(pack(rgba), 6)], [...rgba]);
assert.equal(unpack(pack(rgba), 5), null, 'the wrong number of cells is refused');
const fake = (limit = Infinity) => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { if (v.length > limit) throw new Error('quota'); m.set(k, v); } }; };
const card = (name) => ({ name, colors: ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777'], createdAt: 5, grid: { cols: 3, rows: 2, cx: 1, cy: 1, rgb: rgba } });
const box = fake();
createStore(box).save([card('one'), card('two')]);
const restored = createStore(box).load();
assert.deepEqual(restored.map((p) => p.name), ['one', 'two']);
assert.deepEqual([...restored[0].grid.rgb], [...rgba]);
const sample = fake();
createStore(sample).save([card('ok')]);
const good = JSON.parse(sample.getItem('pixi.palettes.v1'))[0];
box.setItem('pixi.palettes.v1', JSON.stringify([{ name: 5 }, good, { ...good, colors: ['nope'] }, { ...good, grid: { ...good.grid, cols: 99 } }]));
assert.deepEqual(createStore(box).load().map((p) => p.name), ['ok']);
box.setItem('pixi.palettes.v1', '{not json');
assert.deepEqual(createStore(box).load(), []);
const one = sample.getItem('pixi.palettes.v1').length; // one stored card
const tight = fake(one + 5); // room for one, not two
createStore(tight).save([card('a'), card('b'), card('c')]);
assert.deepEqual(createStore(tight).load().map((p) => p.name), ['c'], 'too much to keep: the newest wins');
assert.deepEqual(createStore(null).load(), [], 'no storage, nothing kept, nothing thrown');
createStore(null).save([card('x')]);

// Twinkle: cells light and come back to plain, and halting clears all.
globalThis.requestAnimationFrame ??= (cb) => setTimeout(() => cb(performance.now()), 4);
globalThis.cancelAnimationFrame ??= clearTimeout;
{
  const lit = new Map(), amounts = [];
  const twinkle = createTwinkle({
    rate: () => 400,
    life: [40, 80],
    pick: () => Math.floor(Math.random() * 6),
    paint: (id, amount) => { amounts.push(amount); if (amount > 0) lit.set(id, amount); else lit.delete(id); },
  });
  twinkle.start();
  await new Promise((r) => setTimeout(r, 300));
  twinkle.stop();
  await new Promise((r) => setTimeout(r, 250));
  assert.equal(lit.size, 0, 'every lit cell has faded back to plain once spawning stops');
  assert.ok(amounts.some((a) => a > 0.5) && amounts.every((a) => a >= 0 && a <= 1.6), 'amounts run from 0 up to a glint, or a flare');
  twinkle.start();
  await new Promise((r) => setTimeout(r, 120));
  twinkle.halt();
  assert.equal(lit.size, 0, 'halting puts every cell back at once');
}

// A hidden tab: waits on motion settle the moment it is left, and at once if it already is, and a frame loop stops for good.
{
  const listeners = [];
  globalThis.document = { hidden: false, addEventListener: (_, f) => listeners.push(f) };
  let ticks = 0;
  const loop = frames(() => { ticks++; return false; });
  const waiting = unlessAway(new Promise(() => {}));
  let settled = false;
  waiting.then(() => { settled = true; });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(settled, false, 'still waiting while the tab is shown');
  assert.ok(ticks > 0, 'frames run while the tab is shown');
  document.hidden = true;
  listeners.forEach((f) => f());
  await Promise.all([waiting, loop]);
  const seen = ticks;
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(ticks, seen, 'a cut-short frame loop does not wake up again');
  await unlessAway(new Promise(() => {}));
  delete globalThis.document;
}

console.log('ok');
import './01-palette.mjs';
import './02-new-card.mjs';
import './03-paste.mjs';
import './04-plant.mjs';
import './05-dark.mjs';
