import { rand, resume, skipped, sleep, unlessAway, watchFrames } from './anim.js';
import { hexToRgb, sequence } from './color.js';
import { numbered } from './credit.js';
import { buildPalette } from './palette.js';
import { imagesFrom } from './paste.js';
import { categoryFor, direction, resist, springBack } from './gesture.js';
import { loadColorNames, nameColors } from './colorname.js';
import { loadPalNames, namePalette } from './palname.js';
import { createPicker, loadPhotos } from './photos.js';
import { createQueue } from './queue.js';
import { CHIPS, cardCells, cardPng, chipAt, layout, paintTwinkle, renderCard, tagAt, twinkleCells } from './card.js';
import { clickIntent, createCarousel } from './carousel.js';
import { holdButton } from './hold.js';
import { center, unit, watchPixelSnap } from './pixel.js';
import { createStage } from './stage.js';
import { createStack } from './stack.js';
import { createStore } from './store.js';
import { createTag } from './tag.js';
import { createTwinkle } from './twinkle.js';
import { triage } from './triage.js';
import { createVoice } from './voice.js';
import { attachReorder } from './reorder.js';
import { runScanners } from './scanners.js';
import { attachSwipe } from './swipe.js';
import { buildZip } from './export/bundle.js';
import { VERSION } from './version.js';

const $ = (id) => document.getElementById(id);
const track = $('track');

// Every duration in ms. The shrink is stage.js MORPH_MS, matched by the track transition in CSS.
const T = {
  ripple: 2000, lockGap: 100, hold: 1200,
  stagger: 140, roam: [7000, 10500], hits: [12, 16], // hits sets the length of the scan; roam is only the safety cap
  chargeToBurst: 1200,
};
// About how long an analysis takes with its show. The card is made by then whether the show was seen or not, so being
// away saves no time; someone who comes back before then gets the show from where it would have got to, sped up to end on time.
const SHOW_MS = 13000; // measured: ripple 2 s, scan 7-9 s, lock and hold about 2 s, shrink 0.6 s
const MIN_WAIT = 1500; // the clock starts before the stage opens, so a larger value left only a second or two of the show to come back in; someone who comes back with less than this left gets the card now, with the chips filled in
const MAX_SIDE = 2048; // the working copy of a huge image never exceeds this
// Limits on what is accepted at all, so five huge files cannot strain a phone or a small laptop.
const MAX_BYTES = 25 * 1024 * 1024; // per file, so at most 225MB in a batch
const MAX_PIXELS = 64e6; // 8000 x 8000

const app = { status: 'IDLE' };
const voice = createVoice();
const WORKING = ['EXPANDING', 'ANALYZING', 'SHRINKING']; // the statuses she narrates
const SAY_EVERY = 3400; // ms between the things she says while the colors are chosen: two or three fit the scan
const LINGER = 2800; // ms the last thing she said stays up once the work is done, so it can be read
const REST_EVERY = [60000, 120000]; // when she is resting her line changes on the scale of a minute
let phase = ''; // what Pixi says while a phase runs, chosen once per phase so it does not flicker
let remark = ''; // what it says about a drop it turned away, for a few seconds
let resting = ''; // what she is doing when she is not at work
let lingering = false; // the work is done and its last line is still hanging there
let hush = 0, restTimer = 0, sayings = [];
const working = () => WORKING.includes(app.status);
const tag = createTag($('voice'), () => remark || (working() || lingering ? phase : resting), working);
const rest = () => {
  lingering = false;
  resting = voice.line('REST');
  tag.refresh();
  restTimer = setTimeout(rest, rand(...REST_EVERY));
};
const setStatus = (s) => {
  const wasWorking = working();
  app.status = s;
  document.body.dataset.status = s;
  sayings.forEach(clearTimeout);
  if (WORKING.includes(s)) {
    clearTimeout(restTimer);
    restTimer = 0;
    lingering = false;
    phase = voice.line(s);
    // A long phase gets a few remarks, one after another, not one for all of it.
    sayings = Array.from({ length: voice.count(s) - 1 }, (_, i) => setTimeout(() => { phase = voice.line(s); tag.refresh(); }, (i + 1) * SAY_EVERY));
  } else if (wasWorking) {
    lingering = true; // let the last thing she said hang there, then she rests
    restTimer = setTimeout(rest, LINGER);
  } else if (!restTimer) {
    restTimer = setTimeout(rest, 1200); // the first rest, soon after the page opens
  }
  tag.refresh();
};
const say = (event, name = '') => {
  remark = voice.line(event).replace('{name}', name);
  tag.refresh();
  clearTimeout(hush);
  hush = setTimeout(() => { remark = ''; tag.refresh(); }, 3500);
};
const idle = () => app.status === 'IDLE' || app.status === 'CAROUSEL';

