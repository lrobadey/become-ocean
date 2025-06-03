export function updatePlayPauseIcon(audio, playPauseButton, playIconSVG, pauseIconSVG) {
  if (!audio || !playPauseButton) return;
  if (audio.paused) {
    playPauseButton.innerHTML = playIconSVG;
    playPauseButton.setAttribute('aria-label', 'Play');
  } else {
    playPauseButton.innerHTML = pauseIconSVG;
    playPauseButton.setAttribute('aria-label', 'Pause');
  }
}
