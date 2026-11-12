export function startHeroVideo() {
  const play = document.getElementById('heroPlayBtn');
  const video = document.getElementById('heroVideo');
  if (!play || !video) return;

  play.addEventListener('click', () => {
    play.remove();
    video.hidden = false;
    video.focus();
    video.play();
  });
}
