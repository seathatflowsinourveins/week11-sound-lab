(() => {
  'use strict';

  const { layoutVoice, nearestPitch, playbackMoment } = WalkthroughModel;
  const number = value => String(Number(value.toFixed(3)));
  const seconds = value => number(value) + 's';
  const pitch = note => '≈ ' + nearestPitch(note.frequency) + ' · ' + number(note.frequency) + ' Hz';

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  window.createLiveNotes = function (home, elapsed, inspectSlot, followSlot) {
    const panel = element('div', null, 'live-manifest');
    panel.innerHTML = '<div class="live-heading"><div><h3>Live note manifest</h3><p class="live-passage"></p></div>'
      + '<div class="live-time"><span class="live-state"></span><strong role="timer" aria-label="Score time"></strong></div></div>'
      + '<div class="live-roll" aria-hidden="true"></div><div class="live-axis" aria-hidden="true"></div>'
      + '<div class="live-readout"><div><h4>Sounding now</h4><ul></ul></div><div><h4>Up next</h4><p class="live-next"></p></div></div>'
      + '<div class="live-actions"><button type="button" class="live-trace">Inspect this slot</button>'
      + '<details><summary>Note schedule</summary><div class="live-record"><h4>Sounding note objects</h4>'
      + '<pre tabindex="0" aria-label="Currently sounding note records"><code>[]</code></pre></div><div class="live-table-wrap" tabindex="0" role="region" aria-label="Passage note schedule"><table><caption></caption>'
      + '<thead><tr><th scope="col">Voice</th><th scope="col">Start</th><th scope="col">End</th><th scope="col">Pitch · wave</th></tr></thead>'
      + '<tbody></tbody></table></div><a class="manifest-download">Download this passage’s note manifest (JSON)</a></details></div>';
    const find = selector => panel.querySelector(selector);
    const timer = find('[role=timer]'), badge = find('.live-state'), roll = find('.live-roll');
    const now = find('ul'), nextText = find('.live-next'), trace = find('button');
    const jump = element('a','View the note manifest for this playback');
    panel.id = 'playing-notes';
    jump.href = '#playing-notes';
    jump.addEventListener('click', event => {
      event.preventDefault();
      panel.focus();
    });
    panel.tabIndex = -1;
    let request, frame, position = 0, status = 'ready', previousKey, workflowKey, highlighted = [];
    let marks = new Map(), rows = new Map(), mirrored = [];
    let records = new Map(), downloadUrl;
    home.append(panel);

    function paint(local) {
      position = Math.min(request.score.duration, local);
      const moment = playbackMoment(request.score, position, request.offset);
      const active = status === 'playing' && local > 0;
      const sounding = active ? moment.sounding : [];
      const upcoming = !active && position === 0 && status !== 'ended'
        ? request.score.events.filter(note => note.time === request.score.events[0]?.time)
        : moment.next;
      timer.textContent = moment.time.toFixed(2) + ' s';
      trace.textContent = 'Inspect slot ' + moment.slot;
      trace.disabled = status === 'pending' || position >= request.score.duration;
      roll.style.setProperty('--live-position', (100 * position / request.score.duration) + '%');
      const key = [status, ...sounding.map(note => request.score.events.indexOf(note)), '/', upcoming[0]?.time].join(' ');
      if (followSlot) {
        const slot = active && request.traceWorkflow && position < request.score.duration ? moment.slot : null;
        const keyAtSlot = slot === null ? 'manual' : slot + ':' + key;
        if (workflowKey !== keyAtSlot) {
          workflowKey = keyAtSlot;
          followSlot(slot, sounding);
        }
      }
      if (previousKey === key) return;
      previousKey = key;
      find('.live-record code').textContent = JSON.stringify(sounding.map(note=>records.get(note)),null,2);
      for (const node of highlighted) node.classList.remove('live-on');
      highlighted = [];
      for (const note of sounding) {
        const scoreTime = request.offset + note.time;
        const matches = request.edited ? [] : mirrored.filter(([event]) => event.time === scoreTime && event.voice === note.voice);
        for (const node of [marks.get(note), rows.get(note), ...matches.map(([,node])=>node)]) {
          if (node) { node.classList.add('live-on'); highlighted.push(node); }
        }
      }
      const waiting = status === 'ended' ? 'Finished.' : status === 'idle' ? 'Stopped.'
        : status === 'error' ? 'Audio unavailable.' : status === 'playing' && position > 0 ? 'Rest · no note is sounding.' : 'Waiting for sound.';
      now.replaceChildren(...(sounding.length ? sounding.map(note => {
        const item = element('li', null);
        item.append(element('b', note.voice), document.createTextNode(' · ' + pitch(note) + ' · ' + note.wave),
          element('small', seconds(request.offset + note.time) + '–' + seconds(request.offset + note.time + note.duration)));
        return item;
      }) : [element('li', waiting)]));
      if (!sounding.length && position > 0) {
        const last = request.score.events.findLast(note=>note.time < position);
        if (last) {
          const voices = request.score.events.filter(note=>note.time === last.time)
            .map(note=>note.voice + ' ' + nearestPitch(note.frequency));
          now.firstChild.append(element('small','Last start '+seconds(request.offset+last.time)+' · '+voices.join(' + ')));
        }
      }
      nextText.textContent = upcoming.length
        ? seconds(request.offset + upcoming[0].time) + ' · ' + upcoming.map(note => note.voice + ' ' + nearestPitch(note.frequency)).join(' + ')
        : 'No later starts in this passage.';
    }

    function tick() {
      paint(elapsed());
      frame = requestAnimationFrame(tick);
    }
    function audioState(state) {
      cancelAnimationFrame(frame);
      if (!request) return;
      status = state;
      badge.textContent = ({ ready:'Ready', idle:'Stopped', pending:'Starting', playing:'Playing', ended:'Finished', error:'Audio unavailable' })[state];
      panel.dataset.state = state;
      if (state === 'playing') tick();
      else paint(state === 'ended' ? request.score.duration : position);
    }

    function prepare(passage, mount = home) {
      cancelAnimationFrame(frame);
      request = passage;
      position = 0;
      previousKey = undefined;
      const { score, offset, label } = request;
      if (mount !== home) home.replaceChildren(jump);
      else jump.remove();
      mount.append(panel);
      panel.classList.toggle('use-guide-plot', Boolean(request.useGuidePlot));
      find('.live-passage').textContent = label + ' · ' + seconds(offset) + '–' + seconds(offset + score.duration);
      trace.hidden = !inspectSlot || Boolean(request.edited);
      marks = new Map();
      rows = new Map();
      records = new Map(score.events.map(note=>[note,{...note,time:offset+note.time}]));
      const manifest = {experiment:score.id, passage:label, start:offset, end:offset+score.duration,
        timeUnit:'seconds from score start', events:[...records.values()]};
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest,null,2)+'\n'],{type:'application/json'}));
      const download = find('.manifest-download');
      download.href = downloadUrl;
      download.download = score.id+'-'+label.toLowerCase().replaceAll(' ','-')+'-'+number(offset)+'s.json';
      roll.replaceChildren();
      for (const voice of ['melody','bass','pulse']) {
        const { bars, tracks } = layoutVoice(score, voice, 0, score.duration);
        if (!bars.length) continue;
        const lane = element('div', null, 'live-lane');
        lane.style.setProperty('--live-ink', 'var(--voice-' + voice + ')');
        lane.style.height = (1.15 + tracks * .5) + 'rem';
        for (const { note, start, end, track } of bars) {
          const mark = element('i', null);
          mark.style.left = 100 * start / score.duration + '%';
          mark.style.width = 100 * (end-start) / score.duration + '%';
          mark.style.top = 100 * (track+.5) / tracks + '%';
          lane.append(mark);
          marks.set(note, mark);
        }
        roll.append(element('span', voice), lane);
      }
      find('.live-axis').replaceChildren(...[0,.5,1].map(frac=>element('span', seconds(offset + score.duration * frac))));
      find('summary').textContent = 'Note schedule · ' + score.events.length + (score.events.length === 1 ? ' note' : ' notes');
      find('caption').textContent = 'Notes in this passage. Times are seconds from the beginning of the piece.';
      find('tbody').replaceChildren(...score.events.map(note => {
        const row = element('tr', null);
        for (const value of [note.voice, seconds(offset+note.time), seconds(offset+note.time+note.duration), pitch(note)+' · '+note.wave]) row.append(element('td',value));
        rows.set(note,row);
        return row;
      }));
      audioState('ready');
    }
    trace.addEventListener('click', () => {
      if (request && inspectSlot) inspectSlot(playbackMoment(request.score, position, request.offset).slot);
    });
    function mirror(buttons) {
      mirrored = [...buttons];
      previousKey = undefined;
      if (request) paint(position);
    }
    return { prepare, audioState, mirror };
  };
})();
