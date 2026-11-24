/**
 * The showreel window (components/Showreel.astro). Anything with data-reel-open="<reel>" opens
 * it on that reel and plays it with sound: play() is called during the tap itself, which is what
 * phones ask for. Each reel picks up where it was left. While the window is open the document
 * hears a "showreel" event (detail: true, then false when it closes), so the cinema's clips wait.
 */
type Reel = { id: string; title: string; role: string; where: string; video: string; still?: string; aspect: number };

const dialog = document.querySelector<HTMLDialogElement>('[data-reel]');
if (dialog) setup(dialog);

function setup(dialog: HTMLDialogElement) {
  const list: Reel[] = JSON.parse(dialog.querySelector('[data-reel-list]')?.textContent ?? '[]');
  if (!list.length) return;
  const video = dialog.querySelector<HTMLVideoElement>('[data-reel-video]')!;
  const title = dialog.querySelector<HTMLElement>('[data-reel-title]')!;
  const role = dialog.querySelector<HTMLElement>('[data-reel-role]')!;
  const where = dialog.querySelector<HTMLElement>('[data-reel-where]')!;
  const choices = [...dialog.querySelectorAll<HTMLButtonElement>('[data-reel-choice]')];
  const closeButton = dialog.querySelector<HTMLElement>('[data-reel-close]')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  /** where each reel was left, in seconds */
  const left = new Map<string, number>();
  let current: Reel | undefined;
  let opener: HTMLElement | null = null;
  let closing = 0;

  const tell = (open: boolean) => document.dispatchEvent(new CustomEvent('showreel', { detail: open }));

  function show(reel: Reel, play: boolean) {
    if (current?.id !== reel.id) {
      if (current) left.set(current.id, video.currentTime);
      current = reel;
      video.poster = reel.still ?? '';
      video.src = reel.video;
      // the frame takes the film's shape
      dialog.style.setProperty('--aspect', String(reel.aspect));
      const from = left.get(reel.id);
      if (from) video.addEventListener('loadedmetadata', () => (video.currentTime = from), { once: true });
      title.textContent = reel.title;
      role.textContent = reel.role;
      where.textContent = reel.where;
      choices.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.reelChoice === reel.id)));
    }
    // a browser that says no leaves the still and its own play button
    if (play) video.play().catch(() => {});
  }

  function open(id: string | undefined, from: HTMLElement | null, play = true) {
    const reel = list.find((r) => r.id === id) ?? current ?? list[0];
    window.clearTimeout(closing);
    opener = from;
    if (!dialog.open) {
      dialog.showModal();
      // the window starts below the screen: focusing it must not scroll it there
      dialog.scrollTop = 0;
      closeButton.focus({ preventScroll: true });
      tell(true);
    }
    show(reel, play);
    // two frames later, so the window moves in from where it starts
    requestAnimationFrame(() => requestAnimationFrame(() => dialog.classList.add('is-open')));
  }
  function close() {
    if (!dialog.open) return;
    video.pause();
    dialog.classList.remove('is-open');
    window.clearTimeout(closing);
    closing = window.setTimeout(() => dialog.close(), reduced.matches ? 250 : 450);
  }
  dialog.addEventListener('close', () => {
    window.clearTimeout(closing);
    video.pause();
    dialog.classList.remove('is-open');
    if (location.hash === '#showreel') history.replaceState(history.state, '', location.pathname + location.search);
    tell(false);
    opener?.focus({ preventScroll: true });
    opener = null;
  });
  // Escape: the window leaves the way it came
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  // a tap outside the window closes it
  let downOutside = false;
  dialog.addEventListener('pointerdown', (e) => (downOutside = e.target === dialog));
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog && downOutside) close();
  });
  closeButton.addEventListener('click', close);
  choices.forEach((c) =>
    c.addEventListener('click', () => {
      const reel = list.find((r) => r.id === c.dataset.reelChoice);
      if (reel) show(reel, true);
    }),
  );
  document.addEventListener('click', (e) => {
    const trigger = (e.target as Element).closest<HTMLElement>('[data-reel-open]');
    if (!trigger || e.defaultPrevented) return;
    e.preventDefault();
    open(trigger.dataset.reelOpen, trigger);
  });
  // a link to #showreel opens it on the first reel, waiting for a tap to play
  if (location.hash === '#showreel') open(undefined, null, false);
  addEventListener('hashchange', () => location.hash === '#showreel' && open(undefined, null));

  // the lock screen and the headphones show which reel is playing
  video.addEventListener('play', () => {
    if (!current || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${current.title}: showreel`,
        artist: 'Shez Manzoor',
        artwork: current.still ? [{ src: new URL(current.still, location.href).href, sizes: '1280x720', type: 'image/jpeg' }] : [],
      });
    } catch {
      /* not offered by this browser */
    }
  });
}

export {};
