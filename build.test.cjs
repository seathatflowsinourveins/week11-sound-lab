'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const engine = require('./composer.js');
const root = __dirname;
const dist = path.join(root, 'dist');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = name => fs.readFileSync(path.join(dist, name));

// One build for this suite. These checks never run the notebook or access browser storage.
const built = spawnSync(process.execPath, ['scripts/build.cjs'], { cwd: root, encoding: 'utf8', timeout: 30000 });

test('Native build completes and every manifest entry matches the delivered bytes', () => {
  assert.equal(built.error, undefined, built.error && built.error.message);
  assert.equal(built.status, 0, built.stdout + built.stderr);
  const report = JSON.parse(built.stdout);
  const manifest = JSON.parse(read('release.json'));
  assert.equal(report.release, manifest.release);
  assert.match(manifest.release, /^[a-f0-9]{16}$/);
  const names = new Set();
  for (const file of manifest.files) {
    assert.ok(!names.has(file.path), 'Duplicate manifest path: ' + file.path);
    assert.ok(!file.path.startsWith('/') && !file.path.split('/').includes('..'));
    names.add(file.path);
    const bytes = read(file.path);
    assert.equal(bytes.length, file.bytes, file.path + ' size');
    assert.equal(hash(bytes), file.sha256, file.path + ' hash');
  }
  function filesAt(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const full = path.join(directory, entry.name);
      return entry.isDirectory() ? filesAt(full) : [path.relative(dist, full).split(path.sep).join('/')];
    });
  }
  assert.deepEqual(filesAt(dist).sort(), [...names, 'release.json'].sort());
  for (const name of names) assert.ok(!/(?:^|\/)(?:evidence|notebook|class-wiki)(?:\/|\.)/.test(name), 'Private content in deployment: ' + name);
});

test('Three delivered WAV files and score records have verified duration, content and repeatability', () => {
  assert.equal(built.status, 0, built.stderr);
  const results = JSON.parse(read('results.json'));
  assert.equal(results.experiments.length, 3);
  for (const { id } of engine.experiments) {
    const score = JSON.parse(read('scores/' + id + '.json'));
    assert.deepEqual(score, engine.makeScore(id));
    assert.deepEqual(score, engine.makeScore(id));
    const wav = read('audio/' + id + '.wav');
    const result = results.experiments.find(item => item.id === id);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.readUInt32LE(4), wav.length - 8);
    assert.equal(wav.toString('ascii', 8, 16), 'WAVEfmt ');
    assert.equal(wav.readUInt32LE(16), 16);
    assert.equal(wav.readUInt16LE(20), 1);
    assert.equal(wav.readUInt16LE(22), 1);
    assert.equal(wav.readUInt32LE(24), 22050);
    assert.equal(wav.readUInt32LE(28), 44100);
    assert.equal(wav.readUInt16LE(32), 2);
    assert.equal(wav.readUInt16LE(34), 16);
    assert.equal(wav.toString('ascii', 36, 40), 'data');
    assert.equal(wav.readUInt32LE(40), 60 * 22050 * 2);
    assert.equal(wav.length, 44 + 60 * 22050 * 2);
    assert.equal(wav.readInt16LE(44), 0);
    assert.equal(wav.readInt16LE(wav.length - 2), 0);
    let peak = 0, nonzero = 0;
    for (let i = 44; i < wav.length; i += 2) {
      const sample = wav.readInt16LE(i);
      peak = Math.max(peak, Math.abs(sample) / 32768);
      if (sample !== 0) nonzero += 1;
    }
    assert.ok(nonzero > 0 && peak > 0 && peak < 1);
    assert.equal(result.peak, peak);
    assert.equal(result.nonzeroSamples, nonzero);
    assert.equal(result.wavDuration, 60);
    assert.equal(result.eventCount, score.events.length);
    assert.equal(result.scoreSHA256, hash(JSON.stringify(score)));
    assert.equal(result.wavSHA256, hash(wav));
    assert.ok(result.scoreIdentical && result.wavIdentical);
    assert.ok(wav.equals(Buffer.from(engine.renderWav(engine.makeScore(id)))));
  }
});

test('Every local HTML asset and navigation destination resolves inside the delivered site', () => {
  assert.equal(built.status, 0, built.stderr);
  for (const filename of ['index.html', 'performance.html', 'walkthrough.html']) {
    const html = read(filename).toString('utf8');
    const references = [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]);
    assert.ok(references.length > 0);
    for (const reference of references) {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(reference)) continue;
      const parsed = new URL(reference, 'https://local.test/' + filename);
      const target = path.resolve(dist, decodeURIComponent(parsed.pathname).replace(/^\/+/, ''));
      assert.ok(target.startsWith(dist + path.sep), 'Local path leaves deployment: ' + reference);
      assert.ok(fs.existsSync(target) && fs.statSync(target).isFile(), filename + ' has a missing local target: ' + reference);
      if (parsed.hash && path.extname(target) === '.html') {
        const destination = fs.readFileSync(target, 'utf8');
        const ids = [...destination.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]);
        assert.ok(ids.includes(decodeURIComponent(parsed.hash.slice(1))), 'Missing destination anchor: ' + reference);
      }
    }
  }
});

test('the walkthrough joins the existing landing and publishes exact composer source', () => {
  assert.equal(built.status, 0, built.stderr);
  assert.match(read('index.html').toString('utf8'), /href="walkthrough\.html"/);
  const page = read('walkthrough.html').toString('utf8');
  assert.match(page, /id="lines"/);
  assert.match(page, /id="focus-visual"/);
  assert.match(page, /href="index\.html#notebook"/);
  const source = vm.runInNewContext(read('walkthrough-source.js').toString('utf8') + '\nWALKTHROUGH_SOURCE');
  assert.equal(source, fs.readFileSync(path.join(root, 'composer.js'), 'utf8'));
});

