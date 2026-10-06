// Drag a chip up or down a card's stack to rearrange the palette, the way Sprite's tiles go (attachDragReorder in
// sprite/src/ui.js): a press becomes a drag after DRAG_THRESHOLD px, the chip dims where it is while a ghost of it
// follows the pointer, the chips between slide a row to open the gap, the slot is the one under the pointer, and release
// commits. With touch, a long-press lifts it, so a quick swipe still moves the strip (the arming of reorder.js:
// `track.dataset.reorder` makes swipe.js stand down).
const DRAG_THRESHOLD = 4;
const LONG_PRESS_MS = 350;
const SLIDE_MS = 120;
const ease = (p) => 1 - (1 - p) ** 3;

/** A copy of `list` with the item at `from` taken out and put back at `to`. */
export function moveItem(list, from, to) {
  const out = [...list];
  out.splice(to, 0, out.splice(from, 1)[0]);
  return out;
}

/**
 * The slot under the pointer: the row it is over, as a list index (the list runs bottom chip first, so the top row is
 * the last). Past either end it is the end.
 * @param {number} y font pixels from the top of the card to the pointer
 * @param {number} top where the top row starts, and `pitch` the distance from one row to the next, in the same unit
 * @param {number} count how many chips there are
 */
export const slotAt = (y, top, pitch, count) => count - 1 - Math.min(count - 1, Math.max(0, Math.floor((y - top) / pitch)));

/** How many rows down the card each chip moves while the chip at `from` is carried over slot `to` (the carried one stays, dimmed). */
export const shifts = (count, from, to) => Array.from({ length: count }, (_, i) => {
  if (from < to && i > from && i <= to) return 1;
  if (from > to && i < from && i >= to) return -1;
  return 0;
});

/**
 * @param {HTMLElement} track holds the cards
 * @param {{canDrag: () => boolean, css: () => number, hit: (card: HTMLElement, x: number, y: number) => number,
 *          rows: (card: HTMLElement) => {x: number, top: number, pitch: number, w: number, h: number, count: number},
 *          ghost: (card: HTMLElement, index: number) => HTMLElement,
 *          draw: (card: HTMLElement, from: number, offsets: number[]) => void,
 *          drop: (card: HTMLElement, from: number, to: number) => void, hold: (on: boolean) => void}} hooks
 *        `css`: CSS pixels to a font pixel; `hit`: the chip at a point on a card (x, y in font pixels), or -1;
 *        `rows`: where the stack is on the card, in font pixels; `ghost`: a picture of the chip, which follows the pointer;
 *        `draw`: shows the card with chip `from` dimmed and each chip `offsets[i]` rows from its row; `drop`: settles it
 *        (also when it went nowhere); `hold`: told while a chip is held, so the card itself is not picked up or swiped
 */
export function attachChipDrag(track, { canDrag, css, hit, rows, ghost, draw, drop, hold }) {
  track.addEventListener('pointerdown', (e) => {
    const canvas = e.target.closest?.('.card.focus canvas');
    const card = canvas?.closest('.card.palette');
    if (e.button !== 0 || !card || !canDrag()) return;
    const rect = canvas.getBoundingClientRect(), k = css(), dpr = window.devicePixelRatio || 1;
    const fromTop = (ev) => (ev.clientY - rect.top) / k;
    const from = hit(card, (e.clientX - rect.left) / k, fromTop(e));
    if (from < 0) return;

    const { x, top, pitch, w, h, count } = rows(card);
    const snap = (v) => Math.round(v * dpr) / dpr; // keep the ghost on whole device pixels
    const left0 = rect.left + x * k, top0 = rect.top + (top + (count - 1 - from) * pitch) * k;
    const touch = e.pointerType !== 'mouse';
    let armed = !touch, lifted = false, to = from, floating = null, raf = 0;
    let shown = new Array(count).fill(0), slide = null; // the rows each chip is offset by now, and the slide under way
    hold(true);
    const timer = touch ? setTimeout(() => { armed = true; track.dataset.reorder = 'armed'; navigator.vibrate?.(10); }, LONG_PRESS_MS) : 0;

    const tick = (now) => {
      const p = Math.min(1, (now - slide.t0) / SLIDE_MS);
      shown = slide.from.map((v, i) => v + (slide.to[i] - v) * ease(p));
      draw(card, from, shown);
      raf = p < 1 ? requestAnimationFrame(tick) : 0;
    };
    const slideTo = (slot) => {
      slide = { from: [...shown], to: shifts(count, from, slot), t0: performance.now() };
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const end = () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      floating?.remove();
      delete track.dataset.reorder;
      document.body.classList.remove('grabbing');
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', cancel);
      hold(false);
    };
    const move = (ev) => {
      if (!lifted) {
        const far = Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) >= DRAG_THRESHOLD;
        if (!armed) { if (far) end(); return; } // moved before the long-press: a swipe, not a pickup
        if (!far) return;
        lifted = true;
        floating = ghost(card, from);
        floating.style.cssText += `;position:fixed;margin:0;pointer-events:none;width:${w * k}px;height:${h * k}px`;
        document.body.append(floating);
        document.body.classList.add('grabbing');
        window.getSelection().removeAllRanges();
        slideTo(from);
      }
      floating.style.left = `${snap(left0 + ev.clientX - e.clientX)}px`;
      floating.style.top = `${snap(top0 + ev.clientY - e.clientY)}px`;
      const slot = slotAt(fromTop(ev), top, pitch, count);
      if (slot !== to) { to = slot; slideTo(to); }
    };
    const up = () => {
      const was = lifted;
      end();
      if (!was) return;
      drop(card, from, to);
      // The release would also be a click on the card; it was a drag.
      const swallow = (ev) => ev.stopPropagation();
      addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => removeEventListener('click', swallow, true), 100);
    };
    const cancel = () => { const was = lifted; end(); if (was) drop(card, from, from); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', cancel);
  });
}
