/* Original Week 11 teaching score. No dependencies; runs in Node and browsers. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SoundLab = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DURATION = 60;
  const STEP = 0.25; // An eighth note at 120 beats per minute.
  const RATIOS = [1, 1.125, 1.25, 1.34, 1.5, 1.67, 1.875, 2];
  const MOTIF = [0, 2, 4, 2, 1, 3, 2, 0];
  const experiments = Object.freeze([
    Object.freeze({ id: 'pulse', title: 'A simple pulse',
      description: 'A short melody repeats, with one note every two seconds.',
      change: 'Baseline: one sine voice, one repeated rule.',
      expect: 'Listen for a spacious, predictable melody and the silence between notes.' }),
    Object.freeze({ id: 'rhythm', title: 'An interlocking rhythm',
      description: 'The melody moves to uneven grid positions; a bass and pulse join it.',
      change: 'Revision 1: play melody on steps 0, 3 and 6 of each eight-step cycle; add bass and pulse.',
      expect: 'Listen for a steadier low pulse underneath a less evenly spaced melody.' }),
    Object.freeze({ id: 'composition', title: 'Seed → growth → return',
      description: 'Four fifteen-second sections introduce, develop and release the idea.',
      change: 'Revision 2: change density, pitch and timbre by section, then finish on the tonic.',
      expect: 'Listen for the busiest section at 30 seconds and a simpler return at 45 seconds.' })
  ]);

  function makeScore(id) {
    if (!experiments.some(item => item.id === id)) throw new RangeError('Unknown experiment: ' + id);
    const sections = id === 'composition'
      ? ['Seed', 'Growth', 'Density', 'Return'].map((title, i) => ({ start: i * 15, end: (i + 1) * 15, title }))
      : [{ start: 0, end: DURATION, title: id === 'pulse' ? 'Repeated melody' : 'Interlocking rhythm' }];
    const events = [];
    let note = 0;
    function add(step, duration, frequency, gain, wave, voice) {
      const time = step * STEP;
      events.push({ time, duration: Math.min(duration, DURATION - time), frequency, gain, wave, voice,
        section: sections.find(section => time >= section.start && time < section.end).title });
    }
    function melody(step, duration, gain, wave, shift = 0) {
      const degree = (MOTIF[note % MOTIF.length] + shift) % RATIOS.length;
      add(step, duration, 262 * RATIOS[degree], gain, wave, 'melody');
      note += 1;
    }
    for (let step = 0; step < 240; step += 1) {
      if (id === 'pulse') {
        if (step % 8 === 0) melody(step, 0.6, 0.085, 'sine');
      } else if (id === 'rhythm') {
        if ([0, 3, 6].includes(step % 8)) melody(step, 0.3, 0.075, 'triangle');
        if (step % 16 === 0) add(step, 0.7, 131, 0.065, 'sine', 'bass');
        if (step % 4 === 0) add(step, 0.11, 65.5, 0.045, 'sine', 'pulse');
      } else {
        const section = Math.floor(step / 60);
        if (section === 0 && step % 8 === 0) melody(step, 0.6, 0.07, 'sine');
        if (section === 1) {
          if (step % 4 === 0) melody(step, 0.38, 0.075, 'triangle');
          if (step % 16 === 0) add(step, 0.7, 131, 0.06, 'sine', 'bass');
          if (step % 4 === 0) add(step, 0.11, 65.5, 0.035, 'sine', 'pulse');
        }
        if (section === 2) {
          if ([0, 3, 4, 6].includes(step % 8)) melody(step, 0.3, 0.075, 'triangle', 2);
          if (step % 8 === 0) add(step, 0.6, 131 * RATIOS[Math.floor(step / 8) % 2 === 0 ? 0 : 4], 0.06, 'sine', 'bass');
          if ([0, 3, 6].includes(step % 8)) add(step, 0.11, 65.5, 0.035, 'sine', 'pulse');
        }
        if (section === 3) {
          if (step < 236 && step % 8 === 0) melody(step, 0.6, 0.055, 'sine');
          if (step < 232 && step % 16 === 0) add(step, 0.7, 131, 0.045, 'sine', 'bass');
          if (step === 236) add(step, 1, 262, 0.055, 'sine', 'melody');
        }
      }
    }
    events.sort((a, b) => a.time - b.time || a.voice.localeCompare(b.voice));
    return { id, duration: DURATION, bpm: 120, events, sections };
  }

  function validateScore(score) {
    if (!score || !Number.isFinite(score.duration) || score.duration <= 0 || score.duration > 60 || !Array.isArray(score.events)) {
      throw new TypeError('A score needs a duration up to 60 seconds and an events array.');
    }
    for (const event of score.events) {
      if (![event.time, event.duration, event.frequency, event.gain].every(Number.isFinite)
        || event.time < 0 || event.duration <= 0 || event.time + event.duration > score.duration + 1e-9
        || event.frequency <= 0 || event.frequency > 20000 || event.gain < 0 || event.gain > 0.12
        || !['sine', 'triangle'].includes(event.wave)) throw new RangeError('Invalid note in score.');
    }
  }

  function summarize(score) {
    validateScore(score);
    const voices = { melody: 0, bass: 0, pulse: 0 };
    const edges = [];
    let minFrequency = Infinity, maxFrequency = 0, latestEnd = 0;
    for (const event of score.events) {
      voices[event.voice] = (voices[event.voice] || 0) + 1;
      minFrequency = Math.min(minFrequency, event.frequency);
      maxFrequency = Math.max(maxFrequency, event.frequency);
      latestEnd = Math.max(latestEnd, event.time + event.duration);
      edges.push({ time: event.time, gain: event.gain }, { time: event.time + event.duration, gain: -event.gain });
    }
    edges.sort((a, b) => a.time - b.time || a.gain - b.gain);
    let overlap = 0, peakBound = 0;
    for (const edge of edges) { overlap += edge.gain; peakBound = Math.max(peakBound, overlap); }
    return { eventCount: score.events.length, voices,
      sections: (score.sections || []).map(section => ({ ...section,
        eventCount: score.events.filter(event => event.time >= section.start && event.time < section.end).length })),
      minFrequency: score.events.length ? minFrequency : 0, maxFrequency, latestEnd,
      peakBound: Number(peakBound.toFixed(6)) };
  }

  function envelopePoints(duration) {
    return { attack: Math.min(0.008, duration / 4), release: Math.min(0.035, duration / 4) };
  }

  function envelopeAt(time, duration) {
    if (time <= 0 || time >= duration) return 0;
    const { attack, release } = envelopePoints(duration);
    return Math.min(1, time / attack, (duration - time) / release);
  }

  function renderPCM(score, { sampleRate = 22050 } = {}) {
    validateScore(score);
    if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new RangeError('Sample rate must be an integer from 8000 to 192000.');
    if (score.events.some(event => event.frequency >= sampleRate / 2)) throw new RangeError('Note frequency must be below half the sample rate.');
    const output = new Float32Array(Math.round(score.duration * sampleRate));
    for (const event of score.events) {
      const first = Math.ceil(event.time * sampleRate);
      const last = Math.min(output.length - 1, Math.ceil((event.time + event.duration) * sampleRate));
      for (let i = first; i < last; i += 1) {
        const local = i / sampleRate - event.time;
        const sine = Math.sin(2 * Math.PI * event.frequency * local);
        // Mathematical triangle; browsers use a band-limited oscillator, so PCM is not bit-identical.
        const wave = event.wave === 'triangle' ? 2 / Math.PI * Math.asin(sine) : sine;
        output[i] += event.gain * envelopeAt(local, event.duration) * wave;
      }
    }
    output[0] = 0;
    output[output.length - 1] = 0;
    return output;
  }

  function renderWav(score, { sampleRate = 22050 } = {}) {
    const pcm = renderPCM(score, { sampleRate });
    const bytes = new Uint8Array(44 + pcm.length * 2);
    const view = new DataView(bytes.buffer);
    function text(offset, value) { for (let i = 0; i < value.length; i += 1) bytes[offset + i] = value.charCodeAt(i); }
    text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i += 1) {
      const value = Math.max(-1, Math.min(1, pcm[i]));
      view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
    }
    return bytes;
  }

  function playScore(context, score, { onEnd } = {}) {
    validateScore(score);
    // An offline graph must be scheduled before startRendering() advances its clock.
    // A suspended real-time context still needs an explicit user gesture and resume().
    const readyOffline = context && typeof context.startRendering === 'function'
      && context.destination && context.state === 'suspended';
    if (!context || (context.state !== 'running' && !readyOffline)) {
      throw new Error('Start audio from a user gesture and await context.resume() before playing.');
    }
    const startTime = context.currentTime + 0.06;
    const endTime = startTime + score.duration;
    const master = context.createGain();
    master.gain.setValueAtTime(1, context.currentTime);
    master.gain.setValueAtTime(0, endTime);
    master.connect(context.destination);
    const sources = [];
    const gains = [];
    let active = true;
    let endMarker;
    function disconnect() {
      for (const source of sources) { source.onended = null; source.disconnect(); }
      for (const gain of gains) gain.disconnect();
      master.disconnect();
    }
    function stop() {
      if (!active) return;
      active = false;
      if (endMarker) endMarker.onended = null;
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(0, context.currentTime);
      for (const source of sources) source.stop(context.currentTime);
      disconnect();
    }
    try {
      for (const event of score.events) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = startTime + event.time;
        const end = Math.min(endTime, start + event.duration);
        const { attack, release } = envelopePoints(event.duration);
        oscillator.type = event.wave;
        oscillator.frequency.setValueAtTime(event.frequency, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(event.gain, start + attack);
        gain.gain.setValueAtTime(event.gain, end - release);
        gain.gain.linearRampToValueAtTime(0, end);
        oscillator.connect(gain); gain.connect(master);
        oscillator.start(start); oscillator.stop(end);
        sources.push(oscillator); gains.push(gain);
      }
      // A silent source makes completion follow the audio clock even if the context is suspended.
      endMarker = context.createOscillator();
      const silence = context.createGain();
      silence.gain.setValueAtTime(0, context.currentTime);
      endMarker.connect(silence); silence.connect(master);
      endMarker.onended = function () {
        if (!active) return;
        active = false;
        disconnect();
        if (typeof onEnd === 'function') onEnd();
      };
      endMarker.start(startTime); endMarker.stop(endTime);
      sources.push(endMarker); gains.push(silence);
    } catch (error) { stop(); throw error; }
    return { stop, startTime, endTime };
  }

  return Object.freeze({ experiments, makeScore, summarize, renderPCM, renderWav, playScore, envelopeAt });
});
