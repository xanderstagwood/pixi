// Pixi's voice: what it says while it works and when a drop is turned away. Magic, never tech, and never repeating itself back to back.
import assert from 'node:assert/strict';
import { EVENTS, LINES, createVoice } from '../src/voice.js';
import { mulberry32 } from './img.mjs';

assert.deepEqual([...EVENTS].sort(), ['ANALYZING', 'EXPANDING', 'SHRINKING', 'empty', 'not-image', 'too-big', 'too-many', 'unreadable'], 'every phase and every way a drop is turned away has a voice');

const TECH = /\b(algorithm|cluster|k-?means|rule|threshold|accent|pool|extract|rgb|hex|sample|pixels?|bytes?|mb|error|invalid|unsupported|failed)\b/i;
for (const event of EVENTS) {
  const lines = LINES[event];
  assert.ok(lines.length >= 2, `${event} has at least two lines, so it can vary`);
  assert.equal(new Set(lines).size, lines.length, `${event} has no repeated line`);
  for (const line of lines) {
    assert.ok(line.trim() && line.length <= 32, `"${line}" fits the tag`);
    assert.ok(!TECH.test(line), `"${line}" talks like magic, not like a machine`);
  }
}

const voice = createVoice(mulberry32(3));
for (const event of EVENTS) {
  let last = '';
  for (let i = 0; i < 40; i++) {
    const said = voice.line(event);
    assert.ok(LINES[event].includes(said), `${event} only says its own lines`);
    assert.notEqual(said, last, `${event} never says the same line twice running`);
    last = said;
  }
}
assert.equal(voice.line('nonsense'), '', 'an unknown event is silent');

const a = createVoice(mulberry32(7)), b = createVoice(mulberry32(7));
assert.deepEqual(EVENTS.map((e) => a.line(e)), EVENTS.map((e) => b.line(e)), 'a seed repeats what is said');

console.log('ok 07-voice');
