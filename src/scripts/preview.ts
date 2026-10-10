/**
 * 30-second previews: any button with data-preview plays that clip in one shared player,
 * shown as a bar at the bottom of the screen (over the panels too) to pause, play again,
 * or open the full song. Buttons show a spinner while the song loads, then a pause sign.
 * When a preview ends, the next song plays: the rest of the list it was picked from (the
 * carousel, the discography, a tracklist), then every other song on the page, each once.
 * Songs fade in and out, and the bar fades to the new one.
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
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  type Song = { url: string; title: string; by: string; art?: string; apple?: string; spotify?: string };
  const songOf = (b: HTMLElement): Song => ({
    url: b.dataset.preview!,
    title: b.dataset.previewTitle ?? '',
    by: b.dataset.previewBy ?? '',
    art: b.dataset.previewArt,
    apple: b.dataset.previewApple,
    spotify: b.dataset.previewSpotify,
  });
  // what plays after the song that was picked, which comes first
  let queue: Song[] = [];
  let pos = 0;
  function queueFrom(b: HTMLElement) {
    const page = [...document.querySelectorAll<HTMLElement>('[data-preview]')].filter((e) => !e.closest('dialog'));
    const list = b.closest('ol, ul');
    const own = list ? [...list.querySelectorAll<HTMLElement>('[data-preview]')] : [b];
    // in a panel, the page's songs go on from the piece of work the panel is about
    const from = b.closest('article')?.querySelector<HTMLElement>('.play--preview')?.dataset.preview ?? b.dataset.preview;
    const at = page.findIndex((e) => e.dataset.preview === from);
    const seen = new Set<string>();
    queue = [...own.slice(own.indexOf(b)), ...page.slice(at + 1), ...page.slice(0, at + 1)]
      .map(songOf)
      .filter((song) => !seen.has(song.url) && !!seen.add(song.url));
    pos = 0;
  }

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

  function load(song: Song) {
    current = song.url;
    audio.src = current;
    title.textContent = song.title;
    by.textContent = song.by;
    if (song.art) {
      art.src = song.art;
      art.hidden = false;
    } else art.hidden = true;
    for (const [link, url] of [
      [apple, song.apple],
      [spotify, song.spotify],
    ] as const) {
      link.hidden = !url;
      if (url) link.href = url;
    }
    progress.style.setProperty('--p', '0');
    // the new song's cover and name fade in
    if (bar.classList.contains('is-open')) {
      const lift = reduced.matches ? 'none' : 'translateY(6px)';
      for (const el of [art, title.parentElement!]) {
        el.animate?.([{ opacity: 0, transform: lift }, { opacity: 1, transform: 'none' }], { duration: 600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
      }
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.by,
        album: 'Preview',
        artwork: song.art ? [{ src: new URL(song.art, location.href).href, sizes: '120x120', type: 'image/webp' }] : [],
      });
    }
  }

  // the covers on the first screen make room for the bar; the stage frames the set again after
  const refit = () => window.setTimeout(() => document.dispatchEvent(new Event('stage:refit')), 500);

  const start = () => {
    setLoading(true);
    // silent until it fades in
    audio.volume = 0;
    const src = audio.src;
    // a play() cut short by the next song does not stop that song's spinner
    audio.play().catch(() => audio.src === src && setLoading(false));
  };
  /** The next (or previous) song in the queue; false at either end. */
  const step = (by: 1 | -1) => {
    const to = pos + by;
    if (to < 0 || to >= queue.length) return false;
    pos = to;
    load(queue[pos]);
    start();
    return true;
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
    if (b.dataset.preview !== current) {
      queueFrom(b);
      load(queue[0]);
    }
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

  // each song fades in as it starts (or starts again) and out over its last seconds. A timer
  // rather than animation frames, so it carries on in a background tab. iPhones ignore the
  // volume a page sets and play at full volume.
  const FADE_IN = 1.2;
  const FADE_OUT = 1.6;
  let fadeFrom = 0;
  let fadeTimer = 0;
  const fade = () => {
    const sinceStart = (performance.now() - fadeFrom) / 1000;
    const left = (Number.isFinite(audio.duration) ? audio.duration : 30) - audio.currentTime;
    audio.volume = Math.max(0, Math.min(1, sinceStart / FADE_IN, left / FADE_OUT));
  };
  audio.addEventListener('playing', () => {
    fadeFrom = performance.now();
    fade();
    window.clearInterval(fadeTimer);
    fadeTimer = window.setInterval(fade, 40);
  });
  for (const ev of ['pause', 'ended', 'error']) audio.addEventListener(ev, () => window.clearInterval(fadeTimer));
  audio.addEventListener('waiting', () => !audio.paused && setLoading(true));
  for (const ev of ['pause', 'ended', 'error']) audio.addEventListener(ev, () => setLoading(false));
  audio.addEventListener('timeupdate', () => {
    const d = audio.duration || 30;
    progress.style.setProperty('--p', String(Math.min(1, audio.currentTime / d)));
  });
  audio.addEventListener('ended', () => {
    progress.style.setProperty('--p', '0');
    // one after the other
    step(1);
  });
  // a song that will not load is skipped
  audio.addEventListener('error', () => {
    const failed = current;
    window.setTimeout(() => current === failed && step(1), 1200);
  });
  // the next and previous buttons of headphones and the lock screen
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('nexttrack', () => step(1));
      navigator.mediaSession.setActionHandler('previoustrack', () => step(-1));
    } catch {
      /* not offered by this browser */
    }
  }
  // a full player opening in a panel takes over from the preview
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-embed]')) audio.pause();
  });
  // buttons inside panels are created after load: keep their state in step
  new MutationObserver(sync).observe(document.body, { childList: true, subtree: true });
}
