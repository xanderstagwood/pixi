/**
 * Pixi's voice: what it says while it works and when a drop is turned away. A pixie, tricky and playful,
 * a little snarky, and never explaining how anything is done: magic, not machinery.
 *
 * Two kinds of line. Whole phrases go out just as they are. While she works she also mixes and matches an
 * action with a subject, for whimsical nonsense, and now and then the subject is the mind goblin. When a drop is
 * turned away it is always the mind goblin. Add to any list freely;
 * keep a line short enough for the tag, and keep it magic.
 */
export const LINES = {
  EXPANDING: ['pulling back the curtain', 'unrolling the picture', 'having a peek', 'opening the secret door', 'here we go'],
  ANALYZING: ['whispering to the colors', 'counting what glitters', 'bribing the colors', 'reading the tea leaves', 'pretending to concentrate', 'this is going well'],
  SHRINKING: ['tucking it in', 'folding it up small', 'sealing it with a wink', 'one last sparkle', 'nearly there'],
  // A drop that is turned away, an error, a failure or someone trying to trick her, is always the mind goblin's doing.
  // Anyone who knows the joke knows they are being teased for their naughty behavior.
  'not-image': ['the mind goblin says no paperwork', 'the mind goblin hates paperwork', 'paperwork? the mind goblin sneers', 'nice try, the mind goblin saw that'],
  'too-big': ['the mind goblin cannot lift that', 'the mind goblin says too heavy', 'the mind goblin sat on that one', 'too big, ask the mind goblin'],
  unreadable: ['the mind goblin chewed that file', 'the mind goblin scrambled that one', 'blame the mind goblin for that', 'the mind goblin hid that file'],
  'too-many': ['the mind goblin counts to nine', 'the mind goblin says enough', 'greedy. the mind goblin noticed', 'the mind goblin is watching you'],
  empty: ['the mind goblin took the picture', 'the mind goblin ate everything', 'the mind goblin stole all of it', 'the mind goblin left nothing'],
};

/** What she is doing, for the phases that mix and match: each action reads straight into a subject. */
export const MIXES = {
  EXPANDING: ['unrolling', 'unfolding', 'peeking at', 'waking up', 'sneaking up on', 'tiptoeing past', 'waving at'],
  ANALYZING: ['whispering to', 'bribing', 'tickling', 'counting', 'sweet-talking', 'arguing with', 'winking at', 'squinting at', 'distracted by', 'chasing', 'serenading'],
  SHRINKING: ['tucking in', 'folding up', 'hushing', 'lulling', 'shushing', 'sealing up', 'waving off', 'hiding from'],
};

/** Who or what she does it to. */
export const SUBJECTS = [
  'the colors', 'the lights', 'the photographer', 'a nervous shadow', 'the shiny bits',
  'the loudest color', 'a very small cloud', 'the sleepy corners', 'the horizon', 'the camera',
];

/** The subject she very rarely meets. */
export const RARE = 'the mind goblin';

const MIX_SHARE = 0.55; // of what she says while she works, how much is an action and a subject
const RARE_SHARE = 0.06; // of those, how often the subject is the mind goblin

export const EVENTS = Object.keys(LINES);

/** Every line an event could say. */
export const allLines = (event) => (LINES[event] ? [...LINES[event], ...(MIXES[event] ?? []).flatMap((a) => [...SUBJECTS, RARE].map((s) => `${a} ${s}`))] : []);

/**
 * @param {() => number} random picks the line, so a seed repeats what is said
 * @returns {{line(event: string): string}} `line` is something to say for the event, never what it said last time for that event; '' for an unknown event
 */
export function createVoice(random = Math.random) {
  const last = {};
  const pick = (list) => list[Math.floor(random() * list.length)];
  return {
    line(event) {
      if (!LINES[event]) return '';
      let said = '';
      for (let tries = 0; tries < 10 && (!said || said === last[event]); tries++) {
        said = MIXES[event] && random() < MIX_SHARE
          ? `${pick(MIXES[event])} ${random() < RARE_SHARE ? RARE : pick(SUBJECTS)}`
          : pick(LINES[event]);
      }
      if (said === last[event]) said = pick(LINES[event].filter((l) => l !== last[event]));
      return (last[event] = said);
    },
  };
}
