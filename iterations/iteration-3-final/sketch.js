let ratios = [1, 1.125, 1.25, 1.5, 1.67, 2];
let BASE = 261.63;
let osc, bass, reverb;
let startTime = -1;
let nextNote = 0;
let nextBass = 1.5;
let wasRest = false;
let bassRest = false;
let fading = false;
let t = 0;

function setup() {
  createCanvas(400, 400);
  background(255);
  randomSeed(0);
  noiseSeed(0);

  reverb = new p5.Reverb(3);
  reverb.wet(0.5);

  osc = new p5.Oscillator('triangle');
  osc.freq(BASE);
  osc.amp(0.0001, 0.01);
  osc.disconnect();
  osc.connect(reverb);

  bass = new p5.Oscillator('sine');
  bass.freq(BASE * 0.5);
  bass.amp(0.0001, 0.01);
  bass.disconnect();
  bass.connect(reverb);

  osc.start();
  bass.start();
}

function mousePressed() {
  userStartAudio();
  getAudioContext().resume();
}

function keyPressed() {
  mousePressed();
}

function draw() {
  if (getAudioContext().state !== 'running') return;
  if (startTime < 0) startTime = millis();
  let sec = (millis() - startTime) / 1000;

  if (!fading && sec >= 58) {
    fading = true;
    osc.amp(0.0001, 1.9);
    bass.amp(0.0001, 1.9);
  }
  if (sec >= 60) {
    osc.stop();
    bass.stop();
    noLoop();
    return;
  }

  // ~10s calm intro, active middle (10-50s), ~10s calm outro
  let chaos = 0;
  if (sec < 10) chaos = map(sec, 0, 10, 0, 0.35);
  else if (sec < 30) chaos = map(sec, 10, 30, 0.35, 1);
  else if (sec < 50) chaos = map(sec, 30, 50, 1, 0.35);
  else chaos = map(sec, 50, 60, 0.35, 0);

  // Main voice: blends noise() and random(), brief rests only (< 0.4s)
  if (sec >= nextNote && sec < 58) {
    let shift = random(-0.05, 0.06) * chaos;
    nextNote += max(0.09, lerp(0.36, 0.14, chaos) + shift);

    if (!wasRest && random(1) < 0.22) {
      wasRest = true;
      osc.amp(0.0001, 0.15);
    } else {
      wasRest = false;
      let r;
      if (random(1) < chaos) {
        r = random(ratios);
      } else {
        t += 0.3;
        r = ratios[floor(noise(t) * ratios.length)];
      }
      let oct = random(1) < chaos * 0.35 ? random([0.5, 2]) : 1;
      osc.freq(BASE * r * oct, 0.03);
      osc.amp(random(0.12, 0.22), 0.04);
    }
  }

  // Second voice: slow bass, sometimes chimes high in the middle
  if (sec >= nextBass && sec < 56) {
    nextBass += random(0.8, 1.5);
    if (!bassRest && random(1) < 0.25) {
      bassRest = true;
      bass.amp(0.0001, 0.3);
    } else {
      bassRest = false;
      let oct = chaos > 0.65 && random(1) < 0.35 ? 2 : 0.5;
      bass.freq(BASE * random(ratios) * oct, 0.05);
      bass.amp(oct === 2 ? 0.1 : 0.18, 0.08);
    }
  }
}
