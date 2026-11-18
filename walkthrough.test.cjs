'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const SoundLab = require('./composer.js');
const load = () => require('./walkthrough-model.js');

test('every authored score line selects real source and has a complete explanation', () => {
  const { chapters, rows } = require('./walkthrough-data.js');
  const source = fs.readFileSync(__dirname + '/composer.js', 'utf8').split(/\r?\n/);
  const lines = chapters.flatMap(chapter => chapter[2]);
  assert.equal(new Set(lines).size, 80);
  for (let line = 27; line <= 73; line++) assert.ok(lines.includes(line));
  for (const line of lines) {
    assert.ok(source[line - 1].trim());
    assert.equal(rows[line].length, 4);
  }
  assert.equal(source[34].trim(), 'const time = step * STEP;');
});

test('the real score leaves time absent on the skipped slot and creates it at each onset', () => {
  const { inspectSlot } = load();
  const score = SoundLab.makeScore('pulse');
  assert.deepEqual([0, 1, 8].map(slot => {
    const inspected = inspectSlot(score, slot);
    return [inspected.time, inspected.events.map(event => event.time)];
  }), [[0, [0]], [0.25, []], [2, [2]]]);
  const rhythm = inspectSlot(SoundLab.makeScore('rhythm'), 4);
  assert.deepEqual(rhythm.events.map(event => event.voice), ['pulse']);
  assert.equal(inspectSlot(score, -10).slot, 0);
  assert.equal(inspectSlot(score, 250).slot, 239);
});

test('a valid deep link wins, malformed positions fall back, and Next crosses chapters', () => {
  const { resolvePosition, positionHash, moveLine } = load();
  const saved = { lesson: 'pulse', chapter: 'add', line: 35 };
  const linked = { lesson: 'rhythm', chapter: 'rules', line: 48 };
  assert.deepEqual(resolvePosition('#rhythm/rules/48', saved), linked);
  assert.deepEqual(resolvePosition('#pulse/add/0', saved), saved);
  assert.deepEqual(resolvePosition('#%ZZ', { lesson: 'none' }), { lesson: 'pulse', chapter: 'time', line: 8 });
  assert.deepEqual(resolvePosition('#pulse/add/048', saved), saved);
  assert.equal(positionHash(linked), '#rhythm/rules/48');
  assert.deepEqual(moveLine({ lesson: 'pulse', chapter: 'time', line: 11 }, 1), { lesson: 'pulse', chapter: 'score', line: 27 });
  assert.deepEqual(moveLine(saved, -1), { lesson: 'pulse', chapter: 'add', line: 34 });
});

test('excerpts use only in-range onsets, preserve the ending, and filter voices', () => {
  const { makeExcerpt } = load();
  const composition = SoundLab.makeScore('composition');
  const ending = makeExcerpt(composition, 58, 60);
  assert.equal(ending.duration, 2);
  assert.deepEqual(ending.events.map(event => [event.time,event.frequency,event.duration]), [[0,327.5,0.6], [1,262,1]]);
  assert.equal(makeExcerpt(composition,45,53).events[0].time,1);
  const rhythm = SoundLab.makeScore('rhythm');
  assert.deepEqual(makeExcerpt(rhythm,0,8,'bass').events.map(event => event.time), [0,4]);
  assert.equal(makeExcerpt(rhythm,0,0.25,'bass').events[0].duration,0.25);
  assert.throws(() => makeExcerpt(composition,59,61), RangeError);
  assert.throws(() => makeExcerpt(composition,2,1), RangeError);
});