// The analysis in flight, if any: what a change of viewport has to lay out again.
let session = null;

const carousel = createCarousel(track, () => repaint());

// Cards are kept in the browser between visits (store.js); localStorage can throw where storage is blocked.
let storage = null;
try { storage = window.localStorage; } catch { /* no storage: cards last only this visit */ }
const store = createStore(storage);
const persist = () => store.save([...track.querySelectorAll('.card.palette')].map((c) => c.palette));
let saveSoon = 0; // typing a name saves once it pauses, not on every key
const persistSoon = () => { clearTimeout(saveSoon); saveSoon = setTimeout(persist, 400); };
const stage = createStage($('stage'), $('stage').querySelector('canvas'));

/** Decodes the file into a working canvas capped at MAX_SIDE; the original is let go at once. */
async function load(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    // Size is known once the header is read; check it before paying to decode a huge picture.
    await new Promise((done, fail) => { img.onload = done; img.onerror = fail; });
    if (img.naturalWidth * img.naturalHeight > MAX_PIXELS) throw Object.assign(new Error('image too large'), { reason: 'too-big' });
    await unlessAway(img.decode()); // a hidden tab never finishes decoding ahead of time (nor one that is left meanwhile); drawing the image below decodes it anyway
  } finally { URL.revokeObjectURL(url); }
  const s = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const work = Object.assign(document.createElement('canvas'), {
    width: Math.max(1, Math.round(img.naturalWidth * s)),
    height: Math.max(1, Math.round(img.naturalHeight * s)),
  });
  work.getContext('2d').drawImage(img, 0, 0, work.width, work.height);
  img.src = '';
  return work;
}

/** The working canvas shrunk to at most 400px on its long side, as ImageData. */
function sample(work, max = 400) {
  const s = Math.min(1, max / Math.max(work.width, work.height));
  const w = Math.max(1, Math.round(work.width * s)), h = Math.max(1, Math.round(work.height * s));
  const g = Object.assign(document.createElement('canvas'), { width: w, height: h }).getContext('2d', { willReadFrequently: true });
  g.drawImage(work, 0, 0, w, h);
  return g.getImageData(0, 0, w, h);
}

const paintCard = (card) => {
  const ink = renderCard(card.querySelector('canvas'), card.palette, unit().n, { ui: true, dim: !card.classList.contains('focus') });
  card.style.setProperty('--caret', ink); // the caret in the name field is the name's own ink
};

/** Sets the CSS that positions things inside the card. */
function applyLayout() {
  const L = layout(), root = document.documentElement.style;
  for (const [name, v] of Object.entries({ cw: L.w, ch: L.h, kw: L.chips.w, sx: L.chips.x, sy: L.chips.y, nx: L.name.x, ny: L.name.y, nw: L.name.w })) {
    root.setProperty(`--${name}`, v);
  }
}

/** The card's window, centered in the viewport, in CSS px. */
function cardRect() {
  const { css } = unit(), L = layout(), c = center();
  const w = L.w * css, h = L.h * css;
  return new DOMRect(c.x - w / 2, c.y - h / 2, w, h);
}

/** The names the cards have now. */
const cardNames = () => [...track.querySelectorAll('.card.palette')].map((c) => c.palette.name);

/** What a fresh card is called: a name made from its colors (numbered if a card already has it), or if the word lists never came, the first 16 characters of the file's name without its extension. `made` says which. */
function defaultName(file, colors) {
  const made = namePalette(colors);
  return made ? { name: numbered(made, cardNames()), made: true } : { name: file.name.replace(/\.[^.]*$/, '').trim().slice(0, 16), made: false };
}

/** @param {boolean} last no more images are waiting, so the name field may take focus */
async function analyze(file, last) {
  const deadline = performance.now() + SHOW_MS;
  const unwatch = watchFrames(deadline); // a tab that is away is waited for, up to the show's time
  try { await analyzeOne(file, last, deadline); } finally { unwatch(); }
}

