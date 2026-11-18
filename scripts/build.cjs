'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist'),engine=require('../composer.js'),{zip}=require('./archive.cjs');
const read=name=>fs.readFileSync(path.join(root,name));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const publicFiles=['index.html','lab.css','lab.js','performance.html','performance.js','p5.html','composer.js','transport.js','README.md','SOURCES.md','LICENSE','vendor/p5.min.js','vendor/p5-LICENSE.txt','walkthrough.html','walkthrough.css','walkthrough-data.js','walkthrough-model.js','walkthrough.js'];
const entries=new Map(publicFiles.map(name=>[name,read(name)]));
for (const name of ['listen.html','listen.css','listen.js','study.css','note-inspector.js','practice.js','live-notes.js','melody-map.js','listening-manifest.json','design.css']) entries.set(name, read(name));
const listeningManifest = JSON.parse(entries.get('listening-manifest.json'));
const manifestElement = '<script id="guide-manifest" type="application/json">';
const guidedPage = entries.get('listen.html').toString().replace(manifestElement,
  () => manifestElement + JSON.stringify(listeningManifest).replaceAll('<', '\\u003c'));
entries.set('listen.html', Buffer.from(guidedPage));
const composer=entries.get('composer.js');
const {composerSHA256}=require('../walkthrough-data.js');
if(hash(composer)!==composerSHA256)throw Error('The composer changed. Review the walkthrough line explanations before updating its source checksum.');
entries.set('walkthrough-source.js',Buffer.from('globalThis.WALKTHROUGH_SOURCE = '+JSON.stringify(composer.toString('utf8'))+';\n'));
const practices = require('./practice.cjs')(composer.toString('utf8'), listeningManifest.experiments, engine);
entries.set('practice-clips.js', Buffer.from('globalThis.WEEK11_PRACTICES = ' + JSON.stringify(practices) + ';\n'));
const results={schema:1,checked:'2026-11-16',sampleRate:22050,format:'Mono 16-bit PCM WAV; ideal sine/triangle rendering',experiments:[]};
const p5Controls=`\n// p5 bridge: native Web Audio makes the sound; p5 creates the controls.\nlet scorePlayer;\nfunction setup() {\n  noCanvas();\n  noLoop();\n  const target = document.getElementById('p5-controls');\n  const mount = element => { if (target) element.parent(target); return element; };\n  const message = mount(createP('Ready. Press Play to hear 60 seconds.'));\n  scorePlayer = createTransport(SoundLab, () => new (window.AudioContext || window.webkitAudioContext)(), (state, detail) => {\n    message.elt.textContent = state === 'playing' ? 'Playing the 60-second composition.' : detail;\n  });\n  mount(createButton('Play 60 seconds')).mouseClicked(() => scorePlayer.play(EXPERIMENT));\n  mount(createButton('Stop')).mouseClicked(() => scorePlayer.stop());\n  document.addEventListener('visibilitychange', () => { if (document.hidden) scorePlayer.stop(); });\n  window.addEventListener('pagehide', () => scorePlayer.stop());\n}\n`;
for(const experiment of engine.experiments){
  const score=engine.makeScore(experiment.id),serialized=JSON.stringify(score),wav=Buffer.from(engine.renderWav(score)),again=Buffer.from(engine.renderWav(engine.makeScore(experiment.id)));
  let peak=0,sum=0,nonzero=0;
  for(let offset=44;offset<wav.length;offset+=2){const value=wav.readInt16LE(offset)/32768;peak=Math.max(peak,Math.abs(value));sum+=value*value;if(value!==0)nonzero++;}
  const samples=(wav.length-44)/2;
  const record={id:experiment.id,...engine.summarize(score),samples,wavDuration:samples/22050,peak,rms:Math.sqrt(sum/samples),nonzeroSamples:nonzero,scoreIdentical:serialized===JSON.stringify(engine.makeScore(experiment.id)),wavIdentical:wav.equals(again),scoreSHA256:hash(serialized),wavSHA256:hash(wav)};
  if(record.wavDuration!==60||record.peak<=0||record.peak>=1||!record.scoreIdentical||!record.wavIdentical)throw Error('Render acceptance failed: '+experiment.id);
  results.experiments.push(record);
  entries.set('audio/'+experiment.id+'.wav',wav);
  entries.set('scores/'+experiment.id+'.json',Buffer.from(JSON.stringify(score,null,2)+'\n'));
  const sketch='// Week 11 original teaching example. MIT license.\n// Complete single-file p5 sketch: paste into sketch.js. No sound add-on needed.\nconst EXPERIMENT = '+JSON.stringify(experiment.id)+';\n'+read('composer.js')+'\n'+read('transport.js')+p5Controls;
  entries.set('sketches/'+experiment.id+'.js',Buffer.from(sketch));
}
entries.set('results.json',Buffer.from(JSON.stringify(results,null,2)+'\n'));
const renderDesignGuide = require('./design-guide.cjs');
entries.set('design.html', renderDesignGuide(read('design.html').toString(), listeningManifest, results));
entries.set('results.js',Buffer.from('globalThis.BUILD_RESULTS = '+JSON.stringify(results)+';\n'));
const kitHTML='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Week 11 audio-only composition</title><script src="vendor/p5.min.js"></script><style>body{background:#101614;color:#edf2e9;font:16px system-ui;padding:32px}button{font:inherit;margin:8px;padding:12px}button:focus-visible{outline:3px solid #cae9ad}</style></head><body><script src="sketch.js"></script></body></html>\n';
const kitReadme='WEEK 11 — A MINUTE, MADE BY RULES\n\nAn original teaching example, not evidence of your partner work or listening.\n\nONLINE P5 EDITOR:\n1. Create a NEW sketch at https://editor.p5js.org/\n2. Use p5 2.3.4. Paste sketch.js into the editor’s sketch.js.\n3. No additional sound library or sound assets are needed.\n4. Run, then press Play. Stop cancels every scheduled note.\n5. Save your own version; keep its URL for your class submission.\n\nLOCAL:\nServe this folder with an HTTP server and open index.html.\nThe supplied vendor/p5.min.js is pinned to 2.3.4.\n\nWHAT TO CHANGE:\nRATIOS changes the available pitches. MOTIF changes their order.\nSTEP is 0.25 seconds. The 240-step loop creates a 60-second score.\nThe section conditions control density, register and timbre.\nSmall envelope fades reduce sudden note edges.\nThe score uses no random() or noise(), so fixed rules produce the same notes.\n\nFILES:\nsketch.js — complete final p5 sketch including the sound engine and controls\nexperiments/ — baseline plus two revisions, each a complete sketch\nscores/ — exact note lists\naudio/ — synthesized 60-second WAV exports\nresults.json — measured PCM statistics and SHA-256 hashes\n\nFINISH YOUR HOMEWORK:\nListen with your partner, make and document your own revisions,\ncomplete three timestamped listening logs, update the correct Mimi 07\nspreadsheet, and write your individual/shared process in your blog.\nThe study site has blank personal fields and export tools.\n';
const kit=[['index.html',kitHTML],['sketch.js',entries.get('sketches/composition.js')],['README.txt',kitReadme],['LICENSE',read('LICENSE')],['vendor/p5.min.js',read('vendor/p5.min.js')],['vendor/p5-LICENSE.txt',read('vendor/p5-LICENSE.txt')],['results.json',entries.get('results.json')]];
for(const [name,data]of entries)if(/^(audio|scores)\//.test(name))kit.push([name,data]);
for(const e of engine.experiments)kit.push(['experiments/'+e.id+'.js',entries.get('sketches/'+e.id+'.js')]);
entries.set('week11-project-kit.zip',zip(kit));
const release=hash(Buffer.concat([...entries].sort(([a],[b])=>a.localeCompare(b)).flatMap(([name,data])=>[Buffer.from(name+'\0'),data]))).slice(0,16);
const pages = ['index.html', 'performance.html', 'p5.html', 'walkthrough.html', 'listen.html', 'design.html'];
const assets = ['lab.css','lab.js','performance.js','composer.js','transport.js','results.js','sketches/composition.js','walkthrough.css','walkthrough-source.js','walkthrough-data.js','walkthrough-model.js','walkthrough.js','listen.css','listen.js','study.css','note-inspector.js','design.css'];
for (const page of pages) {
  let html = entries.get(page).toString();
  for (const asset of [...assets, 'practice.js', 'practice-clips.js', 'live-notes.js','melody-map.js']) {
    for (const attribute of ['src', 'href']) {
      html = html.replaceAll(attribute + '="' + asset + '"', attribute + '="' + asset + '?v=' + release + '"');
    }
  }
  entries.set(page, Buffer.from(html));
}
const manifest={release,checked:listeningManifest.reviewed,p5:'2.3.4',files:[...entries].map(([name,data])=>({path:name,bytes:data.length,sha256:hash(data)})).sort((a,b)=>a.path.localeCompare(b.path))};
entries.set('release.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
fs.mkdirSync(out,{recursive:true});
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.relative(out,path.join(dir,e.name)).split(path.sep).join('/')]);}
const stale=walk(out).filter(name=>!entries.has(name));if(stale.length)throw Error('Unexpected dist files; inspect before removing: '+stale.join(', '));
for(const [name,data]of entries){const destination=path.join(out,name);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,data);}
console.log(JSON.stringify({release,files:entries.size,experiments:results.experiments.map(({id,eventCount,wavDuration,peak,scoreIdentical,wavIdentical})=>({id,eventCount,wavDuration,peak,scoreIdentical,wavIdentical}))},null,2));
