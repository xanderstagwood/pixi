// GSAP's power3.inOut, as a CSS curve, so WAAPI and hand-rolled loops share one feel.
export const EASE = 'cubic-bezier(0.645, 0.045, 0.355, 1)';
export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

const leaving = new Set(); // what is waiting on the tab being left
let watching = false;
let stalled = false; // frames have stopped coming though the tab is not hidden: its window is on another workspace, say

/** Whether the show cannot be seen right now: the tab is hidden, or its frames have stopped. */
export const away = () => document.hidden || stalled;

/**
 * Notices frames stopping while the tab is not hidden (a window on another workspace gets none, and says nothing),
 * and then lets go of everything waiting on motion, as a hidden tab does. Call it for as long as motion is awaited;
 * call the function it returns when done. A busy main thread delays frames too, so a late timer is forgiven.
 */
export function watchFrames() {
  const STALL_MS = 1000;
  let last = performance.now(), beat = last, live = true;
  const frame = () => { last = performance.now(); stalled = false; if (live) raf = requestAnimationFrame(frame); };
  let raf = requestAnimationFrame(frame);
  const timer = setInterval(() => {
    const now = performance.now(), late = now - beat > 2500;
    beat = now;
    if (late) { last = now; return; }
    if (!stalled && now - last > STALL_MS) { stalled = true; [...leaving].forEach((stop) => stop()); }
  }, 250);
  return () => { live = false; stalled = false; cancelAnimationFrame(raf); clearInterval(timer); };
}

/**
 * Settles with `promise`, or with nothing as soon as the tab is hidden (at once if it already is). A
 * background tab draws no frames, so its animations never finish and its timers crawl: whatever waits on
 * motion waits on this instead, and a hidden tab runs the work without the show.
 */
export const unlessAway = (promise) => new Promise((done, fail) => {
  if (document.hidden || stalled) { promise.catch(() => {}); return done(); }
  if (!watching) {
    watching = true;
    document.addEventListener('visibilitychange', () => { if (document.hidden) leaving.forEach((stop) => stop()); });
  }
  leaving.add(done);
  promise.then(done, fail).finally(() => leaving.delete(done));
});

export const sleep = (ms) => unlessAway(new Promise((done) => setTimeout(done, ms)));
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = randInt(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

/** Calls fn(elapsedMs, now) each frame until it returns true. Resolves when done, or when the tab is left; rejects if `signal` aborts. */
export const frames = (fn, signal) => {
  let raf = 0, live = true;
  const run = new Promise((done, fail) => {
    const t0 = performance.now();
    const tick = (now) => { if (live) { if (fn(now - t0, now) === true) done(); else raf = requestAnimationFrame(tick); } };
    raf = requestAnimationFrame(tick);
    signal?.addEventListener('abort', () => fail(signal.reason), { once: true });
  });
  // Cut short by a hidden tab, the loop must not wake up later and draw over whatever came next.
  return unlessAway(run).finally(() => { live = false; cancelAnimationFrame(raf); });
};

/**
 * Slides an element out of view from wherever it is (a drag may have moved it), up for axis 'Y' and left
 * for 'X'; `done` runs on the frame it is gone, before the animation lets go.
 */
export async function slideOut(el, done, axis = 'Y', ms = 360) {
  const a = el.animate({ transform: `translate${axis}(${axis === 'Y' ? '-100vh' : '-100vw'})` }, { duration: ms, easing: EASE, fill: 'forwards' });
  await unlessAway(a.finished);
  done();
  a.cancel();
}