async function analyzeOne(file, last, deadline) {
  if (!idle()) return;
  // Cancel and skip abort `signal`. Every wait below goes through `until`, so an abort lands at once
  // wherever the run has got to, and the catch below fades the screen away without making a card.
  session = { scan: null, abort: new AbortController(), locked: false };
  const { signal } = session.abort;
  const until = (p) => {
    signal.throwIfAborted();
    return Promise.race([p, new Promise((_, fail) => signal.addEventListener('abort', () => fail(signal.reason), { once: true }))]);
  };
  let work, named = ''; // `named`: what the card was called, if Pixi made the name
  try { await until(fontReady); work = await until(load(file)); } catch (e) { session = null; if (!signal.aborted) say(e.reason ?? 'unreadable'); return; }
  const pixels = sample(work);
  const plan = buildPalette(pixels, Math.random, CHIPS);
  if (!plan) { session = null; say('empty'); return; }
  const { clusters, candidates, keep, slotOf } = plan;

  try {
    carousel.focus(Infinity, true);
    setStatus('EXPANDING');
    lizardAgain(); // behind the analysis screen, the photo button gets its lizard back
    const bloxels = await until(stage.open(work, cardRect(), cardCells, clusters.map((c, i) => ({ hex: candidates[i][keep[i]], x: c.x, y: c.y }))));

    work.width = work.height = 0; // the source pixels are spent: the bloxel grid holds all that is kept

    // The show: the blocks grow, drones hunt the colors, the chips land and lock. It keeps its place (`seen`), so a show
    // cut short when the user was away is picked up where they last saw it, and what they saw is not played again.
    // `f` is how much of its time each part takes.
    const names = nameColors(plan.colors); // each chip's name, which replaces its hex as the chips lock
    const seen = { wave: 0, landed: new Set(), locked: false, held: false };
    const rgbOf = (hex) => Object.values(hexToRgb(hex));
    const targets = clusters.map((c) => ({ rgb: rgbOf(c.hex) }));
    const runs = candidates.map((c) => sequence(c, T.hits[1] + 2)); // the colors each drone hunts, in order, and how far along it is
    const taken = clusters.map(() => 0);
    let stack = null, scan = null;
    const play = async (f) => {
      setStatus('ANALYZING');
      if (seen.wave !== Infinity) {
        if (seen.wave > 0) bloxels.rewind(seen.wave);
        seen.wave = await until(bloxels.ripple(T.ripple * f, signal, seen.wave));
        if (seen.wave === Infinity && !stillMotion()) bloxels.twinkle.start(); // once the blocks are grown, a few catch the light
      }
      if (!stack) {
        stack = createStack(CHIPS);
        $('stack-host').replaceChildren(stack.el);
        stack.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 * f, easing: 'steps(5)' });
      }
      // What each chip will show is decided before anything moves, and the drone that hunts it goes to
      // the bloxel closest to that color: it comes to rest there, and only then does the chip shift.
      // When it parks, the chip lands on the kept color. A drone whose chip already landed is not sent again.
      const hunting = clusters.map((_, i) => i).filter((i) => !seen.landed.has(i));
      if (hunting.length) {
        const hits = T.hits.map((h) => Math.max(3, Math.round(h * f)));
        const landing = [];
        scan = runScanners($('scanners'), bloxels, hunting.map((i) => targets[i]), {
          next: (k) => { const hex = runs[hunting[k]][taken[hunting[k]]++]; return { hex, rgb: rgbOf(hex) }; },
          onStop: (k, hex) => { stack.swapTo(slotOf[hunting[k]], hex); },
          onFinish: (k) => { const i = hunting[k]; seen.landed.add(i); landing.push(stack.swapTo(slotOf[i], candidates[i][keep[i]])); },
        }, { ...T, stagger: T.stagger * f, roam: T.roam.map((v) => v * f), hits, signal });
        session.scan = scan;
        await until(scan.finished);
        await until(Promise.all(landing));
      }
      if (seen.landed.size < clusters.length) { scan?.clear(); return; } // cut short before every chip landed
      bloxels.twinkle.stop(); // the lit ones fade out well before the window closes
      if (!seen.locked) {
        await until(Promise.all(clusters.map((_, slot) => sleep(slot * T.lockGap * f).then(() => stack.lock(slot, names[slot])))));
        seen.locked = !skipped();
      }
      if (!seen.held) {
        await until(sleep(T.hold * f));
        seen.held = !skipped();
      }
      scan?.clear();
    };
    await play(1);

    const palette = { ...defaultName(file, plan.colors), colors: plan.colors, coordinates: plan.coordinates, grid: bloxels.keep(), copied: -1, createdAt: Date.now(), credit: file.credit };
    if (palette.made) named = palette.name;
    session.locked = true; // the card is made from here on: too late to cancel
    const card = carousel.insert(palette);
    wire(card);
    paintCard(card);
    if (skipped()) persist(); // the user was away and may never see it: the card is kept now
    while (skipped()) { // the show was cut short, by the user's return or by the time running out
      const left = deadline - performance.now();
      if (left < MIN_WAIT) break; // out of time: the card is made now
      // What is left of the show, in its own time, squeezed to end when the show would have: picked up from where it would be.
      const remaining = (seen.wave === Infinity ? 0 : T.ripple) + ((clusters.length - seen.landed.size) / clusters.length) * 8000 + (seen.locked ? 0 : 700) + (seen.held ? 0 : T.hold);
      resume();
      await play(Math.min(1, Math.max(0.25, left / Math.max(1, remaining))));
    }
    if (skipped() && stack) clusters.forEach((_, i) => stack.swapTo(slotOf[i], candidates[i][keep[i]], names[slotOf[i]])); // cut short for good: the chips still show what was kept
    setStatus('SHRINKING');
    await stage.close(cardRect);
    // The window has closed onto the card exactly, and the card is the same blocks and chips in
    // the same device pixels, so it takes over in the very frame the stage goes: no fade.
    card.style.visibility = '';
    stage.hide();
    $('stack-host').replaceChildren();
    persist();
    syncTwinkle();
    // Not on touch (it would raise the keyboard), and not mid-batch (the next image is already coming).
    if (last && matchMedia('(pointer: fine)').matches) card.querySelector('.name').focus({ preventScroll: true });
  } catch (err) {
    if (signal.aborted) await fadeAway();
    else { console.error(err); stage.hide(); }
  }
  stage.release();
  session = null;
  work.width = work.height = 0;
  setStatus('CAROUSEL');
  if (named && last) say('NAMED', named); // not mid-batch: the next picture is already on its way
}

