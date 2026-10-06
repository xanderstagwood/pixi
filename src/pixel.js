// The whole UI is drawn on a grid of "font pixels": one pixel of the Stagwood Sprite 64
// font, which is 1/16 of its size. That font is only crisp at a whole multiple of 16
// device pixels (see sprite/src/pixel-snap.js), so one font pixel is a whole number `n` of
// device pixels, as many as let the card fit the screen. Every length in style.css is a
// multiple of --px, so every edge lands on a device pixel whatever the display's ratio.
const CARD_W = 320 + 32; // the card in font pixels, and room beside it
const CARD_H = 480 + 160; // and above and below it, where its buttons hang

/**
 * The card is always the same size in font pixels; what a screen decides is how many device pixels one font pixel
 * gets: the largest whole number at which the card still fits, never fewer than one.
 * @param {number} width the viewport's width in device pixels
 * @param {number} height and its height
 * @returns {number} device px per font pixel
 */
export const scaleFor = (width, height) => Math.max(1, Math.floor(Math.min(width / CARD_W, height / CARD_H)));

/** dpr: device px per CSS px; n: device px per font pixel; css: CSS px per font pixel. */
export function unit() {
  const dpr = window.devicePixelRatio || 1;
  const root = document.documentElement;
  const n = scaleFor(root.clientWidth * dpr, root.clientHeight * dpr);
  return { dpr, n, css: n / dpr };
}

/** Viewport centre in device pixels: whole, since half of an odd width is a half pixel. */
export function centerDev() {
  const { dpr } = unit();
  const root = document.documentElement;
  return { x: Math.round((root.clientWidth * dpr) / 2), y: Math.round((root.clientHeight * dpr) / 2) };
}

/** The same centre in CSS px. */
export function center() {
  const { dpr } = unit();
  const c = centerDev();
  return { x: c.x / dpr, y: c.y / dpr };
}

function apply() {
  const root = document.documentElement;
  const c = center();
  root.style.setProperty('--px', `${unit().css}px`);
  root.style.setProperty('--cx', `${c.x}px`);
  root.style.setProperty('--cy', `${c.y}px`);
}

/** Applies the snap now and again on resize, browser zoom or a move between monitors. */
export function watchPixelSnap(onChange = () => {}) {
  const run = () => { apply(); onChange(); };
  run();
  addEventListener('resize', run);
  const listen = () =>
    matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener('change', () => { run(); listen(); }, { once: true });
  listen();
}
