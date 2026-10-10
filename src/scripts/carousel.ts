/**
 * The ring of work cards: turns with a drag or swipe (with a little inertia), the arrows,
 * the keyboard or a trackpad, and opens the detail panel for the card in front.
 * The panel loads Apple Music and Spotify players only when a play button is pressed
 * (and, for visitors who declined cookies, opens the song on their site instead).
 */
import { mayEmbed } from './consent';

const root = document.querySelector<HTMLElement>('[data-work-carousel]');
const dialog = document.querySelector<HTMLDialogElement>('[data-work-dialog]');
if (root && dialog) setup(root, dialog);

function setup(root: HTMLElement, dialog: HTMLDialogElement) {
  const viewport = root.querySelector<HTMLElement>('[data-work-viewport]')!;
  const ring = root.querySelector<HTMLElement>('[data-work-ring]')!;
  const items = [...ring.querySelectorAll<HTMLElement>('.work__item')];
  const cards = items.map((li) => li.querySelector<HTMLButtonElement>('.card')!);
  const n = cards.length;
  const counter = root.querySelector('[data-work-current]');
  const caption = root.querySelector<HTMLElement>('[data-work-caption]');
  const capCat = root.querySelector('[data-work-cat]');
  const capTitle = root.querySelector('[data-work-title]');
  const capBy = root.querySelector('[data-work-by]');
  let captionTimer = 0;
  const live = root.querySelector('[data-work-live]');
  const body = dialog.querySelector<HTMLElement>('[data-detail-body]')!;
  const posLabel = dialog.querySelector('[data-detail-pos]');
  const pad = (v: number) => String(v).padStart(2, '0');
  const wrap = (i: number) => ((i % n) + n) % n;

  const step = 360 / n;
  let radius = 600;
  let gap = 14;
  let pos = 0; // the card at `pos` faces the front
  let target = 0;
  let current = -1;
  let raf = 0;

  /* ---------- geometry ---------- */
  function measure() {
    const w = items[0].offsetWidth || 156;
    gap = parseFloat(getComputedStyle(root).getPropertyValue('--card-gap')) || 14;
    radius = Math.max((w / 2 + gap / 2) / Math.tan(Math.PI / n), w * 1.3);
    ring.style.setProperty('--r', `${radius.toFixed(1)}px`);
    ring.style.setProperty('--step', `${step}deg`);
    viewport.style.perspective = `${Math.round(radius * 2.1)}px`;
    render();
  }
  const pxPerCard = () => (items[0].offsetWidth || 156) + gap;

  function render() {
    ring.style.setProperty('--turn', `${(-pos * step).toFixed(3)}deg`);
    for (let i = 0; i < n; i++) {
      let d = wrap(i - pos);
      if (d > n / 2) d -= n;
      const f = Math.cos((d * step * Math.PI) / 180);
      const s = items[i].style;
      s.setProperty('--o', f > 0 ? (0.2 + 0.8 * Math.pow(f, 1.5)).toFixed(3) : '0');
      s.setProperty('--shade', Math.min(0.62, Math.abs(d) * 0.2).toFixed(3));
      s.setProperty('--d', String(Math.min(9, Math.round(Math.abs(d)))));
    }
    const idx = wrap(Math.round(pos));
    if (idx !== current) {
      current = idx;
      cards.forEach((c, i) => {
        c.classList.toggle('is-front', i === idx);
        items[i].classList.toggle('is-front', i === idx);
        c.tabIndex = i === idx ? 0 : -1;
        const play = items[i].querySelector<HTMLElement>('.card__play');
        if (play) play.tabIndex = i === idx ? 0 : -1;
      });
      if (caption) {
        caption.classList.add('is-changing');
        window.clearTimeout(captionTimer);
        captionTimer = window.setTimeout(() => {
          const c = cards[current];
          if (counter) counter.textContent = pad(current + 1);
          if (capCat) capCat.textContent = c.dataset.cat ?? '';
          if (capTitle) capTitle.textContent = c.dataset.title ?? '';
          if (capBy) capBy.textContent = c.dataset.by ?? '';
          caption.dataset.kind = c.dataset.kind ?? '';
          caption.classList.remove('is-changing');
        }, 110);
      }
    }
  }

  const still = matchMedia('(prefers-reduced-motion: reduce)');
  function animate() {
    if (still.matches && !dragging) {
      // no spinning for people who asked for less motion: the ring jumps
      cancelAnimationFrame(raf);
      raf = 0;
      pos = target;
      render();
      return;
    }
    if (raf) return;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min(0.05, Math.max(0, (now - last) / 1000)) : 1 / 60;
      last = now;
      if (!dragging) {
        pos += (target - pos) * (1 - Math.exp(-dt * 8.5));
        if (Math.abs(target - pos) < 0.0006) {
          pos = target;
          render();
          raf = 0;
          return;
        }
      }
      render();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  const go = (to: number) => {
    target = to;
    animate();
  };
  /** Turns the ring the short way round to card i. */
  function turnTo(i: number) {
    const base = Math.round(target);
    let d = wrap(i - wrap(base));
    if (d > n / 2) d -= n;
    go(base + d);
  }
  const announce = (i: number) => {
    if (live) live.textContent = `${cards[i].querySelector('.card__title')?.textContent ?? ''}, ${i + 1} of ${n}`;
  };

  /* ---------- drag, swipe, trackpad ---------- */
  let dragging = false;
  let dragged = false;
  let startX = 0;
  let startPos = 0;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  let pointer = -1;

  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    dragged = false;
    pointer = e.pointerId;
    startX = lastX = e.clientX;
    startPos = pos;
    lastT = e.timeStamp;
    velocity = 0;
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pointer) return;
    const dx = e.clientX - startX;
    if (!dragged && Math.abs(dx) < 7) return;
    if (!dragged) {
      dragged = true;
      viewport.setPointerCapture(e.pointerId);
      viewport.classList.add('is-dragging');
      startX = e.clientX;
      startPos = pos;
    }
    pos = startPos - (e.clientX - startX) / pxPerCard();
    const dt = Math.max(8, e.timeStamp - lastT);
    velocity = 0.75 * velocity + 0.25 * ((-(e.clientX - lastX) / pxPerCard()) * (1000 / dt));
    lastX = e.clientX;
    lastT = e.timeStamp;
    target = pos;
    animate();
  });
  const release = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pointer) return;
    dragging = false;
    viewport.classList.remove('is-dragging');
    if (dragged) {
      window.setTimeout(() => (dragged = false), 0);
      const fling = Math.max(-4, Math.min(4, velocity * 0.32));
      go(Math.round(pos + fling));
      window.setTimeout(() => announce(wrap(Math.round(target))), 500);
    }
  };
  viewport.addEventListener('pointerup', release);
  viewport.addEventListener('pointercancel', release);

  let wheelTimer = 0;
  viewport.addEventListener(
    'wheel',
    (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      pos += e.deltaX / pxPerCard() / 1.4;
      target = pos;
      animate();
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => go(Math.round(pos)), 140);
    },
    { passive: false },
  );

  /* ---------- cards, arrows, keys ---------- */
  cards.forEach((card, i) => {
    card.addEventListener('click', (e) => {
      if (dragged) {
        e.preventDefault();
        return;
      }
      const keyboard = (e as MouseEvent).detail === 0;
      if (keyboard || (i === current && Math.abs(target - pos) < 0.35)) open(i);
      else {
        turnTo(i);
        announce(i);
      }
    });
    card.addEventListener('focus', () => {
      if (i !== wrap(Math.round(target))) turnTo(i);
    });
  });
  const move = (by: number) => {
    const next = wrap(Math.round(target) + by);
    go(Math.round(target) + by);
    announce(next);
    if (root.contains(document.activeElement) && document.activeElement?.classList.contains('card')) cards[next].focus({ preventScroll: true });
  };
  root.querySelector('[data-work-prev]')?.addEventListener('click', () => move(-1));
  root.querySelector('[data-work-next]')?.addEventListener('click', () => move(1));
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      move(e.key === 'ArrowLeft' ? -1 : 1);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      turnTo(e.key === 'Home' ? 0 : n - 1);
      cards[e.key === 'Home' ? 0 : n - 1].focus({ preventScroll: true });
    }
  });

  /* ---------- the detail panel ---------- */
  let shown = 0;
  function fill(i: number) {
    shown = wrap(i);
    const id = cards[shown].dataset.work;
    const tpl = document.getElementById(`work-${id}`) as HTMLTemplateElement | null;
    if (!tpl) return;
    body.replaceChildren(tpl.content.cloneNode(true));
    body.scrollTop = 0;
    if (posLabel) posLabel.textContent = `${pad(shown + 1)} / ${pad(n)}`;
    history.replaceState(null, '', `#${id}`);
  }
  function open(i: number) {
    delete body.dataset.dir;
    fill(i);
    turnTo(shown);
    if (!dialog.open) dialog.showModal();
  }
  /** Next or previous piece of work, sliding in from the side it comes from. */
  const turnPanel = (by: 1 | -1) => {
    body.dataset.dir = by > 0 ? 'next' : 'prev';
    fill(shown + by);
    turnTo(shown);
  };
  dialog.querySelector('[data-detail-prev]')?.addEventListener('click', () => turnPanel(-1));
  dialog.querySelector('[data-detail-next]')?.addEventListener('click', () => turnPanel(1));
  // a sideways swipe on the panel moves to the next or previous one; scrolling up and down is untouched
  let touchX = 0;
  let touchY = 0;
  let touchAt = 0;
  body.addEventListener(
    'touchstart',
    (e) => {
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
      touchAt = e.timeStamp;
    },
    { passive: true },
  );
  body.addEventListener(
    'touchend',
    (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchX;
      const dy = t.clientY - touchY;
      if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.6 && e.timeStamp - touchAt < 900) turnPanel(dx < 0 ? 1 : -1);
    },
    { passive: true },
  );
  dialog.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('iframe, input, textarea')) return;
    if (e.key === 'ArrowRight') turnPanel(1);
    if (e.key === 'ArrowLeft') turnPanel(-1);
  });
  dialog.querySelector('[data-detail-close]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  let returnTo: HTMLElement | null = null;
  dialog.addEventListener('close', () => {
    body.replaceChildren(); // stops any player
    history.replaceState(null, '', location.pathname + location.search);
    (returnTo ?? cards[shown]).focus({ preventScroll: true });
    returnTo = null;
  });

  // players load only when asked for
  body.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-embed]');
    if (!btn) return;
    const card = btn.closest('.detail__card');
    const player = card?.querySelector<HTMLElement>('[data-player]');
    if (!player) return;
    const src = btn.dataset.embed!;
    if (!mayEmbed(src)) return;
    card!.querySelectorAll('[data-embed].is-on').forEach((b) => b.classList.remove('is-on'));
    btn.classList.add('is-on');
    if (player.dataset.src !== src) {
      const frame = document.createElement('iframe');
      frame.src = src;
      frame.height = btn.dataset.height || '152';
      frame.title = `${btn.dataset.name} player`;
      frame.allow = 'autoplay *; encrypted-media *; clipboard-write; fullscreen; picture-in-picture';
      if (src.includes('music.apple.com')) {
        frame.setAttribute('sandbox', 'allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation');
      }
      player.replaceChildren(frame);
      player.dataset.src = src;
    }
    player.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  // the credits and discography lists further down open the same panel
  document.addEventListener('click', (e) => {
    const opener = (e.target as HTMLElement).closest<HTMLElement>('[data-open-work]');
    if (!opener) return;
    const i = cards.findIndex((c) => c.dataset.work === opener.dataset.openWork);
    if (i < 0) return;
    pos = target = i;
    render();
    open(i);
    returnTo = opener;
  });

  /* ---------- start ---------- */
  measure();
  let resizeTimer = 0;
  addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(measure, 100);
  });

  // when the stage hands over, the ring swings in to the first card
  const arrive = () => {
    pos = -2.6;
    target = 0;
    render();
    animate();
    const id = decodeURIComponent(location.hash.slice(1));
    const linked = cards.findIndex((c) => c.dataset.work === id);
    if (linked >= 0) window.setTimeout(() => open(linked), 700);
  };
  if (document.querySelector('[data-stage]')?.getAttribute('data-phase') === 'ready') arrive();
  else {
    const onPhase = (e: Event) => {
      if ((e as CustomEvent).detail !== 'ready') return;
      document.removeEventListener('stage:phase', onPhase);
      arrive();
    };
    document.addEventListener('stage:phase', onPhase);
  }
}

export {};
