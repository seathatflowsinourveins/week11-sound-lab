(function () {
'use strict';
const { chapters, lessons, rows, rules } = WalkthroughData;
const { inspectSlot, voiceAt, pitchAt, layoutVoice, makeExcerpt, resolvePosition, positionHash, moveLine } = WalkthroughModel;
const $ = id => document.getElementById(id);
const model = Object.fromEntries(lessons.map(l=>[l.id,SoundLab.makeScore(l.id)]));
const source = WALKTHROUGH_SOURCE.split(/\r?\n/);
const positionKey = 'icm-week11-walkthrough-v1';
let savedPosition;
try { savedPosition = JSON.parse(localStorage.getItem(positionKey)); } catch { /* Storage is optional. */ }
const initial = resolvePosition(location.hash, savedPosition);
const state = {
  lesson: lessons.findIndex(lesson => lesson.id === initial.lesson),
  chapter: chapters.findIndex(chapter => chapter[0] === initial.chapter),
  line: initial.line,
  slot: 0
};
const previews = createTransport(
  { makeScore: request => request.score, playScore: SoundLab.playScore },
  () => {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('This browser does not provide Web Audio.');
    return new Audio();
  },
  (status, detail) => {
    $('audio-status').textContent = status === 'playing' ? detail.label : status === 'ended' ? 'Excerpt finished.' : detail;
    $('play').disabled = status === 'pending' || status === 'playing';
  }
);
const practices = [
  'In the pulse branch, change step % 8 to step % 4. Play the original and your change. Write how the silence between notes changed.',
  'In the rhythm branch, change the melody positions from [0, 3, 6] to [0, 4]. Compare the spacing while the bass and pulse stay in place.',
  'In Density, change the melody waveform from triangle to sine. Compare 30–45 seconds and describe how the tone changed.'
];
function currentPosition() {
  return { lesson: lesson().id, chapter: chapters[state.chapter][0], line: state.line };
}
function rememberPosition() {
  const position = currentPosition();
  try { localStorage.setItem(positionKey, JSON.stringify(position)); } catch { /* Storage is optional. */ }
  const hash = positionHash(position);
  if (location.hash !== hash) history.replaceState(null, '', hash);
}
const lesson = () => lessons[state.lesson];
const score = () => model[lesson().id];
const format = end => Number(end.toFixed(3)).toString();
const timeAt = index => index / 4;
function newElement(tag, text, style) {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (style) item.className = style;
  return item;
}
function button(text, fn) {
  const item = newElement('button',text);
  item.type = 'button';
  item.addEventListener('click',fn);
  return item;
}
function restoreFocus(container, key) {
  const target = [...container.querySelectorAll('[data-key]')].find(item => item.dataset.key === String(key));
  if (target) target.focus({ preventScroll: true });
}
function setSlot(value, focusExample) {
  if (!Number.isFinite(value)) value = state.slot;
  state.slot = inspectSlot(score(), value).slot;
  renderDetail();
  if (focusExample) restoreFocus($('examples'),state.slot);
}
function jumpLine(number, fromList) {
  state.line = number;
  renderLines();
  renderDetail();
  rememberPosition();
  if (fromList) restoreFocus(fromList,number);
}
function matchingRule(rule, slot = state.slot) {
  const [id, divisor, allowed, voice, section, cutoff] = rule;
  const remainder = slot % divisor;
  const inBranch=lesson().id===id && (section===undefined || Math.floor(slot/60)===section);
  const passes = inBranch && allowed.includes(remainder) && (cutoff===undefined || slot<cutoff);
  return {remainder,divisor,allowed,voice,inBranch,passes};
}
function setIllustration(title, boxes, caption) {
  $('diagram-title').textContent = title;
  const content = boxes.map(([value,label,active])=>{
    const item = newElement('div',undefined,'box');
    item.append(newElement('strong',value),newElement('span',label));
    if(active)item.dataset.active = '';
    return item;
  });
  $('flow').replaceChildren(...content);
  $('reason').textContent = caption;
}
function inspectAtLine(notesHere) {
  const i=state.slot,t=timeAt(i),line=state.line,s=score(),id=lesson().id;
  const section=Math.floor(i/60);
  const tone=notesHere.find(e=>e.voice==='melody')||notesHere[0]||s.events[0];
  const before=s.events.filter(e=>e.time<t);
  if(rules[line]){
    const result=matchingRule(rules[line]);
    const truth=result.inBranch ? (result.passes?'Start '+result.voice:'Skip '+result.voice) : 'Line skipped';
    const why = !result.inBranch
      ? 'This line is for a different experiment or section.'
      : result.passes ? 'The remainder matches. This line starts a new ' + result.voice + ' note.'
        : result.allowed.includes(result.remainder)
          ? 'The remainder matches, but this line has already reached its cutoff.'
          : 'The remainder does not match. This line adds no new ' + result.voice + ' note.';
    setIllustration('Does this line start a note?',[[i+' % '+result.divisor,'Divide and keep the remainder'],[String(result.remainder),'Matches: '+result.allowed.join(', ')],[truth,'What this line does',true]], why);
    return;
  }
  if(line===8||line===9||line===44||line===70){
    setIllustration(line===44?'Initialize → check → advance':'Slots on the score clock',[[String(i),'Current slot'],[format(t)+'s','Slot × 0.25s'],[i===239?'Stop at 240':'Step '+(i+1),'What the loop does next',true]],'The clock grid has a position for each slot. The loop prepares all 240 slots before audio playback.');
    return;
  }
  if(line===34||line===35||line===36||line===37||line===38){
    const result=notesHere.length?format(t)+'s':'No local time';
    setIllustration('Does the code create a time?', [
      [String(i), 'Slot number'],
      [i + ' × 0.25 = ' + format(t) + 's', 'Where the slot sits'],
      [result, notesHere.length ? notesHere.length + ' new ' + (notesHere.length === 1 ? 'call' : 'calls') + ' to add()' : 'add() was skipped', true]
    ], notesHere.length
      ? 'Each call gets its own time = ' + format(t) + '. Open another slot to compare them.'
      : 'This slot has a place on the grid, but no new note starts here. Nothing calls add(), so this line creates no local time.');
    return;
  }
  if([10,11,33,39,40,41,42,43].includes(line)){
    const pitch = pitchAt(s, i);
    if (pitch.directFinal) {
      setIllustration('The ending uses a fixed pitch', [
        [String(i), 'Slot for the last note'], ['add()', 'Called directly'], [format(pitch.frequency) + ' Hz', 'Pitch written in the code', true]
      ], 'The final note uses the pitch on line 67. The motif and ratio lookup are skipped.');
      return;
    }
    setIllustration('How does the code pick the pitch?', [
      [pitch.count + ' % ' + pitch.motif.length + ' = ' + pitch.index, 'Position in MOTIF'],
      [pitch.motifValue + (pitch.shift ? ' + ' + pitch.shift + ' → ' + pitch.degree : ''), 'Position in RATIOS'],
      ['262 × ' + pitch.ratio + ' = ' + format(pitch.frequency) + ' Hz', 'Result of the lookup', true]
    ], pitch.called ? 'The highlighted entries produce the melody note starting at this slot.'
      : 'The highlighted entries show the pitch this lookup would produce. No new melody note uses it at this slot.');
    return;
  }
  if([29,30,31,37,52,54,58,59,63,64,68].includes(line)){
    const current=s.sections.find(part=>t>=part.start&&t<part.end);
    setIllustration('Slot → time → section',[[String(i),'Slot in the full timeline'],[format(t)+'s','Start position on the grid'],[current.title,current.start+' to '+current.end+' seconds',true]], id==='composition'?i+' ÷ 60 = '+format(i/60)+'. Math.floor() gives section '+section+'.':'This experiment uses one section spanning the whole minute.');
    return;
  }
  if(line===67){
    setIllustration('Check the last note',[[String(i),'Current slot'],[String(i===236&&id==='composition'),'Slot 236 in composition?'],[i===236&&id==='composition'?'262 Hz':'Skipped','Final note rule',true]],'Slot 236 means 236 × 0.25 = 59 seconds. The final tone lasts one second.');
    return;
  }
  if((line>=109&&line<=117)||(line>=195&&line<=201)){
    const attack=Math.min(.008,tone.duration/4),release=Math.min(.035,tone.duration/4);
    setIllustration('Attack → hold → release',[[format(attack*1000)+' ms','Raise gain from zero'],[String(tone.gain),'Hold the note gain'],[format(release*1000)+' ms','Return to silence',true]],'Illustrated with a '+tone.voice+' note lasting '+format(tone.duration)+' seconds'+(notesHere.length?' from this slot.':' from the opening of this score.'));
    return;
  }
  if(line>=165&&line<=204){
    setIllustration('Schedule on the audio clock',[['10.06s','Example start after scheduling lead'],[format(tone.time)+'s','Note offset within the score'],[format(10.06+tone.time)+'s','Absolute audio start',true]],'Example audio clock begins at 10 seconds. The note’s own clock position gets added to score start. Its '+tone.wave+' source is shaped by gain and routed to the mix.');
    return;
  }
  if([27,28,45,47,51,69].includes(line)){
    setIllustration('Choose an experiment branch',[[id,'The selected experiment id'],[lesson().label,'Branch used for this score'],[String(s.events.length),'Total note events',true]],'This function checks the id before creating the headings and events. One branch supplies the rules for this experiment.');
    return;
  }
  setIllustration('State of the note schedule',[[String(before.length),'Events before this slot'],[String(notesHere.length),'Note starts in this slot'],[String(before.length+notesHere.length),'Starts through the current slot',true]],'The score contains '+s.events.length+' note events altogether. '+(notesHere.length?'This slot contains '+notesHere.map(e=>e.voice).join(', ')+'.':'There are no starts here. A prior note may still be sounding.'));
}
function renderGrid({ slot, time, events, continuing }) {
  const grid = $('grid');
  const piece = score();
  const firstSlot = Math.min(231, Math.max(0, slot - 4));
  const firstTime = timeAt(firstSlot);
  const lastTime = timeAt(firstSlot + 9);
  const percentage = value => (value - firstTime) * 100 / (lastTime - firstTime) + '%';
  grid.replaceChildren();
  const axis = newElement('div', undefined, 'score-axis');
  axis.setAttribute('role', 'group');
  axis.setAttribute('aria-label', 'Select time on the score. Use left and right arrows to move.');
  function choose(next) {
    setSlot(next);
    restoreFocus(grid, state.slot);
  }
  for (let offset = 0; offset < 9; offset++) {
    const tick = firstSlot + offset;
    const tickTime = timeAt(tick);
    const control = button(format(tickTime), () => choose(tick));
    control.dataset.key = tick;
    control.tabIndex = tick === slot ? 0 : -1;
    control.setAttribute('aria-pressed', String(tick === slot));
    control.setAttribute('aria-label', 'Slot ' + tick + ', ' + format(tickTime) + ' seconds');
    control.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      choose(tick + (event.key === 'ArrowLeft' ? -1 : 1));
    });
    axis.append(control);
  }
  grid.append(newElement('span', 'Time (s)', 'score-voice'), axis);
  for (const voice of ['melody', 'bass', 'pulse']) {
    if (!piece.events.some(note => note.voice === voice)) continue;
    const lane = newElement('div', undefined, 'note-lane');
    lane.setAttribute('role', 'img');
    const at = voiceAt(piece, voice, time);
    const summary = [at.starts.length && 'starts now', at.continuing.length && 'continues from an earlier slot'].filter(Boolean);
    lane.setAttribute('aria-label', voice + ' at ' + format(time) + ' seconds: ' + (summary.join(' and ') || 'quiet'));
    lane.style.setProperty('--cursor', percentage(time));
    const { bars, tracks } = layoutVoice(piece, voice, firstTime, lastTime);
    lane.style.setProperty('--tracks', tracks);
    for (const {start, end, note, track, hasOnset} of bars) {
      const bar = newElement('span', undefined, 'note-bar');
      bar.style.setProperty('--start', percentage(start));
      bar.style.setProperty('--end', percentage(end));
      bar.style.setProperty('--track-center', (track + 0.5) * 100 / tracks + '%');
      if (hasOnset) bar.classList.add('has-onset');
      if (note.time <= time && time < end) bar.classList.add('is-sounding');
      lane.append(bar);
    }
    grid.append(newElement('span', voice, 'score-voice'), lane);
  }
  $('score-summary').textContent = 'Slot ' + slot + ' · ' + format(time) + 's';
  const readouts = [
    ...events.map(note => {
      const item = newElement('li', 'Starts now: ' + note.voice + ' · ' + format(note.frequency) + ' Hz · lasts ' + format(note.duration) + 's');
      item.append(newElement('span', ' · ' + note.wave + ' wave · gain ' + note.gain, 'note-settings'));
      return item;
    }),
    ...continuing.map(note => newElement('li', 'Still sounding: ' + note.voice + ' · started at ' + format(note.time) + 's, ends at ' + format(note.time + note.duration) + 's'))
  ];
  if (!events.length) readouts.unshift(newElement('li', 'No new note starts here.'));
  if (!events.length && !continuing.length) readouts.push(newElement('li', 'All voices are quiet at this moment.'));
  $('events').replaceChildren(...readouts);
}
function renderExtraVisual(notesHere) {
  const root=$('focus-visual'),line=state.line,slot=state.slot;
  root.replaceChildren();
  function example(e,label,description,kind) {
    const item=button('',()=>{
      setSlot(e);
      // Updating the slot redraws the illustration. Focus its replacement control.
      restoreFocus(root,e);
    });
    item.dataset.key=e;
    item.setAttribute('aria-pressed',String(e===slot));
    item.append(newElement('strong',label),newElement('small',description));
    if(kind)item.classList.add(kind);
    return item;
  }
  if(line===34||line===35||line===36||line===38){
    const slots=lesson().id==='composition'?[0,1,236]:lesson().id==='rhythm'?[0,1,4]:[0,1,8];
    const group=newElement('div',undefined,'compare-grid');
    for(const e of slots) {
      const calls=score().events.filter(event=>event.time===timeAt(e)).length;
      group.append(example(e,'Slot '+e,calls?calls+' '+(calls===1?'call':'calls')+' · time = '+format(timeAt(e))+'s':'Skipped · no local time'));
    }
    root.append(group);
    return;
  }
  if ([10, 11, 33, 39, 40, 41, 42, 43].includes(line)) {
    const pitch = pitchAt(score(), slot);
    if (pitch.directFinal) return;
    for (const [label, values, selected] of [['MOTIF', pitch.motif, pitch.index], ['RATIOS', pitch.ratios, pitch.degree]]) {
      root.append(newElement('p', label + ' · position ' + selected, 'caption'));
      const strip = newElement('ol', undefined, 'lookup-strip');
      strip.setAttribute('aria-label', label + ' positions and values');
      for (const [index, value] of values.entries()) {
        const item = newElement('li');
        if (index === selected) item.setAttribute('aria-current', 'true');
        item.append(newElement('small', String(index)), newElement('strong', String(value)));
        strip.append(item);
      }
      root.append(strip);
    }
    return;
  }
  if(lesson().id==='composition'&&[29,30,52,54,59,64,67].includes(line)){
    const group=newElement('div',undefined,'section-meter');
    const sections=SoundLab.summarize(score()).sections;
    const peak=Math.max(...sections.map(section=>section.eventCount));
    for(const section of sections){
      const e=section.start*4;
      const item=example(e,section.title,section.start+'s · '+section.eventCount+' starts');
      const bar=newElement('i');
      bar.style.setProperty('--fill',Math.round(100*section.eventCount/peak)+'%');
      bar.setAttribute('aria-hidden','true');
      item.append(bar);
      item.setAttribute('aria-pressed',String(timeAt(slot)>=section.start&&timeAt(slot)<section.end));
      group.append(item);
    }
    root.append(group);
    return;
  }
  if(rules[line] || [9,44,70].includes(line)){
    const group=newElement('div',undefined,'beat-strip');
    const first=Math.floor(slot/8)*8;
    const label = rules[line] ? 'Eight slots for this rule' : 'Eight adjacent slots';
    for(let e=first;e<first+8;e++){
      const hit = rules[line] ? matchingRule(rules[line], e).passes : score().events.some(note => note.time === timeAt(e));
      group.append(example(e,e,hit?'note':'—',hit?'hit':null));
    }
    root.append(newElement('p',label,'caption'),group);
    return;
  }
  if((line>=109&&line<=117)||(line>=195&&line<=201)){
    const note=notesHere.find(e=>e.voice==='melody')||notesHere[0]||score().events[0];
    const enter=Math.min(.008,note.duration/4),exit=Math.min(.035,note.duration/4);
    const chart=newElement('div',undefined,'envelope-chart');
    const shape=newElement('div',undefined,'envelope-shape');
    shape.style.setProperty('--attack',100*enter/note.duration+'%');
    shape.style.setProperty('--hold',100*(note.duration-exit)/note.duration+'%');
    chart.setAttribute('role','img');
    chart.setAttribute('aria-label','Gain rises over '+format(enter*1000)+' milliseconds, holds, then returns to zero over '+format(exit*1000)+' milliseconds.');
    chart.append(shape);
    const labels=newElement('div',undefined,'envelope-labels');
    labels.append(newElement('span','0s'),newElement('span','Fade in · hold · fade out'),newElement('span',format(note.duration)+'s'));
    root.append(chart,labels);
  }
}

