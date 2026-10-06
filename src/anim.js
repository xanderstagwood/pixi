// GSAP's power3.inOut, as a CSS curve, so WAAPI and hand-rolled loops share one feel.
export const EASE = 'cubic-bezier(0.645, 0.045, 0.355, 1)';
export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

const leaving = new Set(); // what is waiting on motion, to be let go if the show is given up
let watching = false;
let stalled = false; // frames have stopped coming though the tab is not hidden: its window is on another workspace, say
let hold = 0; // while a show is watched: until when an away tab is still waited for, so the show can resume on its return
let skipping = false; // the show is given up: every wait on motion settles at once
let onBack = null; // what to do when the tab or its frames come back

const holding = () => performance.now() < hold;
const give = () => { skipping = true; [...leaving].forEach((stop) => stop()); };
function watch() {
  if (watching) return;
  watching = true;
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (!holding()) leaving.forEach((stop) => stop()); } else onBack?.(); });
}

/** Whether the show was given up, so whatever waited on it should make sure its end result is in place. */
export const skipped = () => skipping;

/**
 * Watches a show that has until `deadline` (a performance.now() time). A tab that is away, hidden or with its frames
 * stopped (a window on another workspace gets none, and says nothing), is waited for until then, so the show picks up
 * where it was when the user returns, catching up on its own clock; at the deadline, or on a return with under
 * `minLeft` ms to go, it is given up: every wait on motion settles at once and the work runs to its end without the show.
 * A busy main thread delays frames too, so a late timer is forgiven. Call the function it returns when the show is over.
 */
export function watchFrames(deadline, minLeft) {
  const STALL_MS = 1000;
  let last = performance.now(), beat = last, live = true;
  hold = deadline;
  skipping = false;
  onBack = () => { if (deadline - performance.now() < minLeft) give(); };
  const frame = () => { last = performance.now(); if (stalled) { stalled = false; onBack(); } if (live) raf = requestAnimationFrame(frame); };
  let raf = requestAnimationFrame(frame);
  const timer = setInterval(() => {
    const now = performance.now(), late = now - beat > 2500;
    beat = now;
    if (late) { last = now; return; }
    if (!stalled && now - last > STALL_MS) { stalled = true; if (!holding()) leaving.forEach((stop) => stop()); }
  }, 250);
  const due = setTimeout(() => { if (document.hidden || stalled) give(); }, Math.max(0, deadline - performance.now()));
  return () => { live = false; stalled = false; hold = 0; skipping = false; onBack = null; cancelAnimationFrame(raf); clearInterval(timer); clearTimeout(due); };
}

/**
 * Settles with `promise`, or with nothing as soon as the tab is away (at once if it already is), unless a show is
 * waiting for it to return (see watchFrames). A background tab draws no frames, so its animations never finish and its
 * timers crawl: whatever waits on motion waits on this instead.
 */
export const unlessAway = (promise) => new Promise((done, fail) => {
  if (skipping || ((document.hidden || stalled) && !holding())) { promise.catch(() => {}); return done(); }
  watch();
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
