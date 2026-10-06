// Pixi's voice: what it says while it works and when a drop is turned away. Magic, never tech, never repeating itself back to back,
// whole phrases that go as they are, and mix-and-match moments of whimsical nonsense, with the mind goblin now and then.
import assert from 'node:assert/strict';
import { EVENTS, LINES, MIXES, RARE, SUBJECTS, allLines, createVoice } from '../src/voice.js';
import { mulberry32 } from './img.mjs';

assert.deepEqual([...EVENTS].sort(), ['ANALYZING', 'EXPANDING', 'SHRINKING', 'empty', 'not-image', 'too-big', 'too-many', 'unreadable'], 'every phase and every way a drop is turned away has a voice');

const TECH = /\b(algorithm|cluster|k-?means|rule|threshold|accent|pool|extract|rgb|hex|sample|pixels?|bytes?|mb|error|invalid|unsupported|failed)\b/i;
const check = (line, where) => {
  assert.ok(line.trim() && line.length <= 34, `"${line}" (${where}) fits the tag`);
  assert.ok(!TECH.test(line), `"${line}" (${where}) talks like magic, not like a machine`);
};
for (const event of EVENTS) {
  const lines = LINES[event];
  assert.ok(lines.length >= 3, `${event} has at least three whole phrases, so it can vary`);
  assert.equal(new Set(lines).size, lines.length, `${event} has no repeated phrase`);
  lines.forEach((l) => check(l, event));
}

// Mix and match: an action and a subject make a moment of nonsense. Only the phases do it; a turned-away drop gets a phrase.
assert.deepEqual(Object.keys(MIXES).sort(), ['ANALYZING', 'EXPANDING', 'SHRINKING'], 'only the phases mix and match');
assert.ok(SUBJECTS.length >= 8, 'there are plenty of subjects');
assert.ok(!SUBJECTS.includes(RARE), 'the mind goblin is not an everyday subject');
assert.equal(RARE, 'the mind goblin', 'but the mind goblin exists');
for (const [event, actions] of Object.entries(MIXES)) {
  assert.ok(actions.length >= 6, `${event} has plenty of actions`);
  assert.equal(new Set(actions).size, actions.length, `${event} has no repeated action`);
  for (const action of actions) for (const subject of [...SUBJECTS, RARE]) check(`${action} ${subject}`, `${event} mix`);
}
assert.ok(MIXES.ANALYZING.includes('distracted by') && MIXES.ANALYZING.includes('winking at'), 'she can be distracted by, or wink at, anything');
assert.deepEqual(allLines('empty'), LINES.empty, 'a turned-away drop only ever gets its phrases');
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
  assert.ok(share((l) => !LINES.ANALYZING.includes(l)) > 0.3 && share((l) => !LINES.ANALYZING.includes(l)) < 0.8, 'a good share of what she says is mixed, and a good share is whole phrases');
  assert.ok(share((l) => l.includes(RARE)) > 0.005 && share((l) => l.includes(RARE)) < 0.08, 'the mind goblin is a rare pull');
  assert.ok(said.some((l) => l.includes(RARE)), 'but she does meet him');
}

const a = createVoice(mulberry32(7)), b = createVoice(mulberry32(7));
assert.deepEqual(EVENTS.map((e) => a.line(e)), EVENTS.map((e) => b.line(e)), 'a seed repeats what is said');

console.log('ok 07-voice');
