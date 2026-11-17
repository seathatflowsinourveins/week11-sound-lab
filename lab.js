'use strict';
const $ = id => document.getElementById(id);
const engine = SoundLab;
const titles = ['A simple repeating idea', 'Let the rhythms interlock', 'A minute that develops'];
let selected = 'composition', listeningRun = null, browserReport = null;
const storageKey = 'icm-week11-notebook-v1';
let notes = {}, storageBlocked = false;
try {
  const raw = localStorage.getItem(storageKey);
  if (raw) notes = validateNotebook(JSON.parse(raw));
} catch (error) {
  storageBlocked = true;
  $('save-status').textContent = 'Saved notes could not be read. Existing data is preserved. New notes stay in memory; export them to keep your work.';
}
function validateNotebook(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Notebook must be an object.');
  const valid = new Set(['classNotes','myWork','partnerWork','sharedWork','decision','sketchUrl','blogUrl',
    'iteration-pulse','iteration-rhythm','iteration-composition','run-1','run-2','run-3','complete-1','complete-2','complete-3']);
  const clean = {};
  for (const [key, text] of Object.entries(value)) {
    if (!valid.has(key) || typeof text !== 'string' || text.length > 100000) throw Error('Unrecognized or invalid notebook entry.');
    if (key.startsWith('complete-') && text && (!Number.isFinite(Date.parse(text)) || new Date(text).toISOString() !== text)) throw Error('A playback completion time is invalid.');
    clean[key] = text;
  }
  return clean;
}
function save() {
  if (storageBlocked) return;
  try { localStorage.setItem(storageKey, JSON.stringify(notes)); }
  catch (error) { storageBlocked = true; $('save-status').textContent = 'Browser saving failed. Your notes remain on this page; export them before leaving.'; }
}
function download(name, text, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text],{type}));
  const link = document.createElement('a'); link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function select(id, shouldStop = true) {
  if (shouldStop) { listeningRun=null; player.stop(); }
  selected=id;
  const index=engine.experiments.findIndex(e=>e.id===id),experiment=engine.experiments[index];
  $('player-title').textContent=String(index+1).padStart(2,'0')+' · '+titles[index];
  $('player-hint').textContent=experiment.description;
  $('listen-for').textContent=experiment.expect;
  $('wav-link').href='audio/'+id+'.wav'; $('sketch-link').href='sketches/'+id+'.js';
  for (const card of document.querySelectorAll('.experiment')) {
    const active=card.dataset.experiment===id;
    card.classList.toggle('selected',active);
    card.querySelector('button').setAttribute('aria-pressed',String(active));
  }
}
const player=createTransport(engine,()=>new (window.AudioContext||window.webkitAudioContext)(),(state,detail)=>{
  $('play-status').textContent=state==='playing'?'Playing '+engine.experiments.find(e=>e.id===selected).title+'. Stop ends the piece; replay starts at 0s.':detail;
  $('play').disabled=state==='pending'||state==='playing';
  if (state==='ended'&&listeningRun) {
    notes['complete-'+listeningRun]=new Date().toISOString();save();showRun();listeningRun=null;
  }
  updateClock();
});
function updateClock(){const sec=Math.floor(player.elapsed());$('clock').textContent=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')+' / 01:00';}
setInterval(updateClock,250);
engine.experiments.forEach((experiment,index)=>{
  const card=document.createElement('article');card.className='experiment';card.dataset.experiment=experiment.id;
  card.innerHTML='<div class="number"><span>0'+(index+1)+'</span><span class="tag">'+(index===0?'BASELINE':'REVISION '+index)+'</span></div><h3></h3><p class="description"></p><p class="change"><strong>What changes</strong><br><span></span></p><button aria-pressed="false">Choose experiment '+(index+1)+' <span aria-hidden="true">↗</span></button>';
  card.querySelector('h3').textContent=titles[index];card.querySelector('.description').textContent=experiment.description;
  card.querySelector('.change span').textContent=experiment.change;
  card.querySelector('button').addEventListener('click',()=>select(experiment.id));
  $('experiment-cards').append(card);
  const field=document.createElement('div');
  field.innerHTML='<label></label><textarea rows="2"></textarea>';
  const input=field.querySelector('textarea');input.id='iteration-'+experiment.id;input.dataset.note=input.id;
  input.placeholder='What did you actually hear? What would you change next?';
  field.querySelector('label').htmlFor=input.id;field.querySelector('label').textContent='0'+(index+1)+' · '+titles[index];
  $('iteration-fields').append(field);
});
select('composition',false);
$('play').addEventListener('click',()=>{listeningRun=null;player.play(selected);});
$('stop').addEventListener('click',()=>{listeningRun=null;player.stop();});
$('hero-play').addEventListener('click',()=>{select('composition');player.play('composition');$('experiments').scrollIntoView({behavior:'smooth'});});
document.addEventListener('visibilitychange',()=>{if(document.hidden){listeningRun=null;player.stop('Stopped because this page was hidden. Play restarts from 0 seconds.');}});
window.addEventListener('pagehide',()=>player.stop());

const recipes=[
  {label:'A clock for the notes',title:'Give every note a place in time.',code:'const STEP = 0.25;\nfor (let step = 0; step < 240; step += 1) {\n  const time = step * STEP;\n}',meaning:'STEP is the length of one slot in seconds. The loop visits the slot numbers 0 through 239. Multiplying a slot number by 0.25 turns it into a time in seconds.',example:'Slot 0 → 0.00s. Slot 1 → 0.25s. Slot 4 → 1.00s. 240 slots × 0.25s = 60 seconds.',connection:'The real makeScore() loop calls add(), which stores this calculated time. It builds the score; it does not wait a quarter-second inside the loop.'},
  {label:'A small musical idea',title:'Make notes from a starting pitch.',code:'const RATIOS = [1, 1.125, 1.25, 1.34, 1.5, 1.67, 1.875, 2];\nconst MOTIF = [0, 2, 4, 2, 1, 3, 2, 0];\nconst frequency = 262 * RATIOS[degree];',meaning:'An array is an ordered list. RATIOS contains pitch multipliers. MOTIF names which entries to use, with indexing starting at 0. Frequency is the number of vibrations per second: a larger number sounds higher.',example:'MOTIF starts 0, 2, 4. Those indices select ratios 1, 1.25, 1.5. Multiplying by 262 gives 262, 327.5, and 393 Hz.',connection:'262 Hz is the melody tonic, twice the class table’s 131 Hz. The ratios retain the rounded class values. They are a design choice, not exact equal temperament.'},
  {label:'Repetition and rhythm',title:'Use the remainder to make a pattern.',code:'if (step % 8 === 0) melody(step, 0.6, 0.085, \'sine\');\n\nif ([0, 3, 6].includes(step % 8)) {\n  melody(step, 0.3, 0.075, \'triangle\');\n}',meaning:'The % symbol gives the remainder after division. step % 8 repeatedly counts 0 through 7. The first rule plays once each eight slots. The second plays on three chosen positions within the cycle.',example:'Baseline onsets: 0.00, 2.00, 4.00 seconds. Rhythmic onsets: 0.00, 0.75, 1.50, 2.00, 2.75, 3.50 seconds.',connection:'These are the separate baseline and revision-1 rules from makeScore(). The numbers after step are duration in seconds, gain, and waveform type.'},
  {label:'A beginning and ending',title:'Let the rule change over the minute.',code:'const section = Math.floor(step / 60);\n\n// section 0: Seed\n// section 1: Growth\n// section 2: Density\n// section 3: Return',meaning:'Math.floor() removes the fractional part. Dividing the slot number by 60 groups the 240 slots into four sections. Because each slot lasts 0.25s, each section lasts 15 seconds.',example:'Slots 0–59 → Seed. 60–119 → Growth. 120–179 → Density. 180–239 → Return. The last tonic begins at 59 seconds and releases by 60.',connection:'The real score uses if statements to choose each section’s notes. Section numbers do not start at 1: JavaScript uses 0 here.'},
  {label:'The shape of a note',title:'Fade in. Hold. Fade out.',code:'gain.gain.setValueAtTime(0, start);\ngain.gain.linearRampToValueAtTime(event.gain, start + attack);\ngain.gain.setValueAtTime(event.gain, end - release);\ngain.gain.linearRampToValueAtTime(0, end);',meaning:'A gain node controls signal strength. These instructions start a note at zero, rise to its chosen gain, hold it, and return to zero. The short fades soften abrupt note edges.',example:'A 0.30-second note uses an 0.008-second attack and 0.035-second release. A sine sounds smoother; a triangle adds harmonics and changes the character.',connection:'These are native Web Audio instructions from playScore(). Gain is a signal multiplier, not a measurement of perceived loudness.'},
  {label:'Repeatable playback',title:'Schedule sound on the audio clock.',code:'const startTime = context.currentTime + 0.06;\nconst start = startTime + event.time;\noscillator.start(start);\noscillator.stop(end);',meaning:'currentTime is the browser audio clock. A short preparation offset gives the browser time to schedule the notes. Each note gets an absolute start and stop time, independent of the screen’s drawing speed.',example:'Press Play twice: the note list and intended intervals stay the same. Stop cancels all scheduled notes. A new Play starts from the beginning.',connection:'The page awaits context.resume() after your click. A request ticket prevents a delayed resume from playing after you pressed Stop. No random() or noise() is used.'}
];
function showRecipe(index){const r=recipes[index];$('recipe-label').textContent='RULE '+(index+1)+' / '+recipes.length;$('recipe-title').textContent=r.title;$('recipe-code').textContent=r.code;$('recipe-meaning').textContent=r.meaning;$('recipe-example').textContent=r.example;$('recipe-connection').textContent=r.connection;for(const [i,button]of [...$('recipe-nav').children].entries())button.setAttribute('aria-pressed',String(index===i));}
recipes.forEach((r,i)=>{const button=document.createElement('button');button.innerHTML='<span>0'+(i+1)+'</span>';button.append(document.createTextNode(r.label));button.addEventListener('click',()=>showRecipe(i));$('recipe-nav').append(button);});showRecipe(0);

for(const row of BUILD_RESULTS.experiments){
  const tr=document.createElement('tr');
  for(const text of [titles[engine.experiments.findIndex(e=>e.id===row.id)],row.wavDuration.toFixed(2)+'s',String(row.eventCount),row.peak.toFixed(5),row.scoreIdentical?'Yes · identical':'No']){const td=document.createElement('td');td.textContent=text;tr.append(td);}
  $('result-rows').append(tr);
  const note=document.createElement('article');note.className='result-note';const heading=document.createElement('h3');heading.textContent=row.id==='pulse'?'01 / One line':row.id==='rhythm'?'02 / More activity':'03 / A planned shape';
  const text=document.createElement('p');
  text.textContent=row.eventCount+' note events: '+Object.entries(row.voices).map(([voice,count])=>count+' '+voice).join(', ')+'. '+(row.id==='composition'?'Section counts: '+row.sections.map(s=>s.title+' '+s.eventCount).join(' / ')+'. ':'')+'Expected effect: '+engine.experiments.find(e=>e.id===row.id).expect;
  note.append(heading,text);$('result-notes').append(note);
}

function restoreFields(){for(const field of document.querySelectorAll('[data-note]'))field.value=notes[field.dataset.note]||'';showRun();}
for(const field of document.querySelectorAll('[data-note]'))field.addEventListener('input',()=>{notes[field.dataset.note]=field.value;save();});
function showRun(){const run=$('run').value;$('listening-label').textContent='Run '+run+' observations';$('listening-notes').value=notes['run-'+run]||'';$('run-completion').textContent=notes['complete-'+run]?'One complete playback recorded '+new Date(notes['complete-'+run]).toLocaleString()+'. Add your own timestamped observations.':'No complete playback recorded for this run in this browser.';}
$('run').addEventListener('change',()=>{if(listeningRun){listeningRun=null;player.stop('Stopped before switching listening sessions. Start the next run from 0 seconds.');}showRun();});
$('listening-notes').addEventListener('input',()=>{notes['run-'+$('run').value]=$('listening-notes').value;save();});
$('start-listen').addEventListener('click',()=>{select('composition');listeningRun=$('run').value;player.play('composition');});
$('stamp').addEventListener('click',()=>{
  if(player.state!=='playing'||selected!=='composition'||listeningRun!==$('run').value){$('play-status').textContent='Start a timed listening session before adding its current timestamp.';return;}
  const input=$('listening-notes'),text=Math.floor(player.elapsed()).toString().padStart(2,'0')+'s — ';
  input.value+=(input.value&&!input.value.endsWith('\n')?'\n':'')+text;notes['run-'+$('run').value]=input.value;save();input.focus();
});
restoreFields();
$('export-progress').addEventListener('click',()=>download('week11-notebook.json',JSON.stringify({schema:1,notes},null,2),'application/json'));
$('import-progress').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try{
    if(file.size>2500000)throw Error('Notebook is too large.');const parsed=JSON.parse(await file.text());if(parsed.schema!==1)throw Error('Unsupported notebook format.');
    const incoming=validateNotebook(parsed.notes),merged={...notes};let kept=0;
    for(const [key,text]of Object.entries(incoming)){if(!merged[key])merged[key]=text;else if(text&&merged[key]!==text)kept++;}
    notes=merged;save();restoreFields();$('save-status').textContent='Imported empty fields. '+(kept?kept+' existing entries were kept where values differed. ':'')+(storageBlocked?'Browser saving is unavailable; export this merged notebook.':'Notes are saved in this browser.');
  }catch(error){$('save-status').textContent='Import failed: '+error.message+' Current notes are preserved.';}
  event.target.value='';
});
function csvCell(value){return '"'+String(value).replace(/"/g,'""')+'"';}
$('export-csv').addEventListener('click',()=>{
  const rows=[['type','version_or_run','change_or_timestamped_observations','measured_result','my_listening_observation']];
  for(const e of engine.experiments){const r=BUILD_RESULTS.experiments.find(x=>x.id===e.id);rows.push(['iteration',e.id,e.change,r.eventCount+' events; '+r.wavDuration+'s WAV; peak '+r.peak.toFixed(5),notes['iteration-'+e.id]||'[Add your actual observation]']);}
  for(let i=1;i<=3;i++)rows.push(['listening','run '+i,notes['run-'+i]||'[Record a complete timed listen]','',notes['complete-'+i]?'Playback completion recorded; see notebook':'No completion recorded in notebook']);
  rows.push(['class examples','',notes.classNotes||'[Add class example observations]','','']);
  download('week11-iterations-and-listening.csv','\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
});
$('export-blog').addEventListener('click',()=>{
  const own=(key,prompt)=>notes[key]||'['+prompt+']';
  const text=['A minute, made by rules — process draft','','Example algorithm: at 120 BPM, build 240 quarter-second slots. A repeating pitch motif develops over four 15-second sections. Fixed arithmetic and arrays make the note list repeatable. Native oscillators synthesize each note; no visuals are part of the performance.','','Class listening: '+own('classNotes','Add the 2–3 things you and your partner actually noticed.'),'','EXPERIMENTS',...engine.experiments.flatMap(e=>{const r=BUILD_RESULTS.experiments.find(x=>x.id===e.id);return ['',e.title,e.change,'Measured: '+r.eventCount+' events; '+r.wavDuration.toFixed(2)+' seconds of PCM audio; peak '+r.peak.toFixed(5)+'.','Our observation: '+own('iteration-'+e.id,'Add your listening observation and any changes you made.')];}),'','THREE TIMED LISTENS',...Array.from({length:3},(_,i)=>'Run '+(i+1)+':\n'+own('run-'+(i+1),'Add your own observations with timestamps.')),'','HOW WE WORKED','My individual work: '+own('myWork','Describe your own contribution.'),'Partner’s individual work: '+own('partnerWork','Describe your partner’s contribution.'),'Together: '+own('sharedWork','Describe what you did together.'),'','Chosen version and why: '+own('decision','Choose after listening and revising.'),'Sketch: '+own('sketchUrl','Save and paste your own sketch URL.'),'Blog: '+own('blogUrl','Add your published blog URL.'),'','This is a draft built from an example and your notebook. Review it, credit the teaching example, and replace every placeholder before submitting.'];
  download('week11-process-blog-draft.txt',text.join('\n'));
});

$('browser-check').addEventListener('click',async()=>{
  const button=$('browser-check');button.disabled=true;$('download-check').disabled=true;
  browserReport={checkedAt:new Date().toISOString(),sampleRate:22050,renderer:'Native OfflineAudioContext; no speaker playback',experiments:[],passed:false};
  try{
    const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!Offline)throw Error('OfflineAudioContext is unavailable.');
    async function render(id){
      const context=new Offline(1,Math.round(60.1*22050),22050);
      const graph=engine.playScore(context,engine.makeScore(id));
      const buffer=await context.startRendering(),pcm=buffer.getChannelData(0);
      let peak=0,sum=0,nonzero=0;for(const v of pcm){peak=Math.max(peak,Math.abs(v));sum+=v*v;if(v!==0)nonzero++;}
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pcm.buffer))).map(b=>b.toString(16).padStart(2,'0')).join('');
      return {report:{id,scoreDuration:graph.endTime-graph.startTime,renderedDuration:buffer.duration,peak,rms:Math.sqrt(sum/pcm.length),nonzero,sha256:hash},pcm:new Float32Array(pcm)};
    }
    let reference;
    for(const e of engine.experiments){$('browser-report').textContent='Silently rendering '+e.title+'…';const rendered=await render(e.id);browserReport.experiments.push(rendered.report);if(e.id==='composition')reference=rendered.pcm;}
    const replay=await render('composition');browserReport.replay=replay.report;
    browserReport.repeatIdentical=replay.report.sha256===browserReport.experiments[2].sha256;
    let maxDifference=0,differenceSquared=0;
    for(let i=0;i<reference.length;i++){const difference=Math.abs(reference[i]-replay.pcm[i]);maxDifference=Math.max(maxDifference,difference);differenceSquared+=difference*difference;}
    browserReport.maxSampleDifference=maxDifference;browserReport.rmsDifference=Math.sqrt(differenceSquared/reference.length);
    browserReport.tolerance=1/32768;browserReport.repeatWithinPCM16Step=maxDifference<=browserReport.tolerance;
    browserReport.renderPassed=browserReport.experiments.every(r=>Math.abs(r.scoreDuration-60)<1e-6&&r.peak>0&&r.peak<1&&r.nonzero>0);
    browserReport.passed=browserReport.repeatIdentical&&browserReport.renderPassed;
    browserReport.note=browserReport.repeatIdentical?'Native renders are byte-identical in this browser.':'Native byte-repeat check failed. Exact score and exported WAV repeatability are checked separately; sample differences are reported here without assuming their cause.';
    $('browser-report').textContent=JSON.stringify(browserReport,null,2);$('download-check').disabled=false;
  }catch(error){browserReport.error=error.message;$('browser-report').textContent=JSON.stringify(browserReport,null,2);$('download-check').disabled=false;}
  finally{button.disabled=false;}
});
$('download-check').addEventListener('click',()=>download('week11-browser-audio-check.json',JSON.stringify(browserReport,null,2),'application/json'));
