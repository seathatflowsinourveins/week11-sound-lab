'use strict';
const player = createTransport(SoundLab, () => new (window.AudioContext || window.webkitAudioContext)(), (state, detail) => {
  document.getElementById('status').textContent = state === 'playing' ? 'Playing the 60-second composition. Stop ends this performance.' : detail;
  document.getElementById('play').disabled = state === 'pending' || state === 'playing';
});
document.getElementById('play').addEventListener('click', () => player.play('composition'));
document.getElementById('stop').addEventListener('click', () => player.stop());
document.addEventListener('visibilitychange', () => {if(document.hidden) player.stop('Stopped because this page was hidden.');});
window.addEventListener('pagehide', () => player.stop());