/** Fades the analysis screen out to the card UI behind it, with nothing left over. */
async function fadeAway() {
  stage.halt();
  const fades = ['stage-frame', 'stack-host', 'scanners'].map((id) => $(id).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'steps(4)', fill: 'forwards' }));
  await unlessAway(Promise.all(fades.map((a) => a.finished)));
  stage.hide();
  $('stack-host').replaceChildren();
  $('scanners').replaceChildren();
  fades.forEach((a) => a.cancel());
}

/* ---- finished cards ---- */

const fileBase = (p) => p.name.trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'palette';

function save(blob, name) {
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

const exportPng = async (p) => save(await cardPng(p), `${fileBase(p)}.png`);
const exportZip = async (p) => save(await buildZip({ name: fileBase(p), colors: p.colors }, await cardPng(p)), `${fileBase(p)}.zip`);

/** A ring of red squares flies out of the button, and its icon steps back in. */
function burst(button) {
  const { dpr, css } = unit();
  const snap = (v) => Math.round(v * dpr) / dpr;
  const r = button.getBoundingClientRect();
  const x = snap(r.left + r.width / 2 - 2 * css), y = snap(r.top + r.height / 2 - 2 * css);
  const count = 14;
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2 + rand(-0.2, 0.2), d = Math.round(rand(24, 72)) * css;
    const spark = Object.assign(document.createElement('div'), { className: 'spark' });
    document.body.append(spark);
    spark.animate([
      { transform: `translate(${x}px, ${y}px)`, opacity: 1 },
      { transform: `translate(${snap(x + Math.cos(a) * d)}px, ${snap(y + Math.sin(a) * d)}px)`, opacity: 0 },
    ], { duration: 520, easing: 'steps(6)' }).finished.then(() => spark.remove());
  }
  button.querySelector('.icon').animate([{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }], { duration: 1400, easing: 'steps(8)' });
}

