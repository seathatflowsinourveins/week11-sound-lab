(() => {
  'use strict';

  const rate = 22050;
  const seconds = value => Number(value.toFixed(3));
  const voices = { melody: 'Melody', bass: 'Bass', pulse: 'Pulse' };

  // Keep the full score on one common scale in all three experiment selectors.
  function scoreOverview(score) {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 45;
    canvas.className = 'score-overview';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', score.events.length + ' note starts across 60 seconds. Rows from top to bottom are melody, bass and pulse.');
    const ctx = canvas.getContext('2d');
    const colours = ['#bcdd9e', '#75cccc', '#e9aa8f'];
    const names = Object.keys(voices);
    for (const [i, voice] of names.entries()) {
      ctx.fillStyle = '#384346';
      ctx.fillRect(0, i * 15 + 7, 600, 1);
      ctx.fillStyle = colours[i];
      for (const note of score.events.filter(event => event.voice === voice)) {
        ctx.fillRect(note.time * 10, i * 15 + 4, note.duration * 10, 7);
      }
    }
    return canvas;
  }

  function createInspector(root, onAudition, stopAudition) {
    root.innerHTML = '<div class="inspector-head"><label>Inspect a note<select></select></label>'
      + '<button type="button" class="solo-note">Hear this note</button></div>'
      + '<p class="note-reading" aria-live="polite"></p><p class="solo-error" role="status"></p>'
      + '<div class="scope-view"><div class="scope-tools"><strong>Waveform</strong>'
      + '<div role="group" aria-label="Waveform time scale"><button type="button" data-view="detail">First 20 ms</button>'
      + '<button type="button" data-view="whole">Whole note</button></div></div>'
      + '<canvas class="note-wave" role="img"></canvas><div class="scope-axis"><span>Note starts · 0</span><span class="scope-end"></span></div>'
      + '<p class="wave-caption"></p></div>';
    const select = root.querySelector('select');
    const hear = root.querySelector('.solo-note');
    const canvas = root.querySelector('.note-wave');
    const scope = root.querySelector('.scope-view');
    const reading = root.querySelector('.note-reading');
    const modes = [...root.querySelectorAll('[data-view]')];
    let score, marker, preferredVoice, selected, solo, samples;
    let auditioning = false;
    let buttons = new Map();
    let notes = [];
    let view = 'detail';

    function plot() {
      if (!selected || !samples) return;
      const width = Math.max(1, Math.round(canvas.clientWidth * devicePixelRatio));
      const height = Math.max(1, Math.round(canvas.clientHeight * devicePixelRatio));
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const count = view === 'whole' ? samples.length : Math.min(samples.length, Math.round(.02 * rate));
      const y = sample => height * (.5 - .45 * sample / .12);
      ctx.lineWidth = devicePixelRatio;
      ctx.strokeStyle = '#324348';
      ctx.beginPath();
      for (let tick = 1; tick < 8; tick++) {
        ctx.moveTo(tick * width / 8, 0);
        ctx.lineTo(tick * width / 8, height);
      }
      ctx.moveTo(0, y(0)); ctx.lineTo(width, y(0));
      ctx.stroke();
      ctx.strokeStyle = getComputedStyle(root).getPropertyValue('--voice-' + selected.voice).trim();
      ctx.beginPath();
      if (view === 'detail' || count <= width) {
        ctx.lineWidth = 1.7 * devicePixelRatio;
        for (let i = 0; i < count; i++) {
          const x = i * width / (count - 1);
          if (i === 0) ctx.moveTo(x, y(samples[i]));
          else ctx.lineTo(x, y(samples[i]));
        }
      } else {
        // Preserve the smallest and largest PCM samples in each display column.
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x++) {
          let min = Infinity, max = -Infinity;
          const end = Math.floor((x + 1) * count / width);
          for (let i = Math.floor(x * count / width); i < end; i++) {
            min = Math.min(min, samples[i]);
            max = Math.max(max, samples[i]);
          }
          ctx.moveTo(x + .5, y(min)); ctx.lineTo(x + .5, y(max));
        }
      }
      ctx.stroke();
      const range = view === 'detail' ? '20 ms' : seconds(selected.duration) + ' s';
      root.querySelector('.scope-end').textContent = range;
      root.querySelector('.wave-caption').textContent = view === 'detail'
        ? 'Each cycle is one vibration. More cycles in 20 milliseconds mean a higher pitch.'
        : 'The height shows the size of the vibrations. Watch them shrink as the note fades.';
      canvas.setAttribute('aria-label', selected.frequency + ' Hz ' + selected.wave + ' wave, ' + range + ' from the start of the selected note.');
      modes.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
    }

    function choose(note) {
      const changed = selected !== note;
      if (changed) stopAudition();
      selected = note;
      select.value = String(notes.indexOf(note));
      for (const [event, button] of buttons) button.setAttribute('aria-pressed', String(event === note));
      hear.disabled = !note;
      scope.hidden = !note;
      if (!note) {
        solo = samples = null;
        reading.textContent = notes.length ? 'This slot is quiet. Select a nearby note to explore it.' : 'This part of the score is silent.';
        return;
      }
      if (changed || !samples) {
        solo = WalkthroughModel.isolateNote(score, note);
        samples = SoundLab.renderPCM(solo, { sampleRate: rate });
      }
      reading.textContent = voices[note.voice] + ' starts at ' + seconds(note.time) + ' s and lasts '
        + seconds(note.duration) + ' s. Its pitch is ' + seconds(note.frequency) + ' Hz, with a ' + note.wave + ' wave.';
      plot();
    }

    function show(piece, time, voice, barButtons) {
      const keep = piece === score && time === marker && voice === preferredVoice && barButtons.has(selected);
      score = piece; marker = time; preferredVoice = voice; buttons = barButtons;
      notes = piece.events.filter(note => buttons.has(note));
      const next = keep ? selected : WalkthroughModel.noteAtMarker(piece, time, voice);
      select.replaceChildren();
      if (!next) select.add(new Option('Quiet at this slot', '-1'));
      notes.forEach((note, i) => select.add(new Option(voices[note.voice] + ' · ' + seconds(note.time) + ' s', String(i))));
      select.disabled = !notes.length;
      choose(next);
    }
    function noteButton(note, className) {
      const button = document.createElement('button');
      button.type = 'button';
      button.tabIndex = -1; // The labeled select exposes the same notes in time order for keyboard users.
      button.className = className;
      button.setAttribute('aria-label', 'Inspect ' + note.voice + ' at ' + seconds(note.time) + ' seconds');
      button.addEventListener('click', () => choose(note));
      return button;
    }
    select.addEventListener('change', () => choose(notes[Number(select.value)] ?? null));
    function audioState(state, isSolo, detail) {
      auditioning = isSolo && (state === 'pending' || state === 'playing');
      hear.textContent = auditioning ? 'Stop note' : 'Hear this note';
      root.querySelector('.solo-error').textContent = isSolo && state === 'error' ? detail : '';
    }
    hear.addEventListener('click', () => {
      if (auditioning) stopAudition();
      else if (solo) onAudition(solo, selected);
    });
    for (const button of modes) button.addEventListener('click', () => { view = button.dataset.view; plot(); });
    new ResizeObserver(() => plot()).observe(canvas);
    return { show, noteButton, audioState };
  }
  window.NoteInspector = { createInspector, scoreOverview };
})();
