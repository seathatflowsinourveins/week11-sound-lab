'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');
const lab = require('./composer.js');

test('Every experiment is a deterministic 60-second score with valid quiet notes', () => {
  const counts = [];
  for (const { id } of lab.experiments) {
    const score = lab.makeScore(id);
    assert.deepEqual(score, lab.makeScore(id));
    assert.equal(score.duration, 60);
    assert.equal(score.bpm, 120);
    assert.ok(score.events.length > 0);
    for (const event of score.events) {
      assert.ok(event.time >= 0 && event.time < 60);
      assert.ok(event.duration > 0 && event.time + event.duration <= 60);
      assert.equal(event.time / 0.25, Math.round(event.time / 0.25));
      assert.ok(event.gain <= 0.12);
      assert.ok(['sine', 'triangle'].includes(event.wave));
    }
    const summary = lab.summarize(score);
    assert.ok(summary.peakBound < 0.5);
    assert.equal(Object.values(summary.voices).reduce((a, b) => a + b, 0), score.events.length);
    counts.push(summary.eventCount);
  }
  assert.equal(new Set(counts).size, 3, 'Revisions must change the audible event sequence');
});

test('Final composition develops over four sections and resolves on the tonic at 60 seconds', () => {
  const score = lab.makeScore('composition');
  const summary = lab.summarize(score);
  assert.deepEqual(score.sections.map(s => [s.start, s.end, s.title]), [
    [0, 15, 'Seed'], [15, 30, 'Growth'], [30, 45, 'Density'], [45, 60, 'Return']
  ]);
  assert.ok(summary.sections[2].eventCount > summary.sections[0].eventCount);
  assert.ok(summary.sections[2].eventCount > summary.sections[3].eventCount);
  assert.equal(summary.latestEnd, 60);
  for (const event of score.events) {
    const section = score.sections.find(part => event.time >= part.start && event.time < part.end);
    assert.equal(event.section, section.title, 'Section membership follows note onset, including boundary steps');
  }
  assert.deepEqual(score.events.at(-1), { time: 59, duration: 1, frequency: 262, gain: 0.055,
    wave: 'sine', voice: 'melody', section: 'Return' });
});

test('PCM renders actual bounded, non-silent, repeatable sound with silent file endpoints', () => {
  const hashes = [];
  for (const { id } of lab.experiments) {
    const score = lab.makeScore(id);
    const pcm = lab.renderPCM(score);
    assert.equal(pcm.length, 60 * 22050);
    assert.equal(pcm[0], 0);
    assert.equal(pcm.at(-1), 0);
    let peak = 0, energy = 0;
    for (const sample of pcm) { assert.ok(Number.isFinite(sample)); peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
    assert.ok(peak > 0.01 && peak <= lab.summarize(score).peakBound + 1e-6);
    assert.ok(Math.sqrt(energy / pcm.length) > 0.005);
    const hash = value => crypto.createHash('sha256').update(new Uint8Array(value.buffer)).digest('hex');
    hashes.push(hash(pcm));
    assert.equal(hash(pcm), hash(lab.renderPCM(score)));
  }
  assert.equal(new Set(hashes).size, 3);
});

test('Shared envelope attacks and releases to silence', () => {
  assert.equal(lab.envelopeAt(0, 1), 0);
  assert.equal(lab.envelopeAt(0.004, 1), 0.5);
  assert.equal(lab.envelopeAt(0.5, 1), 1);
  assert.ok(Math.abs(lab.envelopeAt(0.9825, 1) - 0.5) < 1e-12);
  assert.equal(lab.envelopeAt(1, 1), 0);
});

test('WAV header describes the complete mono PCM16 file', () => {
  const wav = lab.renderWav(lab.makeScore('composition'), { sampleRate: 8000 });
  const view = new DataView(wav.buffer);
  const text = (offset, count) => String.fromCharCode(...wav.slice(offset, offset + count));
  assert.equal(text(0, 4), 'RIFF'); assert.equal(text(8, 4), 'WAVE'); assert.equal(text(12, 4), 'fmt ');
  assert.equal(view.getUint32(4, true), wav.length - 8);
  assert.equal(view.getUint16(20, true), 1); assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 8000); assert.equal(view.getUint16(34, true), 16);
  assert.equal(text(36, 4), 'data'); assert.equal(view.getUint32(40, true), 8000 * 60 * 2);
  assert.equal(view.getInt16(44, true), 0); assert.equal(view.getInt16(wav.length - 2, true), 0);
});

