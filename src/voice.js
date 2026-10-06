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

/**
 * What she is doing, for the phases that mix and match. An action is its verb followed by the connectors it likes
 * ('dancing', 'in', 'with'); one pick of a connector and one of a subject make the line ("dancing in the moonlight").
 * A verb with no connector takes its subject directly ("tricking the colors"). Mismatches are the point: add freely.
 */
export const MIXES = {
  EXPANDING: [
    ['unrolling'], ['unfolding'], ['waking'], ['peeking', 'at', 'into'], ['sneaking', 'up on', 'past'], ['tiptoeing', 'past', 'around'],
    ['waving', 'at'], ['stretching', 'toward'], ['yawning', 'at'], ['blinking', 'at'], ['skipping', 'past', 'toward'],
    ['dancing', 'in', 'with', 'around'], ['fluttering', 'against', 'near', 'over'], ['drifting', 'toward', 'past', 'through'],
    ['tugging'], ['spying', 'on'], ['reciting', 'to', 'at'], ['breathing', 'on', 'into'], ['catching'], ['unwrapping'], ['shaking out'], ['spelling'],
  ],
  ANALYZING: [
    ['whispering', 'to'], ['bribing'], ['tickling'], ['counting'], ['sweet-talking'], ['arguing', 'with'], ['winking', 'at'],
    ['squinting', 'at'], ['distracted', 'by'], ['chasing'], ['serenading'], ['toiling', 'with', 'over'], ['tricking'],
    ['dancing', 'in', 'with', 'around'], ['fluttering', 'against', 'near', 'over'], ['negotiating', 'with'], ['humming', 'to'],
    ['juggling'], ['polishing'], ['rummaging', 'through', 'among'], ['gossiping', 'with'], ['pestering'], ['charming'],
    ['wrestling', 'with'], ['tasting'], ['bargaining', 'with'], ['poking'], ['borrowing', 'from'],
    ['reciting', 'to', 'at'], ['composing'], ['murmuring', 'to', 'into'], ['scattering'], ['blowing', 'on', 'across'], ['catching'], ['spelling'],
    ['untangling'], ['sieving'], ['weighing'], ['dusting'], ['interrogating'],
  ],
  SHRINKING: [
    ['tucking in'], ['folding up'], ['hushing'], ['lulling'], ['shushing'], ['sealing up'], ['waving off'], ['hiding', 'from'],
    ['saying bye', 'to'], ['bundling up'], ['sprinkling', 'over'], ['dancing', 'in', 'with', 'around'],
    ['fluttering', 'against', 'near', 'over'], ['humming', 'to'], ['putting away'], ['patting'], ['singing', 'to'], ['drifting', 'off with'],
    ['reciting', 'to', 'at'], ['breathing', 'on', 'into'], ['blowing', 'on', 'across'], ['scattering'], ['catching'], ['bottling'], ['stitching'], ['whistling', 'to', 'at'],
  ],
};

/** Who or what she does it to. */
export const SUBJECTS = [
  'the colors', 'the lights', 'the pixels', 'the photographer', 'a nervous shadow', 'the shiny bits', 'the loudest color',
  'a very small cloud', 'the sleepy corners', 'the horizon', 'the camera', 'the moonlight', 'the flowers', 'the quiet blue',
  'a stubborn red', 'the last shadow', 'the glowing bits', 'a runaway sunbeam', 'the dust motes', 'the gentle gray',
  'the morning haze', 'a lost firefly', 'the puddles', 'the tall grass', 'the bright spots', 'an old rainbow',
  'the dark corners', 'the drifting fog', 'the cheeky yellow', 'the tiny stars', 'the warm light', 'the cold light',
  'a sneaky glow', 'the night sky', 'the paintbrush', 'the twinkly edges',
  // fairy things
  'a poem', 'the words', 'the air', 'the wind', 'the droplets', 'the dewdrops', 'the raindrops', 'the acorn caps', 'the moth wings',
  'the toadstools', 'the cobwebs', 'a spoonful of dusk', 'the whispers', 'the pollen', 'a thimble of dawn', 'a tiny storm',
  'a bedtime story', 'the secret garden', 'the silver thread', 'the pocket moon',
  // and a few odd technical things
  'the protons', 'the processor', 'a stray photon', 'the electrons', 'the bandwidth',
];

/** The subject she very rarely meets. */
export const RARE = 'the mind goblin';

const MIX_SHARE = 0.7; // of what she says while she works, how much is an action and a subject
const RARE_SHARE = 0.06; // of those, how often the subject is the mind goblin

export const EVENTS = Object.keys(LINES);

/** Every line an event could say. */
const phrases = ([verb, ...connectors], subject) => (connectors.length ? connectors : ['']).map((c) => `${verb} ${c ? `${c} ` : ''}${subject}`);
export const allLines = (event) => (LINES[event] ? [...LINES[event], ...(MIXES[event] ?? []).flatMap((a) => [...SUBJECTS, RARE].flatMap((s) => phrases(a, s)))] : []);

/**
 * @param {() => number} random picks the line, so a seed repeats what is said
 * @returns {{line(event: string): string, count(event: string): number}} `line` is something to say for the event, never what it said last time for that event; '' for an unknown event.
 *   `count` is how many things she says during the event: two or three while the colors are chosen, one for any other, none for an unknown event
 */
export function createVoice(random = Math.random) {
  const last = {};
  const pick = (list) => list[Math.floor(random() * list.length)];
  return {
    count: (event) => (event === 'ANALYZING' ? 2 + (random() < 0.5 ? 0 : 1) : LINES[event] ? 1 : 0),
    line(event) {
      if (!LINES[event]) return '';
      let said = '';
      for (let tries = 0; tries < 10 && (!said || said === last[event]); tries++) {
        said = MIXES[event] && random() < MIX_SHARE
          ? pick(phrases(pick(MIXES[event]), random() < RARE_SHARE ? RARE : pick(SUBJECTS)))
          : pick(LINES[event]);
      }
      if (said === last[event]) said = pick(LINES[event].filter((l) => l !== last[event]));
      return (last[event] = said);
    },
  };
}
