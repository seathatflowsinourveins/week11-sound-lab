'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const SoundLab = require('./composer.js');
const load = () => require('./walkthrough-model.js');

test('the note inspector follows starts, held notes, silence and overlapping voices', () => {
  const { noteAtMarker } = load();
  const pulse = SoundLab.makeScore('pulse');
  assert.equal(noteAtMarker(pulse, .25), pulse.events[0]);
  assert.equal(noteAtMarker(pulse, .75), null);
  const rhythm = SoundLab.makeScore('rhythm');
  assert.equal(noteAtMarker(rhythm, 0, 'bass').voice, 'bass');
  assert.equal(noteAtMarker(rhythm, 1).voice, 'pulse');
  assert.equal(noteAtMarker(rhythm, 1, 'melody').time, .75);
  const composition = SoundLab.makeScore('composition');
  assert.equal(noteAtMarker(composition, 31, 'melody').time, 31);
});

test('solo playback and the illustration use one original note with a local zero start', () => {
  const { isolateNote } = load();
  const score = SoundLab.makeScore('composition');
  const ending = score.events.find(event => event.time === 59);
  const solo = isolateNote(score, ending);
  assert.equal(solo.duration, ending.duration);
  assert.deepEqual(solo.events, [{ ...ending, time: 0 }]);
  assert.equal(ending.time, 59);
  const samples = SoundLab.renderPCM(solo);
  assert.equal(samples.length, 22050);
  assert.ok(samples.some(sample => sample !== 0));
});

test('a listening checkpoint opens the precise source line and slot', () => {
  const { resolvePosition, positionHash } = load();
  const position = { lesson: 'pulse', chapter: 'add', line: 35, slot: 1 };
  assert.equal(positionHash(position), '#pulse/add/35/1');
  assert.deepEqual(resolvePosition(positionHash(position)), position);
  assert.deepEqual(resolvePosition('#pulse/add/35/0'), { ...position, slot: 0 });
  assert.notEqual(resolvePosition('#pulse/add/35/240').slot, 240);
});

test('every listening stop points to a taught line and plays its complete score window', () => {
  const guide = require('./listening-manifest.json');
  const { inspectSlot, makeExcerpt, resolvePosition, positionHash } = load();
  const { chapters } = require('./walkthrough-data.js');
  assert.deepEqual(guide.experiments.map(item => item.id), SoundLab.experiments.map(item => item.id));
  for (const experiment of guide.experiments) {
    const score = SoundLab.makeScore(experiment.id);
    const ids = new Set();
    for (const stop of experiment.stops) {
      assert.ok(!ids.has(stop.id));
      ids.add(stop.id);
      const [from, until] = stop.window;
      const info = inspectSlot(score, stop.slot);
      assert.ok(info.time >= from && info.time < until);
      assert.ok(chapters.find(([key]) => key === stop.chapter)[2].includes(stop.line));
      const position = { lesson: experiment.id, chapter: stop.chapter, line: stop.line, slot: stop.slot };
      assert.deepEqual(resolvePosition(positionHash(position)), position);
      assert.deepEqual(info.events.map(note => note.voice).sort(), stop.starts);
      assert.deepEqual(info.continuing.map(note => note.voice).sort(), stop.holds);
      assert.equal(inspectSlot(score, from * 4).continuing.length, 0, 'Excerpt needs the entire first note');
      const excerpt = makeExcerpt(score, from, until);
      assert.ok(excerpt.events.length && excerpt.duration === until - from);
    }
  }
  for (const reference of guide.references) assert.match(reference.source, /\/(blob|commit)\/[a-f0-9]{40}\//);
});

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

test('score illustrations distinguish a note starting, continuing, and already ended', () => {
  const { inspectSlot, voiceAt } = load();
  const pulse = SoundLab.makeScore('pulse');
  assert.deepEqual([0, 1, 2, 3, 8].map(slot => {
    const { events, continuing } = inspectSlot(pulse, slot);
    return [events.length, continuing.length];
  }), [[1, 0], [0, 1], [0, 1], [0, 0], [1, 0]]);
  const composition = SoundLab.makeScore('composition');
  const boundary = inspectSlot(composition, 180);
  assert.deepEqual(boundary.events, []);
  assert.equal(boundary.continuing[0].section, 'Density');
  assert.deepEqual(voiceAt({ events: [{ time: 0, duration: 0.25, voice: 'pulse' }] }, 'pulse', 0.25),
    { starts: [], continuing: [] });
});

test('pitch illustration follows the real motif, including wrap and the direct ending note', () => {
  const { pitchAt } = load();
  const pulse = SoundLab.makeScore('pulse');
  const source = fs.readFileSync(__dirname + '/composer.js', 'utf8');
  const motif = JSON.parse(source.match(/const MOTIF = (\[[^\]]+\]);/)[1]);
  const ratios = JSON.parse(source.match(/const RATIOS = (\[[^\]]+\]);/)[1]);
  assert.deepEqual(pitchAt(pulse, 8).motif, motif);
  assert.deepEqual(pitchAt(pulse, 8).ratios, ratios);
  const second = pitchAt(pulse, 8);
  assert.deepEqual([second.index, second.motifValue, second.frequency, second.called], [1, 2, 327.5, true]);
  assert.equal(pitchAt(pulse, 64).index, 0);
  const composition = SoundLab.makeScore('composition');
  assert.equal(pitchAt(composition, 236).directFinal, true);
  assert.equal(pitchAt(composition, 236).called, false);
  assert.equal(pitchAt(composition, 236).frequency, 262);
  for (const event of composition.events.filter(item => item.voice === 'melody' && item.time !== 59)) {
    assert.equal(pitchAt(composition, event.time * 4).frequency, event.frequency);
  }
});

test('the duration illustration separates overlapping notes in one voice', () => {
  const { layoutVoice } = load();
  const composition = SoundLab.makeScore('composition');
  const { bars, tracks } = layoutVoice(composition, 'melody', 31, 31.25);
  assert.equal(tracks, 2);
  assert.deepEqual(bars.map(bar => [bar.note.time, bar.end, bar.track, bar.hasOnset]),
    [[30.75, 31.05, 0, false], [31, 31.25, 1, true]]);
});
