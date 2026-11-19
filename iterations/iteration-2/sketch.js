let ratios = [1, 1.125, 1.25, 1.5, 1.67, 2];
let BASE = 261.63;
let osc;
let startTime = -1;
let nextNote = 0;
let wasRest = false;
let fading = false;
let t = 0;

function setup() {
  createCanvas(400, 400);
  background(255);
  randomSeed(0);
  noiseSeed(0);

  osc = new p5.Oscillator('sine');
  osc.freq(BASE);
  osc.amp(0.0001, 0.01);
  osc.start();
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
    osc.amp(0.0001, 1.8);
  }
  if (sec >= 60) {
    osc.stop();
    noLoop();
    return;
  }

  // ~10s calm intro, active middle (10-50s), ~10s calm outro
  let chaos = 0;
  if (sec < 10) chaos = map(sec, 0, 10, 0, 0.35);
  else if (sec < 30) chaos = map(sec, 10, 30, 0.35, 1);
  else if (sec < 50) chaos = map(sec, 30, 50, 1, 0.35);
  else chaos = map(sec, 50, 60, 0.35, 0);

  if (sec >= nextNote && sec < 58) {
    nextNote += lerp(0.36, 0.14, chaos);

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
      osc.amp(0.2, 0.04);
    }
  }
}
