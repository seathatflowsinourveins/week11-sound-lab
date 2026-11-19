let ratios = [1, 1.125, 1.25, 1.5, 1.67, 2];
let BASE = 261.63;
let osc;
let startTime = -1;
let nextNote = 0;
let fading = false;

function setup() {
  createCanvas(400, 400);
  background(255);
  randomSeed(0);

  osc = new p5.Oscillator('sine');
  osc.freq(BASE);
  osc.amp(0.2);
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

  if (!fading && sec >= 58.5) {
    fading = true;
    osc.amp(0.0001, 1.4);
  }
  if (sec >= 60) {
    osc.stop();
    noLoop();
    return;
  }

  if (sec >= nextNote && sec < 58.5) {
    nextNote += 0.25;
    osc.freq(BASE * random(ratios));
  }
}
