'use strict';

const { chapters } = require('../walkthrough-data.js');
const { positionHash } = require('../walkthrough-model.js');

// Entry points demonstrate the subject of each chapter with a real slot.
const examples = {
  time: ['pulse', 9, 1],
  score: ['composition', 30, 60],
  add: ['pulse', 35, 1],
  pitch: ['rhythm', 40, 3],
  rules: ['pulse', 46, 8],
  finish: ['rhythm', 71, 0],
  fade: ['pulse', 116, 0],
  play: ['composition', 193, 236]
};

function escape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function link(href, label, className = '') {
  return '<a' + (className ? ' class="' + className + '"' : '') + ' href="' + escape(href) + '">' + escape(label) + '</a>';
}

module.exports = function renderDesignGuide(template, manifest, results) {
  const rows = [], stops = [];
  for (const exp of manifest.experiments) {
    const { voices, eventCount } = results.experiments.find(result => result.id === exp.id);
    const steps = exp.stops.map(stop => link('listen.html#' + exp.id + '/' + stop.id, stop.label));
    const first = link('listen.html#' + exp.id + '/' + exp.stops[0].id, exp.name);
    const counts = [voices.melody, voices.bass, voices.pulse, eventCount];
    rows.push('<tr data-experiment="' + escape(exp.id) + '"><th scope="row">' + first + '</th>'
      + counts.map(count => '<td>' + count + '</td>').join('') + '</tr>');
    stops.push('<h4>' + escape(exp.name) + '</h4><div class="steps">' + steps.join(' ') + '</div>');
  }

  const references = manifest.references.map(ref => {
    const sourcePath = new URL(ref.source).pathname;
    const [, owner, repo] = sourcePath.split('/');
    const rev = sourcePath.match(/\/(?:blob|commit)\/([a-f0-9]{40})\//)?.[1];
    if (!rev) throw Error('Design reference needs a pinned source revision: ' + ref.name);
    const pin = link(ref.source, owner + '/' + repo + ' · ' + rev.slice(0, 8), 'repo-pin');
    return '<li><div><strong>' + escape(ref.name) + '</strong>' + pin + '</div><p>' + escape(ref.use)
      + '</p>' + link(ref.demo, ref.feature + ' →', 'demo') + '</li>';
  });
  const chapterLinks = chapters.map(([chapter, title, lines]) => {
    const [lesson, line, slot] = examples[chapter];
    const url = 'walkthrough.html' + positionHash({ lesson, chapter, line, slot });
    return '<li data-chapter="' + escape(chapter) + '">' + link(url, title) + '<span>' + lines.length + ' lines</span></li>';
  });
  const credits = manifest.credits.map(group => {
    const items = group.items.map(item => {
      const links = (item.links || []).map(([label, href]) => link(href, label));
      return '<li><strong>' + (item.source ? link(item.source, item.name) : escape(item.name)) + '</strong>'
        + '<p>' + escape(item.use) + '</p>' + (links.length ? '<div class="credit-links">' + links.join(' ') + '</div>' : '') + '</li>';
    });
    return '<details><summary>' + escape(group.title) + '</summary><ul class="credit-list">' + items.join('\n') + '</ul></details>';
  });
  const sections = { 'score rows': rows, 'listening stops': stops, repositories: references, chapters: chapterLinks, credits };
  for (const [key, html] of Object.entries(sections)) {
    const marker = '<!-- ' + key + ' -->';
    if (!template.includes(marker)) throw Error('Missing design guide insertion point: ' + key);
    template = template.replace(marker, () => html.join('\n'));
  }
  return Buffer.from(template.replace('<!-- chapter coverage -->',
    chapters.reduce((total, [, , lines]) => total + lines.length, 0) + ' explained lines across ' + chapters.length + ' chapters.'));
};
