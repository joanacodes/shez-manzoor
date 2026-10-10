/**
 * 30-second previews: any button with data-preview plays that clip in one shared player,
 * shown as a bar at the bottom of the screen (over the panels too) to pause, play again,
 * or open the full song. Buttons show a spinner while the song loads, then a pause sign.
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
  // asked to play, not playing yet (or buffering)
  let loading = false;

  const buttons = () => document.querySelectorAll<HTMLElement>('[data-preview]');
  const sync = () => {
    const playing = !audio.paused && !audio.ended && !loading;
    bar.classList.toggle('is-playing', playing);
    bar.classList.toggle('is-loading', loading);
    toggle.setAttribute('aria-label', loading ? 'Loading the preview' : playing ? 'Pause the preview' : 'Play the preview');
    buttons().forEach((b) => {
      const mine = b.dataset.preview === current;
      b.classList.toggle('is-playing', mine && playing);
      b.classList.toggle('is-loading', mine && loading);
      b.setAttribute('aria-pressed', String(mine && (playing || loading)));
      if (mine && loading) b.setAttribute('aria-busy', 'true');
      else b.removeAttribute('aria-busy');
    });
  };
  const setLoading = (on: boolean) => {
    loading = on;
    sync();
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
    progress.style.setProperty('--p', '0');
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title.textContent ?? '',
        artist: by.textContent ?? '',
        album: 'Preview',
        artwork: b.dataset.previewArt ? [{ src: new URL(b.dataset.previewArt, location.href).href, sizes: '120x120', type: 'image/webp' }] : [],
      });
    }
  }

  // the covers on the first screen make room for the bar; the stage frames the set again after
  const refit = () => window.setTimeout(() => document.dispatchEvent(new Event('stage:refit')), 500);

  const start = () => {
    setLoading(true);
    audio.play().catch(() => setLoading(false));
  };

  // the bar sits in an open panel, so it stays above it; back on the page when the panel closes
  const home = bar.parentElement!;
  const place = () => {
    const target = document.querySelector('dialog[open]') ?? home;
    if (bar.parentElement !== target) target.append(bar);
  };
  new MutationObserver(place).observe(document.body, { subtree: true, attributeFilter: ['open'] });

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
    place();
    if (!bar.classList.contains('is-open')) {
      bar.hidden = false;
      requestAnimationFrame(() => bar.classList.add('is-open'));
      refit();
    }
    start();
  });
  toggle.addEventListener('click', () => (audio.paused || audio.ended ? start() : audio.pause()));
  close.addEventListener('click', () => {
    audio.pause();
    bar.classList.remove('is-open');
    window.setTimeout(() => {
      if (!bar.classList.contains('is-open')) bar.hidden = true;
    }, 300);
    refit();
  });
  audio.addEventListener('playing', () => setLoading(false));
  audio.addEventListener('waiting', () => !audio.paused && setLoading(true));
  for (const ev of ['pause', 'ended', 'error', 'emptied']) audio.addEventListener(ev, () => setLoading(false));
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
