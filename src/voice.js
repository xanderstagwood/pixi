/**
 * Pixi's voice: what it says while it works and when a drop is turned away. A pixie, tricky and playful,
 * a little snarky, and never explaining how anything is done: magic, not machinery.
 */
export const LINES = {
  EXPANDING: ['pulling back the curtain', 'unrolling the picture', 'having a peek'],
  ANALYZING: ['whispering to the colors', 'counting what glitters', 'bribing the colors'],
  SHRINKING: ['tucking it in', 'folding it up small', 'sealing it with a wink'],
  'not-image': ["that's not a picture", 'pixi only eats pictures', 'nice try, that is paperwork'],
  'too-big': ["that one's enormous", "my pockets aren't that big", 'too much picture, trim it'],
  unreadable: ["can't open that one", 'that file is playing dead', "that picture won't talk to me"],
  'too-many': ['nine at a time, greedy', 'easy, i only have two hands', 'pace yourself, nine is plenty'],
  empty: ['nothing in there, i looked', 'an invisible picture, bold', 'transparent. very funny'],
};

export const EVENTS = Object.keys(LINES);

/**
 * @param {() => number} random picks the line, so a seed repeats what is said
 * @returns {{line(event: string): string}} `line` is one of the event's lines, never the one it said last time for that event; '' for an unknown event
 */
export function createVoice(random = Math.random) {
  const last = {};
  return {
    line(event) {
      const lines = LINES[event];
      if (!lines) return '';
      const choices = lines.filter((l) => l !== last[event]);
      return (last[event] = choices[Math.floor(random() * choices.length)]);
    },
  };
}