function wire(card) {
  const p = card.palette, name = card.querySelector('.name'), dl = card.querySelector('.dl');
  name.value = p.name;
  card.querySelector('.rm').addEventListener('click', () => dismiss(card, 'Y'));
  name.addEventListener('input', () => { p.name = name.value; p.made = false; paintCard(card); persistSoon(); });
  // A name Pixi made is rolled again by a double click, while nobody has typed over it.
  name.addEventListener('dblclick', () => {
    if (!p.made) return;
    const made = namePalette(p.colors);
    if (!made) return;
    p.name = numbered(made, cardNames().filter((n) => n !== p.name));
    name.value = p.name;
    name.setSelectionRange(name.value.length, name.value.length);
    paintCard(card);
    persistSoon();
  });
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); });
  holdButton(dl, {
    ms: T.chargeToBurst,
    onTap: () => exportPng(p),
    onCharge: (v) => {
      dl.classList.toggle('charging', v > 0);
      dl.style.setProperty('--charge', v);
      dl.style.setProperty('--shake', v > 0 ? Math.round((Math.random() - 0.5) * 4 * v) : 0); // whole font pixels
    },
    onBurst: () => {
      dl.classList.remove('charging');
      dl.style.setProperty('--charge', 0);
      dl.style.setProperty('--shake', 0);
      burst(dl);
      exportZip(p);
    },
  });
}

function copyChip(card, e) {
  const { css } = unit(), p = card.palette;
  const href = tagAt(p, e.offsetX / css, e.offsetY / css);
  if (href) { window.open(href, '_blank', 'noopener'); return; }
  const k = chipAt(e.offsetX / css, e.offsetY / css, p.colors.length);
  if (k < 0) return;
  navigator.clipboard?.writeText(p.colors[k]);
  p.copied = k;
  paintCard(card);
  setTimeout(() => { p.copied = -1; paintCard(card); }, 700);
}

/* ---- input ---- */

// Images dropped or chosen together are analysed one after another, in the order given, up to
// MAX_BATCH in one go. The corner tag counts them: this one of how many.
const MAX_BATCH = 9;
let batchTotal = 0, batchDone = 0;
const counter = $('counter');
const showCount = () => {
  const total = batchTotal + waiting; // photos still to come count too
  counter.hidden = total === 0;
  $('count').textContent = `${Math.min(batchDone + 1, total)}/${total}`;
  $('skip').hidden = total - batchDone < 2; // on the last image, skipping is cancelling
};
const batch = createQueue(async (file, left) => {
  showCount();
  try { await analyze(file, left === 0); } finally { batchDone++; showCount(); }
}, { pause: () => sleep(500), onIdle: () => { batchTotal = batchDone = 0; showCount(); lizardAgain(); } });
// Cancel drops the whole batch, skip only the image in progress; neither leaves a card. Once the card
// is being made (`locked`) there is nothing to cancel, and the buttons are hidden by CSS.
const skip = () => { if (!session?.locked) session?.abort.abort(); };
$('skip').addEventListener('click', skip);
$('cancel').addEventListener('click', () => { cancelPicks(); batch.clear(); skip(); });
const addImages = (files) => {
  const { take, refused } = triage(files, { room: Math.max(0, MAX_BATCH - batchTotal), maxBytes: MAX_BYTES });
  if (refused.length) say(refused[0]);
  if (!take.length) return;
  batchTotal += take.length;
  showCount();
  batch.add(...take);
};

/* ---- photos: the button under "new", and the sets it chooses from ---- */

// A photo comes down as a file, like one dropped, with who to credit riding along.
let picker = null; // one list and one picker for every pick, however many come at once
const photoPicker = () => (picker ??= loadPhotos().then(createPicker).catch((err) => { picker = null; throw err; }));
async function photoFile(category) {
  const photo = (await photoPicker())(category);
  const response = await fetch(photo.url);
  if (!response.ok) throw new Error(`photo ${photo.id}: ${response.status}`);
  const blob = await response.blob();
  const credit = { artist: photo.artist, artistLink: photo.artistLink, link: photo.link };
  return Object.assign(new File([blob], `${photo.id}.jpg`, { type: blob.type || 'image/jpeg' }), { category, credit });
}
/** The photo for a pick, with one more try (another photo) if the first will not come; null if neither does. */
async function photoOf(category) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await photoFile(category); } catch (err) { console.error(err); }
  }
  return null;
}

