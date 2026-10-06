import { fadeText, slideWidth } from './tag-motion.js';

/**
 * Pixi's voice tag, in the top right corner: says what Pixi is up to, or why it turned a drop away. The text
 * fades on a change and the tag eases to its new width, and its icon pulses while Pixi is at work. With
 * nothing to say it is not there at all.
 * @param {HTMLElement} el the tag, holding an `.icon` and a `.tag-label`
 * @param {() => string} doing what to say now, '' for nothing
 * @param {() => boolean} busy whether Pixi is at work (read after `doing`)
 * @returns {{refresh(): void}} `refresh` re-reads `doing()`; call it whenever what is said may have changed
 */
export function createTag(el, doing, busy) {
  const label = el.querySelector('.tag-label');
  const set = fadeText(label, 120, slideWidth(el)); // 120ms matches the opacity transition on .tag-label
  return {
    refresh() {
      const text = doing();
      el.hidden = !text;
      set(text); // an empty text goes through the fade too, so a fade still pending cannot write old words into a hidden tag
      el.classList.toggle('pulsing', busy());
    },
  };
}
