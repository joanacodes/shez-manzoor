/**
 * A showreel player (components/ReelPlayer.astro): the one on the home page and the one in the
 * showreel window. It plays a reel with sound (play() is called during the tap itself, which is
 * what phones ask for), switches between the reels, picks each one up where it was left, and
 * gives the frame the film's shape. One reel plays at a time; a song preview stops it, and it
 * stops a song preview (scripts/preview.ts). While a reel plays or the window is open, the
 * document hears a "showreel" event (detail: true, then false), so the cinema's clips wait.
 */
export type Reel = { id: string; title: string; role: string; where: string; video: string; still?: string; aspect: number };
export type Player = {
  video: HTMLVideoElement;
  list: Reel[];
  /** the reel in the player, once one has been loaded */
  current: () => Reel | undefined;
  show: (reel: Reel, play: boolean) => void;
};

const players: Player[] = [];
let busy = false;

/** Tells the cinema whether a reel has the screen: one is playing, or the window is open. */
export function syncScreens() {
  const now = !!document.querySelector('dialog[data-reel][open]') || players.some((p) => !p.video.paused && !p.video.ended);
  if (now === busy) return;
  busy = now;
  document.dispatchEvent(new CustomEvent('showreel', { detail: now }));
}

// a song preview takes over from the reels
document.addEventListener('songplay', () => players.forEach((p) => p.video.pause()));

export function setupPlayer(root: HTMLElement): Player | undefined {
  const list: Reel[] = JSON.parse(root.querySelector('[data-reel-list]')?.textContent ?? '[]');
  if (!list.length) return undefined;
  const video = root.querySelector<HTMLVideoElement>('[data-reel-video]')!;
  const title = root.querySelector<HTMLElement>('[data-reel-title]')!;
  const role = root.querySelector<HTMLElement>('[data-reel-role]')!;
  const where = root.querySelector<HTMLElement>('[data-reel-where]')!;
  const choices = [...root.querySelectorAll<HTMLButtonElement>('[data-reel-choice]')];
  const start = root.querySelector<HTMLButtonElement>('[data-reel-start]');
  /** where each reel was left, in seconds */
  const left = new Map<string, number>();
  // the player on the page comes with the first reel in it
  let current: Reel | undefined = video.getAttribute('src') ? list[0] : undefined;

  // the big play button stands in for the browser's own until the first play
  if (start) video.controls = false;
  const begin = () => {
    if (!start || video.controls) return;
    video.controls = true;
    root.classList.add('is-started');
  };

  function show(reel: Reel, play: boolean) {
    if (current?.id !== reel.id) {
      if (current) left.set(current.id, video.currentTime);
      current = reel;
      video.poster = reel.still ?? '';
      video.src = reel.video;
      // the frame takes the film's shape
      root.style.setProperty('--aspect', String(reel.aspect));
      const from = left.get(reel.id);
      if (from) video.addEventListener('loadedmetadata', () => (video.currentTime = from), { once: true });
      title.textContent = reel.title;
      role.textContent = reel.role;
      where.textContent = reel.where;
      choices.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.reelChoice === reel.id)));
    }
    if (play) {
      begin();
      // a browser that says no leaves the still and its own play button
      video.play().catch(() => {});
    }
  }

  const player: Player = { video, list, current: () => current, show };
  players.push(player);

  start?.addEventListener('click', () => show(current ?? list[0], true));
  choices.forEach((c) =>
    c.addEventListener('click', () => {
      const reel = list.find((r) => r.id === c.dataset.reelChoice);
      if (reel) show(reel, true);
    }),
  );
  video.addEventListener('play', () => {
    begin();
    // one reel at a time
    players.forEach((p) => p !== player && p.video.pause());
    syncScreens();
    // the lock screen and the headphones show which reel is playing
    if (!current || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${current.title}: showreel`,
        artist: 'Shez Manzoor',
        artwork: current.still ? [{ src: new URL(current.still, location.href).href, sizes: '1280x545', type: 'image/jpeg' }] : [],
      });
    } catch {
      /* not offered by this browser */
    }
  });
  for (const type of ['pause', 'ended', 'emptied']) video.addEventListener(type, syncScreens);
  return player;
}