// Picks wait a moment before any photo is fetched, and each new pick restarts the wait, so there is time to queue
// up more; the counter tag is up from the first pick. `waiting` counts the picks whose photo is not in the queue yet.
const PAUSE = 1500;
let queued = [], waiting = 0, settle = null, epoch = 0;
const cooking = () => { photoButton.classList.toggle('cooking', waiting > 0); showCount(); }; // the icon pulses while photos are on their way
function pickPhoto(category) {
  if (batchTotal + waiting >= MAX_BATCH) { say('too-many'); return false; }
  queued.push(category);
  waiting++;
  cooking();
  clearTimeout(settle);
  settle = setTimeout(sendPicks, PAUSE);
  return true;
}
async function sendPicks() {
  const categories = queued.splice(0), mine = epoch;
  const files = await Promise.all(categories.map(photoOf));
  if (mine !== epoch) return; // cancelled while the photos were coming
  waiting -= categories.length;
  const got = files.filter(Boolean);
  if (got.length < categories.length) say('no-photo');
  cooking();
  if (got.length) addImages(got); else lizardAgain();
}
function cancelPicks() {
  clearTimeout(settle);
  queued = [];
  waiting = 0;
  epoch++;
  cooking();
  lizardAgain();
}

const photoButton = carousel.add.querySelector('.add-photo'), photoIcon = photoButton.querySelector('.icon');
const showIcon = (name) => { photoIcon.className = `icon icon--${name}`; };
const nudge = (x, y) => { const { css } = unit(); photoIcon.style.transform = x || y ? `translate(${x * css}px, ${y * css}px)` : ''; };
const fades = new Set(); // the opacity animations in flight, kept apart from the spring so ending one never cuts the other
const fade = (from, to, ms) => {
  const a = photoIcon.animate([{ opacity: from }, { opacity: to }], { duration: ms, easing: 'steps(4)', fill: 'forwards' });
  fades.add(a);
  return unlessAway(a.finished.catch(() => {}));
};

let swaps = 0;
/** The icon fades out, turns into `name` and fades in; a newer swap cuts this one short. Resolves true if it was not cut short. */
async function swapIcon(name, force = false) {
  const run = ++swaps;
  const same = photoIcon.classList.contains(`icon--${name}`);
  if (same && !force) { await fade(getComputedStyle(photoIcon).opacity, 1, 100); return run === swaps; }
  if (!stillMotion()) await fade(1, 0, 150);
  if (run !== swaps) return false;
  showIcon(name);
  if (!stillMotion()) await fade(0, 1, 150);
  if (run !== swaps) return false;
  fades.forEach((a) => a.cancel());
  fades.clear();
  return true;
}
/** A choice is made: the pick is queued at once and the icon turns into the set's own, and stays so until the work has begun. */
async function choose(category, shown = false) {
  if (!pickPhoto(category)) return;
  if (!shown) await swapIcon(category, true);
}
/** The lizard comes back, at once and unseen, when the analysis screen is up or the picks have come to nothing; not while more are waiting. */
function lizardAgain() {
  if (waiting || queued.length) return;
  swaps++; // cuts short any swap in flight
  fades.forEach((a) => a.cancel());
  fades.clear();
  showIcon('lizard');
}

photoButton.addEventListener('click', (e) => choose(categoryFor({ button: 0, alt: e.altKey })));
photoButton.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }); // no autoscroll circle
photoButton.addEventListener('auxclick', (e) => { if (e.button === 1) choose(categoryFor({ button: 1, alt: e.altKey })); });
photoButton.addEventListener('contextmenu', (e) => { // a long-press on touch is not a right click: the drag is how a phone chooses
  e.preventDefault();
  if (!touching) choose(categoryFor({ button: 2, alt: e.altKey }));
});

