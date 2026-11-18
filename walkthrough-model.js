(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./walkthrough-data.js'));
  else root.WalkthroughModel = factory(root.WalkthroughData);
})(globalThis, function (data) {
  'use strict';

  const { chapters, lessons } = data;
  const positions = chapters.flatMap(([chapter, , lines]) => lines.map(line => ({ chapter, line })));
  const voices = ['melody', 'bass', 'pulse'];
  // These values are checked against the exact composer source in walkthrough.test.cjs.
  const motif = Object.freeze([0, 2, 4, 2, 1, 3, 2, 0]);
  const ratios = Object.freeze([1, 1.125, 1.25, 1.34, 1.5, 1.67, 1.875, 2]);

  function isPosition(value) {
    return value && lessons.some(lesson => lesson.id === value.lesson)
      && positions.some(position => position.chapter === value.chapter && position.line === value.line);
  }

  function resolvePosition(hash, saved) {
    const route = /^#([a-z]+)\/([a-z]+)\/([1-9]\d{0,2})(?:\/(0|[1-9]\d{0,2}))?$/.exec(hash);
    const fromLink = route && { lesson: route[1], chapter: route[2], line: Number(route[3]) };
    if (fromLink && route[4] !== undefined) fromLink.slot = Number(route[4]);
    const position = isPosition(fromLink) ? fromLink : saved;
    if (isPosition(position)) {
      const result = { lesson: position.lesson, chapter: position.chapter, line: position.line };
      if (Number.isInteger(position.slot) && position.slot >= 0 && position.slot < 240) result.slot = position.slot;
      return result;
    }
    return { lesson: lessons[0].id, ...positions[0] };
  }

  function positionHash({ lesson, chapter, line, slot }) {
    return '#' + lesson + '/' + chapter + '/' + line + (slot === undefined ? '' : '/' + slot);
  }

  function moveLine(position, direction) {
    const current = resolvePosition('', position);
    const index = positions.findIndex(item => item.chapter === current.chapter && item.line === current.line);
    const adjacent = positions[index + Math.sign(direction)] || positions[index];
    return { lesson: current.lesson, ...adjacent };
  }

  function inspectSlot(score, value) {
    const slot = Number.isFinite(value) ? Math.min(239, Math.max(0, Math.floor(value))) : 0;
    const time = slot / 4;
    const { starts, continuing } = voiceAt(score, null, time);
    return { slot, time, events: starts, continuing };
  }

  function voiceAt(score, voice, time) {
    const starts = [], continuing = [];
    for (const event of score.events) {
      if (voice !== null && voice !== event.voice) continue;
      if (event.time === time) starts.push(event);
      else if (event.time < time && time < event.time + event.duration) continuing.push(event);
    }
    return { starts, continuing };
  }

  function pitchAt(score, slot) {
    const { time, events } = inspectSlot(score, slot);
    const directFinal = score.id === 'composition' && time === 59;
    const count = score.events.filter(event => event.voice === 'melody' && event.time < time
      && !(score.id === 'composition' && event.time === 59)).length;
    const index = count % motif.length;
    const motifValue = motif[index];
    const shift = score.id === 'composition' && time >= 30 && time < 45 ? 2 : 0;
    const degree = (motifValue + shift) % ratios.length;
    const ratio = ratios[degree];
    const melody = events.find(event => event.voice === 'melody');
    const called = !directFinal && Boolean(melody);
    const frequency = directFinal ? melody.frequency : 262 * ratio;
    return { motif, ratios, count, index, motifValue, shift, degree, ratio, called, directFinal, frequency };
  }

  function layoutVoice(score, voice, from, until) {
    const trackEnds = [];
    const bars = [];
    for (const note of score.events) {
      if (note.voice !== voice) continue;
      const end = Math.min(until, note.time + note.duration);
      const start = Math.max(from, note.time);
      if (end <= start) continue;
      let track = trackEnds.findIndex(time => time <= start);
      if (track < 0) track = trackEnds.length;
      trackEnds[track] = end;
      bars.push({ note, start, end, track, hasOnset: note.time >= from });
    }
    return { bars, tracks: Math.max(1,trackEnds.length) };
  }

  function makeExcerpt(score, start, end, voice = null) {
    if (!(Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && end <= score.duration)) {
      throw new RangeError('The excerpt must fit within the score.');
    }
    if (voice !== null && !voices.includes(voice)) throw new RangeError('Unknown voice: ' + voice);
    const events = score.events
      .filter(event => event.time >= start && event.time < end && (voice === null || event.voice === voice))
      .map(event => ({ ...event, time: event.time - start, duration: Math.min(event.duration, end - event.time) }));
    return { id: score.id, duration: end - start, bpm: score.bpm, events };
  }

  function noteAtMarker(score, time, voice) {
    const { starts, continuing } = voiceAt(score, null, time);
    return starts.find(note => note.voice === voice) || continuing.find(note => note.voice === voice)
      || starts.find(note => note.voice === 'melody') || starts[0] || continuing[0] || null;
  }

  function isolateNote(score, note) {
    return { id: score.id, bpm: score.bpm, duration: note.duration, events: [{ ...note, time: 0 }] };
  }

  function playbackMoment(clip, elapsed, offset = 0) {
    const local = Math.max(0, Math.min(clip.duration, elapsed));
    const time = offset + local;
    const sounding = clip.events.filter(note => note.time <= local && local < note.time + note.duration);
    const next = clip.events.find(note => note.time > local);
    return {
      time, slot: Math.min(239, Math.floor(time * 4)), sounding,
      next: next ? clip.events.filter(note => note.time === next.time) : []
    };
  }

  function nearestPitch(frequency) {
    const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
    return ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][midi % 12] + (Math.floor(midi / 12) - 1);
  }

  return { resolvePosition, positionHash, moveLine, inspectSlot, voiceAt, pitchAt, layoutVoice, makeExcerpt, noteAtMarker, isolateNote, playbackMoment, nearestPitch };
});
