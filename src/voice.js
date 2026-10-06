/**
 * Pixi's voice: what it says while it works and when a drop is turned away. A pixie, tricky and playful,
 * a little snarky, and never explaining how anything is done: magic, not machinery.
 *
 * Two kinds of line. Whole phrases go out just as they are. While she works she also mixes and matches an
 * action with a subject, for whimsical nonsense, and now and then the subject is the mind goblin. Add to any list freely;
 * keep a line short enough for the tag, and keep it magic.
 */
export const LINES = {
  EXPANDING: ['pulling back the curtain', 'unrolling the picture', 'having a peek', 'opening the secret door', 'here we go'],
  ANALYZING: ['whispering to the colors', 'counting what glitters', 'bribing the colors', 'reading the tea leaves', 'pretending to concentrate', 'this is going well'],
  SHRINKING: ['tucking it in', 'folding it up small', 'sealing it with a wink', 'one last sparkle', 'nearly there'],
  'not-image': ["that's not a picture", 'pixi only eats pictures', 'nice try, that is paperwork', 'i do not eat documents'],
  'too-big': ["that one's enormous", "my pockets aren't that big", 'too much picture, trim it', 'a smaller one, please'],
  unreadable: ["can't open that one", 'that file is playing dead', "that picture won't talk to me", 'it seems to be asleep'],
  'too-many': ['nine at a time, greedy', 'easy, i only have two hands', 'pace yourself, nine is plenty', 'one hand is still full'],
  empty: ['nothing in there, i looked', 'an invisible picture, bold', 'transparent. very funny', 'a ghost of a picture'],
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