// Dragging the button picks by direction on release. The icon follows the pointer nearly to the edge of its half of the
// card, fades into the set's own icon once it has gone far enough, and springs back to the middle when let go.
photoButton.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.altKey) return;
  const x0 = e.clientX, y0 = e.clientY, { css } = unit();
  const room = photoButton.getBoundingClientRect(), size = photoIcon.getBoundingClientRect();
  const limit = { x: (room.width - size.width) / 2 / css - 4, y: (room.height - size.height) / 2 / css - 4 }; // font pixels
  let dragging = false, done = false, category = null, shown = { x: 0, y: 0 };
  photoButton.setPointerCapture(e.pointerId);
  const move = (ev) => {
    const dx = (ev.clientX - x0) / css, dy = (ev.clientY - y0) / css;
    if (!dragging && Math.hypot(dx, dy) < 10) return; // under this it is a click
    dragging = true;
    shown = { x: Math.round(resist(dx, limit.x)), y: Math.round(resist(dy, limit.y)) };
    nudge(shown.x, shown.y);
    const next = direction(dx, dy);
    if (next !== category) { category = next; swapIcon(next ?? 'lizard'); }
  };
  // Letting go ends the drag wherever the pointer is, even outside the button or the window, and however it ends.
  const up = async (ev) => {
    if (done) return;
    done = true;
    for (const type of ['pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) photoButton.removeEventListener(type, type === 'pointermove' ? move : up);
    if (!dragging) return;
    const swallow = (c) => c.stopPropagation(); // the release is not a click
    addEventListener('click', swallow, true);
    setTimeout(() => removeEventListener('click', swallow, true), 100);
    const chosen = ev.type === 'pointerup' ? category : null;
    if (chosen) choose(chosen, true); // queued now; the spring plays while the icon holds
    else swapIcon('lizard');
    if (stillMotion()) { nudge(0, 0); return; }
    const frames = springBack(shown).map((f) => ({ transform: `translate(${f.x * css}px, ${f.y * css}px)` }));
    try { await unlessAway(photoIcon.animate(frames, { duration: 700, easing: 'linear' }).finished); } catch { /* cut short */ }
    nudge(0, 0); // whatever happened to the spring, the icon ends in the middle
  };
  photoButton.addEventListener('pointermove', move);
  photoButton.addEventListener('pointerup', up);
  photoButton.addEventListener('pointercancel', up);
  photoButton.addEventListener('lostpointercapture', up);
});

const go = (i) => { if (idle()) carousel.focus(i); };
function dismiss(card, axis) { if (idle()) carousel.remove(card, axis).then(persist); }
// A narrow screen stacks the cards top to bottom; a wide one lays them out left to right.
const narrow = matchMedia('(max-width: 640px)');
const vertical = () => narrow.matches;
const applyAxis = () => document.body.classList.toggle('vertical', vertical());
narrow.addEventListener('change', applyAxis);
applyAxis();

attachReorder(track, { canDrag: idle, vertical, onReorder: (from, to) => { carousel.move(from, to); persist(); } });
attachSwipe(track, { canSwipe: idle, vertical, index: () => carousel.index, onSettle: go, onDismiss: dismiss });

// The wheel steps through the cards: a notch is a card, and a trackpad's small deltas add up to one.
let wheelSum = 0, wheelLast = 0, wheelStep = 0;
addEventListener('wheel', (e) => {
  if (!idle() || e.target.closest?.('input')) return;
  e.preventDefault();
  const now = performance.now();
  const d = vertical() || Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
  wheelSum = now - wheelLast > 200 ? d : wheelSum + d;
  wheelLast = now;
  if (Math.abs(wheelSum) < 60 || now - wheelStep < 220) return;
  go(carousel.index + Math.sign(wheelSum));
  wheelSum = 0;
  wheelStep = now;
}, { passive: false });

// A long-press on touch would open the browser's image menu; a mouse right-click still gets it, to save the card.
let touching = false;
addEventListener('pointerdown', (e) => { touching = e.pointerType !== 'mouse'; }, true);
addEventListener('contextmenu', (e) => { if (touching) e.preventDefault(); });

track.addEventListener('click', (e) => {
  if (!idle() || e.target.closest('.dl, .rm, .name, .add-photo')) return;
  const card = e.target.closest('.card');
  if (!card) return;
  const i = [...track.children].indexOf(card);
  const intent = clickIntent({ isAdd: card === carousel.add, isFocused: i === carousel.index, onCanvas: !!e.target.closest('canvas') });
  if (intent === 'new') $('file').click();
  else if (intent === 'focus') go(i);
  else if (intent === 'copy') copyChip(card, e);
});

