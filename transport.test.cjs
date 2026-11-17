'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const create = require('./transport.js');
test('Stop cancels an audio resume still pending', async () => {
  let resume, starts=0;
  const context={state:'running',resume:()=>new Promise(r=>resume=r)};
  const transport=create({makeScore:()=>({}),playScore:()=>{starts++;return {stop(){}};}},()=>context);
  const pending=transport.play('composition');
  transport.stop(); resume();
  assert.equal(await pending,false); assert.equal(starts,0); assert.equal(transport.state,'idle');
});
test('A later play supersedes a pending start, and Stop stops the live graph', async () => {
  const waiting=[]; let starts=0,stops=0;
  const context={state:'running',currentTime:10,resume:()=>new Promise(r=>waiting.push(r))};
  const transport=create({makeScore:id=>({id}),playScore:()=>{starts++;return {startTime:10,stop(){stops++;}};}},()=>context);
  const first=transport.play('pulse'),second=transport.play('composition');
  waiting[0]();waiting[1]();
  assert.equal(await first,false);assert.equal(await second,true);assert.equal(starts,1);
  context.currentTime=14;assert.equal(transport.elapsed(),4);transport.stop();assert.equal(stops,1);
});
test('Rejected resume is reported; retry can succeed without silently substituting an engine', async () => {
  let reject=true;
  const context={state:'running',resume:()=>reject?Promise.reject(Error('resume rejected')):Promise.resolve()};
  const transport=create({makeScore:()=>({}),playScore:()=>({stop(){},startTime:0})},()=>context);
  assert.equal(await transport.play('composition'),false);assert.equal(transport.state,'error');
  reject=false;assert.equal(await transport.play('composition'),true);transport.stop();
});
