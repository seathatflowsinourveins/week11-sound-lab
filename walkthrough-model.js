(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./walkthrough-data.js'));
  else root.WalkthroughModel = factory(root.WalkthroughData);
})(globalThis, function (data) {
  'use strict';

  const { chapters, lessons } = data;
  const positions = chapters.flatMap(([chapter, , lines]) => lines.map(line => ({ chapter, line })));
  const voices = ['melody', 'bass', 'pulse'];

  function isPosition(value) {
    return value && lessons.some(lesson => lesson.id === value.lesson)
      && positions.some(position => position.chapter === value.chapter && position.line === value.line);
  }

  function resolvePosition(hash, saved) {
    const route = /^#([a-z]+)\/([a-z]+)\/([1-9]\d{0,2})$/.exec(hash);
    const fromLink = route && { lesson: route[1], chapter: route[2], line: Number(route[3]) };
    const position = isPosition(fromLink) ? fromLink : saved;
    if (isPosition(position)) return { lesson: position.lesson, chapter: position.chapter, line: position.line };
    return { lesson: lessons[0].id, ...positions[0] };
  }

  function positionHash({ lesson, chapter, line }) {
    return '#' + lesson + '/' + chapter + '/' + line;
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
    const events = score.events.filter(event => event.time === time);
    return { slot, time, events };
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

  return { resolvePosition, positionHash, moveLine, inspectSlot, makeExcerpt };
});