// The credit tags are links: the pointer says so over them.
track.addEventListener('pointermove', (e) => {
  const canvas = e.target.closest?.('.card.focus canvas');
  if (canvas) canvas.style.cursor = tagAt(canvas.closest('.card').palette, e.offsetX / unit().css, e.offsetY / unit().css) ? 'pointer' : '';
});

addEventListener('keydown', (e) => {
  if (e.target.matches?.('input')) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(carousel.index - 1);
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(carousel.index + 1);
});

$('file').addEventListener('change', (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  addImages(files);
});

addEventListener('dragover', (e) => e.preventDefault());
addEventListener('dragenter', () => document.body.classList.add('dragging'));
addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('dragging'); });
addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('dragging');
  addImages([...e.dataTransfer.files]);
});

// Only a paste that carries images is taken over, so pasting text into the name field still works.
addEventListener('paste', (e) => {
  const images = imagesFrom(e.clipboardData);
  if (!images.length) return;
  e.preventDefault();
  addImages(images);
});

const repaint = () => { document.querySelectorAll('.card.palette').forEach(paintCard); syncTwinkle(); };

// The focused card shimmers: now and then one of its blocks brightens and eases back, on a layer over the card.
// Anything else that changes what is focused, or how big things are, comes through repaint, which restarts it.
const stillMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const shimmers = new Map(); // card -> its twinkle
function syncTwinkle() {
  for (const t of shimmers.values()) t.halt();
  shimmers.clear();
  const card = carousel.focused;
  if (stillMotion() || !card?.palette || card.style.visibility === 'hidden') return;
  const base = card.querySelector('canvas'), overlay = card.querySelector('.twinkle');
  overlay.width = base.width;
  overlay.height = base.height;
  const ctx = overlay.getContext('2d'), blocks = twinkleCells(card.palette), s = unit().n;
  if (!blocks.length) return;
  const t = createTwinkle({
    rate: () => blocks.length / 27, // a lively scatter at a time, about one block in twenty lit
    pick: () => Math.floor(Math.random() * blocks.length),
    paint: (i, amount) => paintTwinkle(ctx, blocks[i], s, amount),
  });
  t.start();
  shimmers.set(card, t);
}
watchPixelSnap(() => {
  applyLayout();
  repaint();
  if (session) { // the viewport changed mid-analysis: re-lay the grid, then the drones onto it
    stage.relayout();
    session.scan?.refit();
  }
});
// Canvas text falls back to a plain font if it is drawn before the pixel font arrives, so
// wait for the font before analysing, and redraw the cards whenever a font finishes loading.
// The chips and the palettes are named too, but word lists that fail to load only leave the chips showing their hex and
// the palettes named after their files.
const fontReady = Promise.all([document.fonts.load('16px "Stagwood Sprite 64"'), loadColorNames().catch(() => {}), loadPalNames().catch(() => {})]);
// Cards from earlier visits come back once the pixel font is ready to draw their text.
fontReady.then(() => {
  const kept = store.load();
  for (const palette of kept) {
    const card = carousel.insert(palette);
    wire(card);
    paintCard(card);
    card.style.visibility = '';
  }
  if (kept.length) { carousel.focus(carousel.index, true); setStatus('CAROUSEL'); syncTwinkle(); }
});
document.fonts.addEventListener('loadingdone', repaint);
// Buttons rather than links: the browser's status bubble for a hovered link would cover this corner.
document.querySelectorAll('#version [data-url]').forEach((b) => b.addEventListener('click', () => window.open(b.dataset.url, '_blank', 'noopener')));
const kofi = document.querySelector('.tag-btn--heart');
const KOFI_SEEN = 'pixi.kofi-seen';
try { if (!localStorage.getItem(KOFI_SEEN)) kofi.classList.add('nudge'); } catch { kofi.classList.add('nudge'); } // storage unavailable: it keeps pulsing
kofi.addEventListener('click', () => {
  kofi.classList.remove('nudge');
  try { localStorage.setItem(KOFI_SEEN, '1'); } catch { /* unavailable: the pulse returns next visit */ }
});
$('version-label').textContent = `Pixi v${VERSION}`;
document.title = `Pixi v${VERSION} (ALPHA)`;
setStatus('IDLE');
