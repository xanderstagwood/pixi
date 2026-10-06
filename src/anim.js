// GSAP's power3.inOut, as a CSS curve, so WAAPI and hand-rolled loops share one feel.
export const EASE = 'cubic-bezier(0.645, 0.045, 0.355, 1)';
export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

const leaving = new Set(); // what is waiting on motion, to be let go if the show is cut short
let watching = false;
let stalled = false; // frames have stopped coming though the tab is not hidden: its window is on another workspace, say
let hold = 0; // while a show is watched: until when an away tab is still waited for, so the show can resume on its return
let showing = false; // a show is being watched
let skipping = false; // the show was cut short: every wait on motion settles at once
const coming = new Set(); // what is waiting on the tab coming back

const holding = () => performance.now() < hold;
const cut = () => { if (showing) skipping = true; };
const give = () => { cut(); [...leaving].forEach((stop) => stop()); };
const welcome = () => { [...coming].forEach((done) => done()); coming.clear(); };
function watch() {
  if (watching) return;
  watching = true;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (!holding()) give(); } else if (!stalled) welcome();
  });
}

/** Whether the show was cut short, so that whoever ran it knows to play it again for someone who comes back. */
export const skipped = () => skipping;

/** Starts a cut-short show over: its waits are waited for again. */
export const resume = () => { skipping = false; };

/** Whether the show cannot be seen right now: the tab is hidden, or its frames have stopped. */
export const away = () => document.hidden || stalled;

/** Resolves when the show can be seen again: at once if it can be now, else when the tab is shown or frames resume. */
export const returned = () => new Promise((done) => {
  if (!away()) return done();
  watch();
  coming.add(done);
});

/**
 * Watches a show that has until `deadline` (a performance.now() time). A tab that is away, hidden or with its frames
 * stopped (a window on another workspace gets none, and says nothing), is waited for until then, so the show picks up
 * where it was when the user returns, catching up on its own clock. At the deadline the show is cut short: every wait
 * on motion settles at once and the work runs to its end without it (see `skipped`). A busy main thread delays frames
 * too, so a late timer is forgiven. Call the function it returns when the show is over.
 */
export function watchFrames(deadline) {
  const STALL_MS = 1000;
  let last = performance.now(), beat = last, live = true;
  hold = deadline;
  showing = true;
  skipping = false;
  const frame = () => { last = performance.now(); if (stalled) { stalled = false; welcome(); } if (live) raf = requestAnimationFrame(frame); };
  let raf = requestAnimationFrame(frame);
  const timer = setInterval(() => {
    const now = performance.now(), late = now - beat > 2500;
    beat = now;
    if (late) { last = now; return; }
    if (!stalled && now - last > STALL_MS) { stalled = true; if (!holding()) give(); }
  }, 250);
  const due = setTimeout(() => { if (away()) give(); }, Math.max(0, deadline - performance.now()));
  return () => { live = false; stalled = false; hold = 0; showing = false; skipping = false; cancelAnimationFrame(raf); clearInterval(timer); clearTimeout(due); welcome(); };
}

/**
 * Settles with `promise`, or with nothing as soon as the tab is away (at once if it already is), unless a show is
 * waiting for it to return (see watchFrames). A background tab draws no frames, so its animations never finish and its
 * timers crawl: whatever waits on motion waits on this instead.
 */
export const unlessAway = (promise) => new Promise((done, fail) => {
  if (skipping || ((document.hidden || stalled) && !holding())) { cut(); promise.catch(() => {}); return done(); }
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