// An independent table-based checksum validates the stored archive's local and central headers.
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  return crc >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}
function parseStoredZip(bytes) {
  const footer = bytes.length - 22;
  assert.equal(bytes.readUInt32LE(footer), 0x06054b50);
  assert.equal(bytes.readUInt16LE(footer + 4), 0);
  assert.equal(bytes.readUInt16LE(footer + 6), 0);
  assert.equal(bytes.readUInt16LE(footer + 20), 0);
  const count = bytes.readUInt16LE(footer + 10);
  assert.equal(bytes.readUInt16LE(footer + 8), count);
  const centralStart = bytes.readUInt32LE(footer + 16);
  assert.equal(centralStart + bytes.readUInt32LE(footer + 12), footer);
  const entries = new Map();
  let offset = 0;
  while (offset < centralStart) {
    const localOffset = offset;
    assert.equal(bytes.readUInt32LE(offset), 0x04034b50);
    assert.equal(bytes.readUInt16LE(offset + 6), 0, 'Stored entries must not use data descriptors');
    assert.equal(bytes.readUInt16LE(offset + 8), 0);
    const checksum = bytes.readUInt32LE(offset + 14);
    const size = bytes.readUInt32LE(offset + 18);
    assert.equal(size, bytes.readUInt32LE(offset + 22));
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const name = bytes.toString('utf8', offset + 30, offset + 30 + nameLength);
    assert.ok(!entries.has(name) && !name.startsWith('/') && !name.split('/').includes('..'));
    offset += 30 + nameLength + extraLength;
    const data = bytes.subarray(offset, offset + size);
    assert.equal(data.length, size);
    assert.equal(crc32(data), checksum, name + ' checksum');
    entries.set(name, { data, checksum, size, localOffset });
    offset += size;
  }
  assert.equal(offset, centralStart);
  assert.equal(entries.size, count);
  for (let index = 0; index < count; index += 1) {
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50);
    assert.equal(bytes.readUInt16LE(offset + 10), 0);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const name = bytes.toString('utf8', offset + 46, offset + 46 + nameLength);
    const entry = entries.get(name);
    assert.ok(entry, 'Central directory points to a missing entry');
    assert.equal(bytes.readUInt32LE(offset + 16), entry.checksum);
    assert.equal(bytes.readUInt32LE(offset + 20), entry.size);
    assert.equal(bytes.readUInt32LE(offset + 24), entry.size);
    assert.equal(bytes.readUInt32LE(offset + 42), entry.localOffset);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(offset, footer);
  return entries;
}

test('Project ZIP checksums and paths are valid and its sketches/audio match the release', () => {
  assert.equal(built.status, 0, built.stderr);
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  const entries = parseStoredZip(read('week11-project-kit.zip'));
  assert.ok(entries.get('sketch.js').data.equals(read('sketches/composition.js')));
  for (const name of ['LICENSE', 'vendor/p5.min.js', 'vendor/p5-LICENSE.txt', 'results.json']) {
    assert.ok(entries.get(name).data.equals(read(name)), name + ' differs between site and project kit');
  }
  for (const { id } of engine.experiments) {
    for (const name of ['audio/' + id + '.wav', 'scores/' + id + '.json']) assert.ok(entries.get(name).data.equals(read(name)));
    assert.ok(entries.get('experiments/' + id + '.js').data.equals(read('sketches/' + id + '.js')));
  }
  const html = entries.get('index.html').data.toString();
  for (const match of html.matchAll(/\bsrc="([^"]+)"/g)) assert.ok(entries.has(match[1]), 'Missing kit script: ' + match[1]);
});

test('All complete p5 sketches parse, reproduce the scores and set up audio-only controls', () => {
  assert.equal(built.status, 0, built.stderr);
  for (const { id } of engine.experiments) {
    const source = read('sketches/' + id + '.js').toString();
    const script = new vm.Script(source, { filename: id + '.js' });
    const calls = [], buttons = [], lifecycle = [], mounted = [];
    const target = { id: 'p5-controls' };
    const sandbox = {
      noCanvas() { calls.push('noCanvas'); },
      noLoop() { calls.push('noLoop'); },
      createP(text) { calls.push('createP'); return { elt: { textContent: text }, parent(element) { mounted.push(element); } }; },
      createButton(label) { const button = { label, parent(element) { mounted.push(element); }, mouseClicked(handler) { this.handler = handler; } }; buttons.push(button); return button; },
      document: { getElementById(id) { return id === 'p5-controls' ? target : null; }, addEventListener(event, handler) { lifecycle.push({ event, handler }); } },
      window: { addEventListener(event, handler) { lifecycle.push({ event, handler }); } }
    };
    const context = vm.createContext(sandbox);
    script.runInContext(context, { timeout: 1000 });
    vm.runInContext('setup()', context, { timeout: 1000 });
    assert.deepEqual(calls, ['noCanvas', 'noLoop', 'createP']);
    assert.deepEqual(buttons.map(button => button.label), ['Play 60 seconds', 'Stop']);
    assert.ok(buttons.every(button => typeof button.handler === 'function'));
    assert.deepEqual(mounted, [target, target, target]);
    assert.deepEqual(lifecycle.map(item => item.event), ['visibilitychange', 'pagehide']);
    assert.equal(vm.runInContext('JSON.stringify(SoundLab.makeScore(EXPERIMENT))', context), JSON.stringify(engine.makeScore(id)));
  }
});
