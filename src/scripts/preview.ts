/**
 * 30-second previews: any button with data-preview plays that clip in one shared player,
 * shown as a small bar at the bottom of the screen with links to the full song.
 */
const bar = document.querySelector<HTMLElement>('[data-player-bar]');
if (bar) setup(bar);

function setup(bar: HTMLElement) {
  const audio = new Audio();
  audio.preload = 'none';
  const art = bar.querySelector<HTMLImageElement>('[data-player-art]')!;
  const title = bar.querySelector<HTMLElement>('[data-player-title]')!;
  const by = bar.querySelector<HTMLElement>('[data-player-by]')!;
  const toggle = bar.querySelector<HTMLButtonElement>('[data-player-toggle]')!;
  const close = bar.querySelector<HTMLButtonElement>('[data-player-close]')!;
  const progress = bar.querySelector<HTMLElement>('[data-player-progress]')!;
  const apple = bar.querySelector<HTMLAnchorElement>('[data-player-apple]')!;
  const spotify = bar.querySelector<HTMLAnchorElement>('[data-player-spotify]')!;
  let current = '';

  const buttons = () => document.querySelectorAll<HTMLElement>('[data-preview]');
  const sync = () => {
    const playing = !audio.paused && !audio.ended;
    bar.classList.toggle('is-playing', playing);
    toggle.setAttribute('aria-label', playing ? 'Pause preview' : 'Play preview');
    buttons().forEach((b) => {
      const on = b.dataset.preview === current && playing;
      b.classList.toggle('is-playing', on);
      b.setAttribute('aria-pressed', String(on));
    });
  };

  function load(b: HTMLElement) {
    current = b.dataset.preview!;
    audio.src = current;
    title.textContent = b.dataset.previewTitle ?? '';
    by.textContent = b.dataset.previewBy ?? '';
    if (b.dataset.previewArt) {
      art.src = b.dataset.previewArt;
      art.hidden = false;
    } else art.hidden = true;
    for (const [link, url] of [
      [apple, b.dataset.previewApple],
      [spotify, b.dataset.previewSpotify],
    ] as const) {
      link.hidden = !url;
      if (url) link.href = url;
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title.textContent ?? '',
        artist: by.textContent ?? '',
        album: 'Preview',
        artwork: b.dataset.previewArt ? [{ src: new URL(b.dataset.previewArt, location.href).href, sizes: '120x120', type: 'image/webp' }] : [],
      });
    }
  }

  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-preview]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    if (b.dataset.preview === current && !audio.paused) {
      audio.pause();
      return;
    }
    if (b.dataset.preview !== current) load(b);
    bar.hidden = false;
    requestAnimationFrame(() => bar.classList.add('is-open'));
    void audio.play().catch(() => sync());
  });
  toggle.addEventListener('click', () => (audio.paused ? void audio.play() : audio.pause()));
  close.addEventListener('click', () => {
    audio.pause();
    bar.classList.remove('is-open');
    window.setTimeout(() => (bar.hidden = true), 300);
  });
  for (const ev of ['play', 'pause', 'ended', 'emptied']) audio.addEventListener(ev, sync);
  audio.addEventListener('timeupdate', () => {
    const d = audio.duration || 30;
    progress.style.setProperty('--p', String(Math.min(1, audio.currentTime / d)));
  });
  audio.addEventListener('ended', () => progress.style.setProperty('--p', '0'));
  // a full player opening in a panel takes over from the preview
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-embed]')) audio.pause();
  });
  // buttons inside panels are created after load: keep their state in step
  new MutationObserver(sync).observe(document.body, { childList: true, subtree: true });
}
