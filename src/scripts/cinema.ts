/**
 * The cinema screen: shows his film and TV work one after another (clips play muted),
 * tints the room and the audience with the colour on screen, and rests when out of view.
 */
const root = document.querySelector<HTMLElement>('[data-cinema]');
if (root) setup(root);

function setup(root: HTMLElement) {
  const screen = root.querySelector<HTMLElement>('[data-cinema-screen]')!;
  const slides = [...root.querySelectorAll<HTMLElement>('[data-cinema-slide]')];
  const title = root.querySelector('[data-cinema-title]');
  const kind = root.querySelector('[data-cinema-kind]');
  const details = root.querySelector<HTMLElement>('[data-cinema-details]');
  if (!slides.length) return;
  let index = 0;
  let timer = 0;
  let visible = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // the average colour of each poster lights the room
  const tint = (slide: HTMLElement) => {
    const img = slide.querySelector<HTMLImageElement>('.cinema__poster');
    const apply = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 1;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img!, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        // lift dark posters so the glow still reads
        const lift = (v: number) => Math.round(90 + (v / 255) * 165);
        root.style.setProperty('--glow', `${lift(r)} ${lift(g)} ${lift(b)}`);
      } catch {
        /* keep the last colour */
      }
    };
    if (!img) root.style.setProperty('--glow', '240 170 140');
    else if (img.complete && img.naturalWidth) apply();
    else img.addEventListener('load', apply, { once: true });
  };

  function show(next: number) {
    const old = slides[index];
    old.classList.remove('is-on');
    const oldVideo = old.querySelector<HTMLVideoElement>('video');
    oldVideo?.pause();
    oldVideo?.classList.remove('is-playing');
    index = (next + slides.length) % slides.length;
    const slide = slides[index];
    slide.classList.add('is-on');
    if (title) title.textContent = slide.dataset.title ?? '';
    if (kind) kind.textContent = slide.dataset.kind ?? '';
    if (details) details.dataset.openWork = slide.dataset.id;
    tint(slide);
    // eager-load the poster of the one after
    slides[(index + 1) % slides.length].querySelector('img')?.setAttribute('loading', 'eager');
    play(slide);
  }

  function play(slide: HTMLElement) {
    window.clearTimeout(timer);
    if (!visible) return;
    const video = slide.querySelector<HTMLVideoElement>('video');
    if (video && !reduced) {
      if (!video.src) video.src = video.dataset.src!;
      video.muted = true;
      video.play().then(
        () => video.classList.add('is-playing'),
        () => undefined,
      );
      timer = window.setTimeout(() => show(index + 1), 16000);
    } else {
      timer = window.setTimeout(() => show(index + 1), 6500);
    }
  }

  screen.addEventListener('click', () => show(index + 1));
  root.querySelector('[data-cinema-next]')?.addEventListener('click', () => show(index + 1));
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) play(slides[index]);
      else {
        window.clearTimeout(timer);
        slides[index].querySelector('video')?.pause();
      }
    },
    { threshold: 0.25 },
  ).observe(root);
  tint(slides[0]);
}

export {};
