/**
 * Site-wide behaviour, kept small: header, menu, reveals, section lighting,
 * card tilt, record sleeves, click-to-load embeds, copy buttons and the cursor light.
 */
import { mayEmbed } from './consent';

const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---------- header: solid after scrolling, hides while reading down ---------- */
{
  let lastY = window.scrollY;
  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    root.classList.toggle('is-scrolled', y > 12);
    const menuOpen = root.classList.contains('menu-open');
    if (!menuOpen) root.classList.toggle('is-header-hidden', y > 240 && y > lastY + 4);
    if (y < lastY - 4 || y < 240) root.classList.remove('is-header-hidden');
    lastY = y;
    ticking = false;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

/* ---------- menu ---------- */
{
  const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  if (toggle && menu) {
    const focusables = () =>
      Array.from(menu.querySelectorAll<HTMLElement>('a, button')).concat(toggle);
    const open = () => {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
      toggle.setAttribute('aria-expanded', 'true');
      toggle.querySelector('.menu-btn__label')!.textContent = 'Close';
      root.classList.add('menu-open');
      root.classList.remove('is-header-hidden');
      document.body.style.overflow = 'hidden';
      menu.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
    };
    const close = (restoreFocus = true) => {
      menu.classList.remove('is-open');
      menu.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.querySelector('.menu-btn__label')!.textContent = 'Menu';
      root.classList.remove('menu-open');
      document.body.style.overflow = '';
      if (restoreFocus) toggle.focus({ preventScroll: true });
    };
    toggle.addEventListener('click', () => (menu.hidden ? open() : close()));
    menu.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('a')) close(false);
    });
    document.addEventListener('keydown', (e) => {
      if (menu.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const items = focusables();
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
    matchMedia('(min-width: 960px)').addEventListener('change', (e) => {
      if (e.matches && !menu.hidden) close(false);
    });
  }
}

/* ---------- reveal on scroll ---------- */
{
  const items = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    items.forEach((el) => io.observe(el));
  }
}

/* ---------- the page light follows the section in view ---------- */
{
  const sections = document.querySelectorAll<HTMLElement>('[data-section-light]');
  const fallback = root.dataset.pageLight || 'mixed';
  if (sections.length) {
    const visible = new Map<Element, string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const light = (entry.target as HTMLElement).dataset.sectionLight || fallback;
          if (entry.isIntersecting) visible.set(entry.target, light);
          else visible.delete(entry.target);
        }
        const current = Array.from(visible.values()).pop() ?? fallback;
        root.dataset.light = current;
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    sections.forEach((s) => io.observe(s));
  }
}

/* ---------- 3D tilt on cards (mouse only) ---------- */
if (finePointer && !reduceMotion) {
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((card) => {
    let frame = 0;
    card.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--rx', `${(-y * 7).toFixed(2)}deg`);
        card.style.setProperty('--ry', `${(x * 9).toFixed(2)}deg`);
        card.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`);
      });
    });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
}

/* ---------- record sleeves flip to show their back ---------- */
document.querySelectorAll<HTMLElement>('[data-sleeve]').forEach((sleeve) => {
  const button = sleeve.querySelector<HTMLButtonElement>('[data-sleeve-flip]');
  const back = sleeve.querySelector<HTMLElement>('[data-sleeve-back]');
  const front = sleeve.querySelector<HTMLElement>('[data-sleeve-front]');
  if (!button || !back || !front) return;
  const close = sleeve.querySelector<HTMLButtonElement>('[data-sleeve-close]');
  back.inert = true;
  // Only the face that is showing can be tapped or focused.
  const set = (flipped: boolean) => {
    sleeve.classList.toggle('is-flipped', flipped);
    button.setAttribute('aria-expanded', String(flipped));
    back.inert = !flipped;
    front.inert = flipped;
  };
  button.addEventListener('click', () => {
    set(true);
    close?.focus({ preventScroll: true });
  });
  close?.addEventListener('click', () => {
    set(false);
    button.focus({ preventScroll: true });
  });
});

/* ---------- sleeves: the record slides out once when seen on touch screens ---------- */
if (!finePointer && !reduceMotion && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-peeking');
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.6 },
  );
  document.querySelectorAll('[data-sleeve]').forEach((el) => io.observe(el));
}

/* ---------- embeds load only when asked (speed and privacy) ---------- */
document.querySelectorAll<HTMLElement>('[data-embed]').forEach((box) => {
  const button = box.querySelector<HTMLButtonElement>('[data-embed-load]');
  button?.addEventListener('click', () => {
    if (!mayEmbed(box.dataset.embed!)) return;
    const iframe = document.createElement('iframe');
    iframe.src = box.dataset.embed!;
    iframe.title = box.dataset.embedTitle || 'Embedded player';
    iframe.loading = 'lazy';
    iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    iframe.style.height = `${box.dataset.embedHeight || 352}px`;
    box.classList.add('is-loaded');
    box.replaceChildren(iframe);
  });
});

/* ---------- copy buttons (press kit) ---------- */
document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const target = document.getElementById(button.dataset.copy!);
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target.innerText.trim());
      button.classList.add('is-done');
      const label = button.querySelector('[data-copy-label]');
      const before = label?.textContent;
      if (label) label.textContent = 'Copied';
      window.setTimeout(() => {
        button.classList.remove('is-done');
        if (label && before) label.textContent = before;
      }, 1800);
    } catch {
      window.getSelection()?.selectAllChildren(target);
    }
  });
});

/* ---------- a soft stage light follows the mouse ---------- */
if (finePointer && !reduceMotion) {
  const light = document.createElement('div');
  light.className = 'cursor-light';
  light.setAttribute('aria-hidden', 'true');
  document.body.append(light);
  let x = -999, y = -999, frame = 0;
  window.addEventListener(
    'pointermove',
    (e) => {
      x = e.clientX;
      y = e.clientY;
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          light.style.transform = `translate3d(${x}px, ${y}px, 0)`;
          light.classList.add('is-on');
        });
      }
    },
    { passive: true },
  );
  document.addEventListener('pointerleave', () => light.classList.remove('is-on'));
}
