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

test('the live lesson content and the standalone design manifest are identical', () => {
  const page = read('listen.html').toString();
  const embedded = page.match(/<script id="guide-manifest" type="application\/json">(.+?)<\/script>/s);
  assert.ok(embedded);
  assert.deepEqual(JSON.parse(embedded[1]), JSON.parse(read('listening-manifest.json')));
});

test('the six practice clips play the stated edit and preserve the other voices', () => {
  const context = {};
  vm.runInNewContext(read('practice-clips.js').toString(), context);
  const practices = JSON.parse(JSON.stringify(context.WEEK11_PRACTICES));
  const { makeExcerpt } = require('./walkthrough-model.js');
  for (const { id } of engine.experiments) {
    const { clips: [original, edited], window } = practices[id];
    assert.deepEqual(original, makeExcerpt(engine.makeScore(id), ...window));
    assert.equal(edited.duration, original.duration);
    assert.deepEqual(edited.events.filter(n => n.voice !== 'melody'), original.events.filter(n => n.voice !== 'melody'));
    const melody = clip => clip.events.filter(n => n.voice === 'melody');
    if (id === 'composition') {
      assert.ok(melody(original).every(n => n.wave === 'triangle'));
      assert.deepEqual(melody(edited), melody(original).map(note => ({ ...note, wave: 'sine' })));
    } else {
      assert.deepEqual(melody(edited).map(n => n.time), id === 'pulse' ? [0,1,2,3] : [0,1]);
      assert.deepEqual(melody(original).map(n => n.time), id === 'pulse' ? [0,2] : [0,.75,1.5]);
    }
    const pcm = engine.renderPCM(edited);
    assert.ok(pcm.some(sample => sample !== 0));
    assert.notDeepEqual(pcm, engine.renderPCM(original));
  }
});

test('the design guide covers every lesson, code chapter and credited design repository', () => {
  const guide = JSON.parse(read('listening-manifest.json'));
  const html = read('design.html').toString();
  const destinations = new Set([...html.matchAll(/href="([^"]+)"/g)].map(match => match[1].replace(/\?v=[a-f0-9]{16}$/, '')));
  const { chapters } = require('./walkthrough-data.js');
  for (const experiment of guide.experiments) {
    for (const stop of experiment.stops) assert.ok(html.includes('href="listen.html#' + experiment.id + '/' + stop.id + '"'));
    const { voices, eventCount } = engine.summarize(engine.makeScore(experiment.id));
    const row = html.match(new RegExp('<tr data-experiment="' + experiment.id + '">([\\s\\S]+?)</tr>'))[1];
    assert.deepEqual([...row.matchAll(/<td>(\d+)<\/td>/g)].map(match => Number(match[1])),
      [voices.melody, voices.bass, voices.pulse, eventCount]);
  }
  for (const [chapter] of chapters) assert.ok(html.includes('data-chapter="' + chapter + '"'));
  for (const ref of guide.references) {
    assert.ok(destinations.has(ref.source), ref.name);
    assert.ok(destinations.has(ref.demo), ref.name);
    const revision = ref.source.match(/\/([0-9a-f]{40})\//)[1];
    assert.ok(html.includes(' · ' + revision.slice(0, 8) + '</a>'), ref.name + ' displayed revision');
  }
  for (const group of guide.credits) {
    assert.ok(html.includes('<summary>' + group.title + '</summary>'));
    for (const item of group.items) {
      assert.ok(html.includes(item.name), item.name);
      if (item.source) assert.ok(destinations.has(item.source), item.name);
      for (const [, href] of item.links || []) assert.ok(destinations.has(href), item.name + ' ' + href);
    }
  }
  for (const file of ['listen.html', 'walkthrough.html']) assert.ok(read(file).toString().includes('href="design.html"'));
});

test('Every local HTML asset and navigation destination resolves inside the delivered site', () => {
  assert.equal(built.status, 0, built.stderr);
  const guide = JSON.parse(read('listening-manifest.json'));
  const { resolvePosition, positionHash } = require('./walkthrough-model.js');
  for (const filename of ['index.html', 'performance.html', 'walkthrough.html', 'listen.html', 'design.html', 'darkened-brass.html', 'timer-manifest.html', 'study-guide.html', 'line-by-line.html']) {
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
        if (target.endsWith('listen.html') && parsed.hash.includes('/')) {
          assert.ok(guide.experiments.some(exp => exp.stops.some(stop => parsed.hash === '#' + exp.id + '/' + stop.id)), reference);
          continue;
        }
        if (target.endsWith('walkthrough.html') && parsed.hash.includes('/')) {
          assert.equal(positionHash(resolvePosition(parsed.hash)), parsed.hash, reference);
          continue;
        }
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

test('Darkened Brass showcase, three iterations, interactive guides and notes ship cleanly in dist', () => {
  assert.equal(built.status, 0, built.stderr);
  assert.match(read('index.html').toString('utf8'), /href="darkened-brass\.html"/);

  const pages = ['darkened-brass.html', 'timer-manifest.html', 'study-guide.html', 'line-by-line.html'];
  const iterations = ['iteration-1', 'iteration-2', 'iteration-3-final'];
  const noteFiles = ['blog-draft.md', 'critique-guide.md', 'iteration-notes.md', 'observation-1.md', 'observation-2.md', 'observation-3.md', 'spreadsheet.csv'];

  for (const page of pages) {
    assert.ok(fs.existsSync(path.join(dist, page)), 'Missing dist page: ' + page);
  }
  for (const dir of iterations) {
    for (const file of ['index.html', 'style.css', 'sketch.js']) {
      assert.ok(fs.existsSync(path.join(dist, 'iterations', dir, file)), 'Missing dist file: iterations/' + dir + '/' + file);
    }
    const sketchSrc = read(path.join('iterations', dir, 'sketch.js')).toString('utf8');
    new vm.Script(sketchSrc, { filename: dir + '/sketch.js' });
    assert.match(sketchSrc, /randomSeed\(0\)/);
    assert.match(sketchSrc, /sec >= 60/);
  }
  for (const note of noteFiles) {
    assert.ok(fs.existsSync(path.join(dist, 'notes', note)), 'Missing dist note: notes/' + note);
  }
});
