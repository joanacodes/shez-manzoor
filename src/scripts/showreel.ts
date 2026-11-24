/**
 * The showreel window (components/Showreel.astro). Anything with data-reel-open="<reel>" opens
 * it on that reel and plays it with sound, during the tap itself, which is what phones ask for.
 * The player inside is a ReelPlayer (scripts/reel-player.ts): one reel at a time, each picked
 * up where it was left, and the cinema's clips wait while the window is open.
 */
import { setupPlayer, syncScreens } from './reel-player';

const dialog = document.querySelector<HTMLDialogElement>('dialog[data-reel]');
const player = dialog && setupPlayer(dialog.querySelector<HTMLElement>('[data-reel-player]')!);
if (dialog && player) setup(dialog, player);

function setup(dialog: HTMLDialogElement, player: NonNullable<ReturnType<typeof setupPlayer>>) {
  const closeButton = dialog.querySelector<HTMLElement>('[data-reel-close]')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let opener: HTMLElement | null = null;
  let closing = 0;

  function open(id: string | undefined, from: HTMLElement | null, play = true) {
    const reel = player.list.find((r) => r.id === id) ?? player.current() ?? player.list[0];
    window.clearTimeout(closing);
    opener = from;
    if (!dialog.open) {
      dialog.showModal();
      // the window starts below the screen: focusing it must not scroll it there
      dialog.scrollTop = 0;
      closeButton.focus({ preventScroll: true });
      syncScreens();
    }
    player.show(reel, play);
    // two frames later, so the window moves in from where it starts
    requestAnimationFrame(() => requestAnimationFrame(() => dialog.classList.add('is-open')));
  }
  function close() {
    if (!dialog.open) return;
    player.video.pause();
    dialog.classList.remove('is-open');
    window.clearTimeout(closing);
    closing = window.setTimeout(() => dialog.close(), reduced.matches ? 250 : 450);
  }
  dialog.addEventListener('close', () => {
    window.clearTimeout(closing);
    player.video.pause();
    dialog.classList.remove('is-open');
    if (location.hash === '#showreel') history.replaceState(history.state, '', location.pathname + location.search);
    syncScreens();
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
  document.addEventListener('click', (e) => {
    const trigger = (e.target as Element).closest<HTMLElement>('[data-reel-open]');
    if (!trigger || e.defaultPrevented) return;
    e.preventDefault();
    open(trigger.dataset.reelOpen, trigger);
  });
  // a link to #showreel opens it on the first reel, waiting for a tap to play, unless the page
  // has the showreel on it (the home page): then the link goes there
  const wanted = () => location.hash === '#showreel' && !document.getElementById('showreel');
  if (wanted()) open(undefined, null, false);
  addEventListener('hashchange', () => wanted() && open(undefined, null));
}
