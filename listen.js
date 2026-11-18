(() => {
  'use strict';

  const element = id => document.getElementById(id);
  const { experiments } = JSON.parse(element('guide-manifest').textContent);
  const { layoutVoice, makeExcerpt, positionHash } = WalkthroughModel;
  const source = WALKTHROUGH_SOURCE.split(/\r?\n/);
  const scores = new Map(experiments.map(({ id }) => [id, SoundLab.makeScore(id)]));
  const itinerary = experiments.flatMap((experiment, experimentIndex) =>
    experiment.stops.map((stop, stepIndex) => ({
      experiment, experimentIndex, stop, stepIndex, hash: '#' + experiment.id + '/' + stop.id
    }))
  );
  const voices = [
    ['melody', 'Melody'],
    ['bass', 'Bass'],
    ['pulse', 'Pulse']
  ];
  let current;
  let frame;
  let playback = 'excerpt';

  function create(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function link(hash, text, className) {
    const anchor = create('a', text, className);
    anchor.href = hash;
    return anchor;
  }

  function drawCursor() {
    if (player.state !== 'playing') return;
    const [from, until] = current.stop.window;
    const fraction = Math.min(1, player.elapsed() / (until - from));
    element('plot-area').style.setProperty('--playhead', 100 * fraction + '%');
    frame = requestAnimationFrame(drawCursor);
  }

  const player = createTransport(
    { makeScore: score => score, playScore: SoundLab.playScore },
    () => {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('This browser cannot play the excerpt. The score is available to read.');
      return new Audio();
    },
    (state, detail) => {
      cancelAnimationFrame(frame);
      live.audioState(state);
      const playingNote = playback === 'note';
      inspector.audioState(state, playingNote, detail);
      comparison.audioState(state, playback === 'practice', detail);
      const busy = state === 'pending' || state === 'playing';
      element('play').disabled = busy;
      element('stop').disabled = !busy;
      const trackCursor = state === 'playing' && playback === 'excerpt' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
      element('plot-area').classList.toggle('playing', trackCursor);
      const messages = { playing: playingNote ? 'Playing one note' : 'Playing', pending: 'Starting…', ended: playingNote ? 'Note finished.' : 'Excerpt finished.' };
      element('status').textContent = playback === 'practice' ? '' : messages[state] ?? detail;
      if (trackCursor) drawCursor();
    }
  );
  const live = createLiveNotes(element('live-home'), () => player.elapsed(), slot => {
    player.stop('Stopped to inspect the slot.');
    location.href = 'walkthrough.html' + positionHash({lesson:current.experiment.id, chapter:'add', line:35, slot});
  });
  const inspector = NoteInspector.createInspector(element('note-inspector'), (solo, note) => {
    playback = 'note';
    live.prepare({score:solo, offset:note.time, label:'One '+note.voice+' note'});
    player.play(solo);
  }, () => {
    if (playback === 'note' && ['pending', 'playing'].includes(player.state)) player.stop('Stopped.');
  });
  const comparison = PracticeComparison(element('comparison'), passage => {
    playback = 'practice';
    live.prepare(passage, element('live-practice'));
    player.play(passage.score);
  }, () => player.stop('Stopped.'));

  function drawScore(score, stop) {
    const [from, until] = stop.window;
    const time = stop.slot / 4;
    const percent = value => 100 * (value - from) / (until - from);
    const area = element('plot-area');
    area.style.setProperty('--mark', percent(time) + '%');
    area.style.setProperty('--tick', 100 * .25 / (until - from) + '%');
    const axis = [];
    for (let second = from; second <= until; second++) {
      const tick = create('span', second + 's', 'axis');
      tick.style.left = percent(second) + '%';
      axis.push(tick);
    }
    element('timeline').replaceChildren(...axis);
    const lanes = [];
    const barButtons = new Map();
    for (const [voice, name] of voices) {
      const row = create('div', null, 'score-row');
      const lane = create('div', null, 'lane');
      const { bars, tracks } = layoutVoice(score, voice, from, until);
      lane.style.height = (tracks > 1 ? 3 : 2.25) + 'rem';
      lane.style.setProperty('--voice', 'var(--voice-' + voice + ')');
      for (const bar of bars) {
        const mark = inspector.noteButton(bar.note, 'bar-note');
        barButtons.set(bar.note, mark);
        mark.style.left = percent(bar.start) + '%';
        mark.style.width = (percent(bar.end) - percent(bar.start)) + '%';
        mark.style.top = 100 * (bar.track + .5) / tracks + '%';
        lane.append(mark);
      }
      row.append(create('span', name, 'lane-name'), lane);
      lanes.push(row);
    }
    area.replaceChildren(...lanes);
    const inspected = WalkthroughModel.inspectSlot(score, stop.slot);
    const parts = [
      ...inspected.events.map(event => event.voice + ' starts'),
      ...inspected.continuing.map(event => event.voice + ' continues')
    ];
    const summary = 'Slot ' + stop.slot + ' at ' + time + 's · ' + (parts.join(', ') || 'all voices quiet') + '.';
    element('marked').textContent = summary;
    element('plot').setAttribute('aria-label', 'Score from ' + from + ' to ' + until + ' seconds. ' + summary);
    inspector.show(score, time, WalkthroughData.rules[stop.line]?.[3], barButtons);
    live.mirror(barButtons);
  }

  const experimentLinks = experiments.map((experiment, index) => {
    const anchor = link('#' + experiment.id + '/' + experiment.stops[0].id, null, 'experiment');
    const piece = scores.get(experiment.id);
    anchor.append(create('strong', (index + 1) + '. ' + experiment.name), create('small', experiment.question),
      NoteInspector.scoreOverview(piece), create('span', piece.events.length + ' notes · 60 s', 'overview-count'));
    return anchor;
  });
  element('experiments').replaceChildren(...experimentLinks);

  function render(moveFocus = false) {
    const position = itinerary.findIndex(item => item.hash === location.hash);
    const index = Math.max(0, position);
    const next = itinerary[index];
    if (next === current) return;
    player.stop('');
    const { experiment, experimentIndex, stop, stepIndex } = next;
    if (current?.experiment !== experiment) {
      comparison.render(experiment.id);
      const stopLinks = experiment.stops.map(item => link('#' + experiment.id + '/' + item.id, item.label));
      element('stops').replaceChildren(...stopLinks);
    }
    current = next;
    for (const [i, anchor] of experimentLinks.entries()) {
      if (i === experimentIndex) anchor.setAttribute('aria-current', 'true');
      else anchor.removeAttribute('aria-current');
    }
    for (const anchor of element('stops').children) {
      if (anchor.hash === current.hash) anchor.setAttribute('aria-current', 'step');
      else anchor.removeAttribute('aria-current');
    }
    document.title = stop.title + ' · Week 11 guided listen';
    element('step-count').textContent = experiment.name + ' · Step ' + (stepIndex + 1) + ' of ' + experiment.stops.length;
    element('title').textContent = stop.title;
    element('code').textContent = source[stop.line - 1].trim();
    element('deep').href = 'walkthrough.html' + positionHash({ lesson: experiment.id, chapter: stop.chapter, line: stop.line, slot: stop.slot });
    element('deep').textContent = 'Explore line ' + stop.line + ' ↗';
    element('explanation').textContent = stop.explanation;
    element('listen-for').textContent = stop.listen;
    element('practice').textContent = experiment.homework;
    element('sketch').href = 'sketches/' + experiment.id + '.js';
    element('play').textContent = '▶ Play ' + stop.window[0] + '–' + stop.window[1] + 's';
    element('clip-title').textContent = 'Score · ' + stop.window[0] + '–' + stop.window[1] + ' s';
    live.prepare(guidePassage());
    drawScore(scores.get(experiment.id), stop);
    element('previous').hidden = index === 0;
    element('previous').href = itinerary[Math.max(0, index - 1)].hash;
    const after = itinerary[index + 1];
    element('homework-handoff').hidden = Boolean(after);
    element('next').href = after?.hash ?? 'index.html#notebook';
    element('next').textContent = !after ? 'Continue to your homework →'
      : after.experiment !== experiment ? 'Next experiment →' : 'Next step →';
    if (moveFocus) element('title').focus();
  }

  function guidePassage() {
    const [from, until] = current.stop.window;
    return {score:makeExcerpt(scores.get(current.experiment.id),from,until), offset:from, label:'Guided excerpt', useGuidePlot:true};
  }
  element('play').addEventListener('click', () => {
    playback = 'excerpt';
    const passage = guidePassage();
    live.prepare(passage);
    player.play(passage.score);
  });
  element('stop').addEventListener('click', () => player.stop('Stopped.'));
  document.querySelector('details.practice').addEventListener('toggle', event => {
    if (!event.currentTarget.open && playback === 'practice') {
      if (['playing','pending'].includes(player.state)) player.stop('Stopped.');
      live.prepare(guidePassage());
    }
  });
  window.addEventListener('hashchange', () => { if (location.hash !== '#work') render(true); });
  window.addEventListener('pagehide', () => player.stop(''));
  document.addEventListener('visibilitychange', () => { if (document.hidden) player.stop(''); });
  render();
})();
