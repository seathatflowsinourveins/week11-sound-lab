(() => {
  'use strict';

  window.createMelodyMap = function (root, pulse, play, stop, elapsed) {
    const { melodyOpening, pitchAt, isolateNote } = WalkthroughModel;
    const { motif, ratios } = pitchAt(pulse, 0);
    const original = motif.slice(0, 4);
    const values = original.slice();
    const rootHz = pulse.events[0].frequency;
    const number = value => Number(value.toFixed(3));
    const find = selector => root.querySelector(selector);
    const plot = find('.melody-plot'), select = find('select'), reset = find('.map-reset');
    const phrase = find('[data-hear=phrase]'), solo = find('[data-hear=solo]'), message = find('.map-playing');
    let selected = 1;
    let clip, mode, frame, busy = false, lastSound = -1;

    function wave(note) {
      const canvas = find('canvas'), ctx = canvas.getContext('2d');
      const rate = 22050;
      const samples = SoundLab.renderPCM(isolateNote(clip,note),{sampleRate:rate});
      const first = Math.round(.01 * rate), length = Math.round(.012 * rate);
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#415351';
      ctx.fillRect(0,canvas.height / 2,canvas.width,1);
      ctx.beginPath();
      for (let i = 0; i < length; i++) {
        const x = i * canvas.width / (length - 1);
        const y = canvas.height * (.5 - .39 * samples[first + i] / note.gain);
        if (i === 0) ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
      }
      ctx.strokeStyle = '#f2c389';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      canvas.setAttribute('aria-label', '12 milliseconds of a '+number(note.frequency)+' Hz sine tone.');
    }

    function refresh() {
      clip = melodyOpening(pulse, values);
      const note = clip.events[selected], degree = values[selected];
      for (const [i,button] of [...plot.children].entries()) {
        const event = clip.events[i];
        button.querySelector('.map-digit').textContent = values[i];
        button.querySelector('.map-time').textContent = event.time + 's';
        button.setAttribute('aria-pressed', String(i === selected));
        button.setAttribute('aria-label', 'Note '+(i+1)+', number '+values[i]+', '+number(event.frequency)+' Hz at '+event.time+' seconds');
        const bar = button.querySelector('.map-tone');
        button.querySelector('.map-track').style.setProperty('--pitch-height', (12 + 62 * (event.frequency / rootHz - 1)) + '%');
        button.querySelector('.map-hz').textContent = number(event.frequency)+' Hz';
        const endOfColumn = clip.events[i + 1]?.time ?? clip.duration;
        bar.style.width = 100 * event.duration / (endOfColumn - event.time) + '%';
      }
      select.value = String(degree);
      for (const row of root.querySelectorAll('.map-table tr')) {
        [...row.querySelectorAll('td')].forEach((cell,i)=>cell.classList.toggle('map-picked', i === degree));
      }
      find('.map-note').textContent = 'Inside note '+(selected+1)+' · starts at '+note.time+'s';
      const ordinal = ['first','second','third','fourth','fifth','sixth','seventh','eighth'][degree];
      find('.map-lookup').textContent = 'Count from zero. Position '+degree+' picks the '+ordinal+' entry in RATIOS, which is '+ratios[degree]+'.';
      find('.map-equation').textContent = rootHz+' × '+ratios[degree]+' = '+number(note.frequency)+' Hz';
      wave(note);
      find('.map-vibration').textContent = 'The oscillator repeats this wave '+number(note.frequency)+' times per second. The drawing shows 12 milliseconds.';
      reset.disabled = values.every((value,i)=>value === original[i]);
      find('.map-pattern-title').textContent = reset.disabled ? 'First four numbers in MOTIF' : 'Your edited four-note pattern';
      solo.textContent = 'Hear note '+(selected+1);
    }

    function clearSound() {
      if (lastSound >= 0) plot.children[lastSound].classList.remove('map-sounding');
      lastSound = -1;
    }
    function tick() {
      const local = elapsed();
      const time = mode === 'solo' ? clip.events[selected].time + local : local;
      const i = local > 0 ? clip.events.findIndex(note=>note.time <= time && time < note.time + note.duration) : -1;
      if (i !== lastSound) {
        clearSound();
        if (i !== -1) {
          lastSound = i;
          plot.children[i].classList.add('map-sounding');
          message.textContent = 'Sounding · note '+(i+1)+' · '+number(clip.events[i].frequency)+' Hz';
        } else message.textContent = 'Rest';
      }
      frame = requestAnimationFrame(tick);
    }
    function audioState(state, isMap, detail) {
      cancelAnimationFrame(frame);
      busy = isMap && (state === 'playing' || state === 'pending');
      phrase.textContent = busy && mode === 'phrase' ? 'Stop four notes' : 'Play four notes';
      solo.textContent = busy && mode === 'solo' ? 'Stop note' : 'Hear note '+(selected+1);
      if (state === 'playing' && isMap) {
        message.textContent = 'Starting…';
        tick();
      } else {
        clearSound();
        message.textContent = !isMap ? '' : state === 'ended' ? 'Finished.' : detail;
      }
    }
    function interrupt() {
      if (busy) stop();
    }
    function audition(kind) {
      if (busy && mode === kind) { stop(); return; }
      mode = kind;
      const note = clip.events[selected];
      const one = kind === 'solo';
      play({
        score: one ? isolateNote(clip,note) : clip, offset:one ? note.time : 0,
        label:one ? 'Melody map · note '+(selected+1) : 'Melody map · four notes',
        edited:values.some((value,i)=>value !== original[i])
      });
    }
    for (const [i] of original.entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = '<span class="map-digit"></span><span class="map-track"><span class="map-hz"></span><i class="map-tone"></i></span><span class="map-time"></span>';
      button.addEventListener('click', () => {interrupt();selected = i;refresh();});
      plot.append(button);
    }
    ratios.forEach((_,i)=>select.add(new Option(i,i)));
    for (const [label,items] of [['Position',ratios.map((_,i)=>i)], ['Ratio',ratios]]) {
      const row = find('tbody').insertRow();
      const header = document.createElement('th');
      header.scope = 'row'; header.textContent = label; row.append(header);
      for (const value of items) row.insertCell().textContent = value;
    }
    select.addEventListener('change', () => {interrupt();values[selected] = Number(select.value);refresh();});
    reset.addEventListener('click', () => {interrupt();values.splice(0,values.length,...original);refresh();select.focus();});
    phrase.addEventListener('click',()=>audition('phrase'));
    solo.addEventListener('click',()=>audition('solo'));
    refresh();
    return { audioState, show(visible) { if (!visible) interrupt(); root.hidden = !visible; } };
  };
})();
