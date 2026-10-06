// Pixi's voice: what it says while it works and when a drop is turned away. Magic, never tech, never repeating itself back to back,
// whole phrases that go as they are, and mix-and-match moments of whimsical nonsense, with the mind goblin now and then.
import assert from 'node:assert/strict';
import { EVENTS, LINES, MIXES, RARE, SUBJECTS, allLines, createVoice } from '../src/voice.js';
import { mulberry32 } from './img.mjs';

assert.deepEqual([...EVENTS].sort(), ['ANALYZING', 'EXPANDING', 'SHRINKING', 'empty', 'not-image', 'too-big', 'too-many', 'unreadable'], 'every phase and every way a drop is turned away has a voice');

const TECH = /\b(algorithm|cluster|k-?means|rule|threshold|accent|pool|extract|rgb|hex|sample|bytes?|mb|error|invalid|unsupported|failed)\b/i;
const check = (line, where) => {
  assert.ok(line.trim() && line.length <= 40, `"${line}" (${where}) fits the tag`);
  assert.ok(!TECH.test(line), `"${line}" (${where}) talks like magic, not like a machine`);
};
for (const event of EVENTS) {
  const lines = LINES[event];
  assert.ok(lines.length >= 3, `${event} has at least three whole phrases, so it can vary`);
  assert.equal(new Set(lines).size, lines.length, `${event} has no repeated phrase`);
  lines.forEach((l) => check(l, event));
}

// Mix and match: an action, its connector and a subject make a moment of nonsense. Only the phases do it; a turned-away drop gets a goblin.
// An action is its verb followed by the connectors it likes ('dancing', 'in', 'with'); a verb with none takes its subject directly ('tricking').
assert.deepEqual(Object.keys(MIXES).sort(), ['ANALYZING', 'EXPANDING', 'SHRINKING'], 'only the phases mix and match');
assert.ok(SUBJECTS.length >= 30, 'there are plenty of subjects');
assert.equal(new Set(SUBJECTS).size, SUBJECTS.length, 'and none twice');
assert.ok(!SUBJECTS.includes(RARE), 'the mind goblin is not an everyday subject');
assert.equal(RARE, 'the mind goblin', 'but the mind goblin exists');
for (const [event, actions] of Object.entries(MIXES)) {
  assert.ok(actions.length >= 12, `${event} has plenty of actions`);
  assert.equal(new Set(actions.map((a) => a[0])).size, actions.length, `${event} has no repeated verb`);
  for (const [verb, ...connectors] of actions) {
    assert.ok(typeof verb === 'string' && verb.trim(), `${event} has a verb`);
    assert.ok(connectors.every((c) => typeof c === 'string' && c.trim()), `${verb} has real connectors`);
    for (const connector of connectors.length ? connectors : ['']) {
      for (const subject of [...SUBJECTS, RARE]) check(`${verb} ${connector ? connector + ' ' : ''}${subject}`, `${event} mix`);
    }
  }
}
assert.ok(Object.values(MIXES).flat().filter((a) => a.length > 2).length >= 8, 'a good many actions have a choice of connectors');
assert.ok(MIXES.ANALYZING.some((a) => a[0] === 'distracted' && a.includes('by')) && MIXES.ANALYZING.some((a) => a[0] === 'winking' && a.includes('at')), 'she can be distracted by, or wink at, anything');
{
  const everything = ['EXPANDING', 'ANALYZING', 'SHRINKING'].flatMap(allLines);
  for (const wanted of ['dancing in the moonlight', 'fluttering against the flowers', 'toiling with the pixels', 'whispering to the lights', 'tricking the colors']) {
    assert.ok(everything.includes(wanted), `"${wanted}" is one of the things she says`);
  }
}
// Whimsical fairy things, with a few odd technical ones thrown in.
{
  const vocabulary = [...Object.values(MIXES).flat().map((a) => a[0]), ...SUBJECTS].join(' ');
  for (const word of ['reciting', 'poem', 'words', 'air', 'wind', 'droplets', 'protons', 'pixels', 'processor']) {
    assert.ok(new RegExp(`\\b${word}\\b`).test(vocabulary), `she knows about ${word}`);
  }
  assert.ok(SUBJECTS.length >= 50, 'there is a big world of subjects');
}

// The mind goblin is who she blames, always, when a drop is turned away: an error, a failure, someone trying to trick her.
const TURNED_AWAY = EVENTS.filter((e) => !MIXES[e]);
assert.deepEqual([...TURNED_AWAY].sort(), ['empty', 'not-image', 'too-big', 'too-many', 'unreadable'], 'every way a drop is turned away is blamed on the goblin');
for (const event of TURNED_AWAY) {
  assert.ok(LINES[event].length >= 4, `${event} has plenty of goblin lines`);
  LINES[event].forEach((l) => assert.ok(l.includes(RARE), `"${l}" blames the mind goblin`));
  assert.deepEqual(allLines(event), LINES[event], `a turned-away drop only ever gets its goblin lines`);
}
assert.ok(allLines('ANALYZING').includes('distracted by the mind goblin'), 'and she can be distracted by the mind goblin');

const voice = createVoice(mulberry32(3));
for (const event of EVENTS) {
  let last = '';
  for (let i = 0; i < 60; i++) {
    const said = voice.line(event);
    assert.ok(allLines(event).includes(said), `${event} only says its own lines`);
    assert.notEqual(said, last, `${event} never says the same line twice running`);
    last = said;
  }
}
assert.equal(voice.line('nonsense'), '', 'an unknown event is silent');
assert.deepEqual(allLines('nonsense'), [], 'and has nothing to say');

{
  const talk = createVoice(mulberry32(11));
  const said = Array.from({ length: 4000 }, () => talk.line('ANALYZING'));
  const share = (f) => said.filter(f).length / said.length;
  assert.ok(share((l) => !LINES.ANALYZING.includes(l)) > 0.3 && share((l) => !LINES.ANALYZING.includes(l)) < 0.9, 'a good share of what she says is mixed, and a good share is whole phrases');
  assert.ok(share((l) => l.includes(RARE)) > 0.005 && share((l) => l.includes(RARE)) < 0.08, 'the mind goblin is a rare pull');
  assert.ok(said.some((l) => l.includes(RARE)), 'but she does meet him');
}

{
  const talk = createVoice(mulberry32(5));
  for (const event of TURNED_AWAY) {
    for (let i = 0; i < 300; i++) assert.ok(talk.line(event).includes(RARE), `${event} always blames the mind goblin`);
  }
}

const a = createVoice(mulberry32(7)), b = createVoice(mulberry32(7));
assert.deepEqual(EVENTS.map((e) => a.line(e)), EVENTS.map((e) => b.line(e)), 'a seed repeats what is said');

console.log('ok 07-voice');
