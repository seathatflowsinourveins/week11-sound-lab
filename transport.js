(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.createTransport = factory;
})(typeof globalThis === 'object' ? globalThis : this, function (engine, makeContext, notify) {
  'use strict';
  let context, active, ticket = 0, state = 'idle';
  const report = (next, detail) => { state = next; if (notify) notify(next, detail); };
  function stop(reason = 'Stopped. Play starts again from 0 seconds.') {
    ticket++;
    if (active) active.stop();
    active = null;
    report('idle', reason);
  }
  async function play(id) {
    stop('Preparing sound…');
    const request = ticket;
    report('pending', 'Enabling audio…');
    try {
      const score = engine.makeScore(id);
      if (!context || context.state === 'closed') context = makeContext();
      await context.resume();
      if (request !== ticket) return false;
      if (context.state !== 'running') throw new Error('Audio is still suspended. Press Play again.');
      active = engine.playScore(context, score, {onEnd() {
        if (request !== ticket) return;
        active = null;
        report('ended', 'Finished: 60 seconds. You can replay the same composition.');
      }});
      report('playing', id);
      return true;
    } catch (error) {
      if (request === ticket) { active = null; report('error', error.message || 'Audio could not start.'); }
      return false;
    }
  }
  function elapsed() {
    return active ? Math.min(60, Math.max(0, context.currentTime - active.startTime)) : state === 'ended' ? 60 : 0;
  }
  return {play, stop, elapsed, get state() { return state; }};
});