function fakeContext() {
  const sources = [], gains = [];
  function param() {
    return { calls: [], setValueAtTime(value, time) { this.calls.push(['set', value, time]); },
      linearRampToValueAtTime(value, time) { this.calls.push(['ramp', value, time]); },
      cancelScheduledValues(time) { this.calls.push(['cancel', time]); } };
  }
  const ctx = { currentTime: 5, state: 'running', destination: {}, sources, gains,
    createGain() { const node = { gain: param(), connect() {}, disconnect() { this.disconnected = true; } }; gains.push(node); return node; },
    createOscillator() { const node = { frequency: param(), starts: [], stops: [], onended: null,
      connect() {}, disconnect() { this.disconnected = true; }, start(time) { this.starts.push(time); }, stop(time) { this.stops.push(time); } }; sources.push(node); return node; } };
  return ctx;
}

test('Playback uses absolute audio time, shared envelope and an audio-clock completion event', () => {
  const ctx = fakeContext(); let ended = 0;
  const score = lab.makeScore('composition');
  const player = lab.playScore(ctx, score, { onEnd() { ended += 1; } });
  assert.equal(player.startTime, 5.06); assert.equal(player.endTime, 65.06);
  assert.equal(ctx.sources.length, score.events.length + 1);
  for (let i = 0; i < score.events.length; i += 1) {
    assert.equal(ctx.sources[i].starts[0], player.startTime + score.events[i].time);
    assert.ok(ctx.sources[i].stops[0] <= player.endTime);
    assert.equal(ctx.gains[i + 1].gain.calls[0][1], 0);
    assert.equal(ctx.gains[i + 1].gain.calls.at(-1)[1], 0);
  }
  ctx.sources.at(-1).onended();
  assert.equal(ended, 1); assert.ok(ctx.sources.every(node => node.disconnected));
  player.stop(); assert.equal(ended, 1);
});

test('Stop before the first note mutes immediately, cancels future notes and suppresses completion', () => {
  const ctx = fakeContext(); let ended = 0;
  const player = lab.playScore(ctx, lab.makeScore('rhythm'), { onEnd() { ended += 1; } });
  const pendingEnd = ctx.sources.at(-1).onended;
  player.stop(); player.stop(); pendingEnd();
  assert.equal(ended, 0);
  assert.ok(ctx.sources.every(node => node.stops.at(-1) === 5 && node.disconnected));
  assert.deepEqual(ctx.gains[0].gain.calls.at(-1), ['set', 0, 5]);
});

test('Offline graphs schedule while suspended, before rendering advances their audio clock', () => {
  const ctx = fakeContext(); let renderCalls = 0;
  ctx.currentTime = 0;
  ctx.state = 'suspended';
  ctx.startRendering = function () {
    renderCalls += 1;
    assert.equal(this.sources.length, lab.makeScore('composition').events.length + 1);
    assert.ok(this.sources.every(source => source.starts.length === 1 && source.stops.length === 1));
    this.state = 'running';
  };
  const graph = lab.playScore(ctx, lab.makeScore('composition'));
  assert.equal(renderCalls, 0, 'Scheduling must not start rendering implicitly');
  assert.equal(ctx.state, 'suspended');
  assert.equal(graph.startTime, 0.06);
  assert.equal(graph.endTime, 60.06);
  ctx.startRendering();
  assert.equal(renderCalls, 1);
  graph.stop();
  ctx.state = 'closed';
  assert.throws(() => lab.playScore(ctx, lab.makeScore('pulse')), /resume/);
});

test('Stop during playback cancels the end marker and all remaining notes at the current audio time', () => {
  const ctx = fakeContext(); let ended = 0;
  const graph = lab.playScore(ctx, lab.makeScore('composition'), { onEnd() { ended += 1; } });
  const pendingEnd = ctx.sources.at(-1).onended;
  ctx.currentTime = 35;
  graph.stop();
  pendingEnd();
  assert.equal(ended, 0);
  assert.ok(ctx.sources.every(source => source.stops.at(-1) === 35 && source.disconnected));
  assert.equal(ctx.sources.at(-1).onended, null);
  assert.deepEqual(ctx.gains[0].gain.calls.at(-1), ['set', 0, 35]);
});

test('Reject invalid scores, rates and unready audio; browser UMD export works', () => {
  assert.throws(() => lab.makeScore('unknown'), /Unknown experiment/);
  assert.throws(() => lab.renderPCM(lab.makeScore('pulse'), { sampleRate: 0 }), /Sample rate/);
  const invalid = lab.makeScore('pulse'); invalid.events[0].time = 61;
  assert.throws(() => lab.renderWav(invalid), /Invalid note/);
  const ctx = fakeContext(); ctx.state = 'suspended';
  assert.throws(() => lab.playScore(ctx, lab.makeScore('pulse')), /resume/);
  assert.equal(ctx.sources.length, 0);
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('./composer.js'), 'utf8'), sandbox);
  assert.equal(sandbox.SoundLab.makeScore('pulse').duration, 60);
});