function renderDetail() {
  const line=state.line,i=state.slot,entry=rows[line];
  const info = inspectSlot(score(), i);
  const notesHere = info.events;
  const result = notesHere.length ? 'Starts now: ' + notesHere.map(note => note.voice).join(', ') + '.' : 'No new note starts.';
  const tails = info.continuing.map(note => note.voice + ' from ' + format(note.time) + 's until ' + format(note.time + note.duration) + 's');
  $('slot-result').textContent = 'At ' + format(info.time) + 's · ' + result
    + (tails.length ? ' Still sounding: ' + tails.join(', ') + '.' : notesHere.length ? '' : ' All voices are quiet.');
  $('meaning').textContent=entry[0];
  $('source-number').textContent=line;
  $('selected-code').textContent=source[line-1].trim();
  $('plain').textContent=entry[1];
  $('connection').textContent=entry[3];
  $('tokens').replaceChildren();
  for (const pair of entry[2].split(';')) {
    const at=pair.lastIndexOf('|');
    if(at<0)continue;
    $('tokens').append(newElement('dt',pair.slice(0,at).trim()),newElement('dd',pair.slice(at+1)));
  }
  if ($('slot').valueAsNumber !== i) $('slot').value = String(i);
  $('examples').replaceChildren(...lesson().examples.map(j=>{
    const item=button('Slot '+j,()=>setSlot(j,true));
    item.dataset.key=j;
    item.setAttribute('aria-pressed',String(i===j));
    return item;
  }));
  $('slot-back').disabled=i===0;
  $('slot-next').disabled=i===239;
  inspectAtLine(notesHere);
  renderExtraVisual(notesHere);
  renderGrid(info);
}
function renderLines() {
  const [, , lines] = chapters[state.chapter];
  $('chapter-summary').textContent=lines.length+' explained lines';
  $('progress').textContent=(lines.indexOf(state.line)+1)+' of '+lines.length+' in this chapter';
  for (const container of [$('lines'),$('mobile-lines')]) {
    container.replaceChildren(...lines.map(number=>{
      const item=button('',()=>jumpLine(number,container));
      item.className='line-row';
      item.dataset.key=number;
      if(number===state.line)item.setAttribute('aria-current','step');
      item.append(newElement('span',String(number),'line-num'),newElement('code',source[number-1].trim()));
      return item;
    }));
    const current=container.querySelector('[aria-current=step]');
    if(current) {
      const row=current.getBoundingClientRect(), body=container.getBoundingClientRect();
      if(row.top<body.top || row.bottom>body.bottom)container.scrollTop+=row.top-body.top-8;
    }
  }
  $('previous').disabled = moveLine(currentPosition(), -1).line === state.line;
  $('next').disabled = moveLine(currentPosition(), 1).line === state.line;
}
function navigate(direction) {
  const next = moveLine(currentPosition(), direction);
  state.chapter = chapters.findIndex(chapter => chapter[0] === next.chapter);
  $('chapter').value = String(state.chapter);
  jumpLine(next.line);
}
function renderLesson() {
  $('experiments').replaceChildren(...lessons.map((item,index)=>{
    const control=button(item.label,()=>{
      stopAudio('Ready');
      state.lesson=index;
      state.chapter=4;
      state.line=[46,48,52][index];
      state.slot=0;
      renderLesson();
      rememberPosition();
      restoreFocus($('experiments'),index);
    });
    control.dataset.key=index;
    control.setAttribute('aria-pressed',String(index===state.lesson));
    return control;
  }));
  $('chapter').value=String(state.chapter);
  const options = state.lesson===1
    ? [['Full mix','all'],['Melody only','melody'],['Bass only','bass'],['Pulse only','pulse']]
    : state.lesson===2
      ? [['Seed · 0–8s','0'],['Growth · 15–23s','15'],['Density · 30–38s','30'],['Return · 45–53s','45'],['Ending · 58–60s','58']]
      : [['Opening · 0–8s','all']];
  $('mix').replaceChildren(...options.map(([label,value])=>{const option=newElement('option',label);option.value=value;return option;}));
  $('listen-guidance').textContent = lesson().guide;
  $('practice-text').textContent = practices[state.lesson];
  $('sketch-link').href = 'sketches/' + lesson().id + '.js';
  renderLines();
  renderDetail();
}
function stopAudio(message = 'Stopped.') {
  previews.stop(message);
}
function playAudio() {
  const option = $('mix').value;
  const start = state.lesson === 2 ? Number(option) : 0;
  const end = Math.min(60, start + 8);
  const voice = state.lesson === 1 && option !== 'all' ? option : null;
  const label = 'Playing ' + (voice ? voice + ' only, ' : '') + start + '–' + end + ' seconds of the score.';
  return previews.play({ score: makeExcerpt(score(), start, end, voice), label });
}
$('chapter').replaceChildren(...chapters.map((chapter,index)=>{
  const option=newElement('option',chapter[1]);
  option.value=String(index);
  return option;
}));
$('chapter').addEventListener('change',()=>{state.chapter=Number($('chapter').value);state.line=chapters[state.chapter][2][0];renderLines();renderDetail();rememberPosition();});
$('previous').onclick=()=>navigate(-1);
$('next').onclick=()=>navigate(1);
$('slot').addEventListener('change',()=>setSlot($('slot').valueAsNumber));
$('slot').addEventListener('input', () => {
  const value = $('slot').valueAsNumber;
  if (Number.isInteger(value) && value >= 0 && value < 240) setSlot(value);
});
$('slot-back').onclick=()=>setSlot(state.slot-1);
$('slot-next').onclick=()=>setSlot(state.slot+1);
$('play').onclick=playAudio;
$('stop').onclick=()=>stopAudio();
$('mix').addEventListener('change',()=>stopAudio('Preview selected'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAudio('Stopped when the preview was hidden');});
window.addEventListener('pagehide',()=>stopAudio('Ready'));
$('full-source').textContent=source.map((line,index)=>String(index+1).padStart(3)+'  '+line).join('\n');
renderLesson();
rememberPosition();

document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  $('main').focus({ preventScroll: true });
  $('main').scrollIntoView();
});
function followRoute() {
  if (location.hash === '#main') return;
  const next = resolvePosition(location.hash, currentPosition());
  const lessonIndex = lessons.findIndex(lesson => lesson.id === next.lesson);
  const changedLesson = lessonIndex !== state.lesson;
  if (changedLesson) {
    stopAudio('Ready.');
    state.slot = 0;
  }
  state.lesson = lessonIndex;
  state.chapter = chapters.findIndex(chapter => chapter[0] === next.chapter);
  state.line = next.line;
  if (changedLesson) renderLesson();
  else {
    $('chapter').value = String(state.chapter);
    renderLines();
    renderDetail();
  }
  rememberPosition();
}
window.addEventListener('hashchange', followRoute);
document.querySelector('.quick-start').addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (location.hash !== link.hash) {
    history.pushState(null, '', link.hash);
    followRoute();
  }
  $('meaning').focus();
});

})();
