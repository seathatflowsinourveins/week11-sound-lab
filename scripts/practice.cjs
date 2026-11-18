'use strict';

const vm = require('node:vm');
const { makeExcerpt } = require('../walkthrough-model.js');

// Run the reviewed, local composer with exactly one published source edit.
module.exports = function buildPractices(source, experiments, engine) {
  return Object.fromEntries(experiments.map(({ id, practice, homework }) => {
    const { line, before, after, window } = practice;
    const lines = source.split(/\r?\n/);
    const original = lines[line - 1];
    if (original?.split(before).length !== 2) throw Error('Practice edit no longer matches ' + id + ' line ' + line);
    lines[line - 1] = original.replace(before, after);
    const sandbox = {};
    vm.runInNewContext(lines.join('\n'), sandbox, { filename: 'practice-' + id + '.js', timeout: 1000 });
    const versions = [engine.makeScore(id), sandbox.SoundLab.makeScore(id)];
    const clips = versions.map(score => {
      if (score.events.some(note => note.time < window[0] && note.time + note.duration > window[0])) {
        throw Error('Choose a practice window with no carried notes at the start: ' + id);
      }
      return makeExcerpt(score, ...window);
    });
    return [id, { ...practice, homework, clips }];
  }));
};
