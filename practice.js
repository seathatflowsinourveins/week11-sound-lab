(() => {
  'use strict';

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function melodyView(clip, offset, showWave) {
    const notes = clip.events.filter(note => note.voice === 'melody');
    const figure = element('figure', null, 'comparison-figure');
    const canvas = element('canvas', null);
    canvas.width = 550;
    canvas.height = 48;
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#344449';
    ctx.fillRect(0, 23, canvas.width, 1);
    let caption;
    if (showWave) {
      const note = notes[0];
      const rate = 22050;
      const samples = SoundLab.renderPCM(WalkthroughModel.isolateNote(clip, note), { sampleRate: rate });
      // Inspect a steady segment, starting after the attack. Keep the scale identical for both versions.
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x++) {
        const sample = samples[Math.round(rate * (.010 + .010 * x / (canvas.width - 1)))];
        const y = 24 - 20 * sample / note.gain;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#bcdd9e';
      ctx.lineWidth = 2;
      ctx.stroke();
      caption = note.wave + ' wave · ' + Number(note.frequency.toFixed(2)) + ' Hz · 10 ms of the first melody note';
    } else {
      ctx.fillStyle = '#bcdd9e';
      for (const note of notes) {
        ctx.fillRect(canvas.width * note.time / clip.duration, 18, canvas.width * note.duration / clip.duration, 10);
      }
      caption = 'Melody starts at ' + notes.map(note => offset + note.time + 's').join(', ') + '.';
    }
    figure.append(canvas, element('figcaption', caption));
    return figure;
  }

  window.PracticeComparison = function (root, play, stop) {
    let buttons = [], status, active, busy = false;
    function render(id) {
      const practice = WEEK11_PRACTICES[id];
      const [from, until] = practice.window;
      const group = element('div', null, 'comparison-options');
      buttons = [];
      active = null;
      for (const [i, name] of ['Original', 'Edited'].entries()) {
        const clip = practice.clips[i];
        const card = element('section', null, 'comparison-option');
        const label = element('h4', name + ' · Line ' + practice.line);
        const change = element('code', i ? practice.after : practice.before);
        const hear = element('button', 'Play ' + name.toLowerCase());
        hear.type = 'button';
        hear.addEventListener('click', () => {
          if (busy && active === i) { stop(); return; }
          active = i;
          play(clip, name + ' version · ' + from + '–' + until + 's');
        });
        buttons.push(hear);
        card.append(label, change, melodyView(clip, from, id === 'composition'), hear);
        group.append(card);
      }
      const check = element('details', null, 'comparison-result');
      check.append(element('summary', 'Check what changed'), element('p', practice.result));
      status = element('span', '', 'comparison-status');
      status.setAttribute('role', 'status');
      const lineLink = element('a', 'Read line ' + practice.line + ' in composer.js');
      lineLink.href = 'walkthrough.html' + WalkthroughModel.positionHash({
        lesson: id, chapter: 'rules', line: practice.line, slot: from * 4
      });
      if (document.getElementById('source-number')) {
        lineLink.addEventListener('click', event => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          document.getElementById('meaning').focus();
        });
      }
      root.replaceChildren(element('p', practice.question, 'comparison-question'),
        element('p', 'Compare the same passage · ' + from + '–' + until + ' seconds', 'comparison-window'),
        group, status, check, lineLink);
    }
    function audioState(state, isPractice, detail) {
      if (!status) return;
      busy = isPractice && (state === 'pending' || state === 'playing');
      buttons.forEach((button, i) => {
        const name = i ? 'edited' : 'original';
        button.textContent = (busy && active === i ? 'Stop ' : 'Play ') + name;
      });
      const name = active === 1 ? 'Edited' : 'Original';
      status.textContent = !isPractice ? '' : state === 'playing' ? name + ' version playing.'
        : state === 'ended' ? name + ' version finished.' : detail;
    }
    return { render, audioState };
  };
})();
