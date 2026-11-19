// One note every two seconds, with occasional soft noise in the gaps.
const SOLO_DURATION = 60;
const SOLO_RATE = 22050;
const SOLO_SEED = 0;
const SOLO_PITCHES = [262, 294, 330, 392];

function makeSoloPlan() {
  randomSeed(SOLO_SEED);
  const notes = [];
  for (let time = 0; time < SOLO_DURATION; time += 2) {
    notes.push({
      time,
      frequency: random(SOLO_PITCHES),
      breathDuration: random() < 0.45 ? random(0.35, 0.65) : 0
    });
  }
  return notes;
}

// A short fade at both ends keeps the tone and noise from clicking.
function addSoloSound(pcm, time, duration, wave) {
  const start = Math.round(time * SOLO_RATE);
  const length = Math.round(duration * SOLO_RATE);
  for (let sample = 0; sample < length; sample++) {
    const local = sample / SOLO_RATE;
    const envelope = Math.min(1, local / 0.04, (length - 1 - sample) / SOLO_RATE / 0.12);
    pcm[start + sample] += envelope * wave(local);
  }
}

function renderSolo(notes, includeNoise) {
  randomSeed(SOLO_SEED);
  const pcm = new Float32Array(SOLO_DURATION * SOLO_RATE);
  for (const note of notes) {
    addSoloSound(pcm, note.time, 0.6, t => 0.13 * Math.sin(2 * Math.PI * note.frequency * t));
    if (!includeNoise || !note.breathDuration) continue;
    let smoothNoise = 0;
    addSoloSound(pcm, note.time + 0.8, note.breathDuration, () => {
      smoothNoise += 0.12 * (random(-1, 1) - smoothNoise);
      return smoothNoise * 0.17;
    });
  }
  return pcm;
}

function playSolo(context, pcm, { onEnd }) {
  const buffer = context.createBuffer(1, pcm.length, SOLO_RATE);
  buffer.copyToChannel(pcm, 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.onended = () => {
    source.disconnect();
    onEnd();
  };
  const startTime = context.currentTime + 0.06;
  source.start(startTime);
  return { startTime, stop() {
    source.onended = null;
    source.stop();
    source.disconnect();
  } };
}

function setup() {
  noCanvas();
  noLoop();
  const melodyOnly = new URLSearchParams(window.location.search).has('melody-only');
  const mount = (element, id) => {
    const target = document.getElementById(id);
    if (target) element.parent(target);
    return element;
  };
  const description = document.getElementById('solo-description');
  if (melodyOnly && description) description.textContent = 'A wandering melody. One note every two seconds.';
  const play = mount(createButton('Play 60 seconds'), 'solo-controls');
  const stop = mount(createButton('Stop'), 'solo-controls');
  const status = mount(createP('Ready.'), 'solo-status');
  const clock = mount(createP('0:00 / 1:00'), 'solo-clock');
  status.elt.setAttribute('role', 'status');
  const engine = { makeScore: () => renderSolo(makeSoloPlan(), !melodyOnly), playScore: playSolo };
  let timer;
  const player = createTransport(engine, () => new AudioContext(), (state, detail) => {
    const playing = state === 'playing';
    play.elt.disabled = playing || state === 'pending';
    stop.elt.disabled = state !== 'pending' && !playing;
    status.elt.textContent = playing ? 'Playing.' : detail;
    clearInterval(timer);
    const updateClock = () => {
      const seconds = Math.floor(player.elapsed());
      clock.elt.textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') + ' / 1:00';
    };
    updateClock();
    if (playing) timer = setInterval(updateClock, 200);
  });
  play.elt.classList.add('primary');
  stop.elt.disabled = true;
  play.mouseClicked(() => player.play('solo'));
  stop.mouseClicked(() => player.stop());
  window.addEventListener('pagehide', () => player.stop());
}
