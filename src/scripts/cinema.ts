/**
 * The cinema screen: plays his clips one after another (muted), lights the room and the
 * audience with the colours of the film, and rests when it is out of view.
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
  const videoOf = (i: number) => slides[i].querySelector('video')!;
  let index = 0;
  let timer = 0;
  let visible = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // the picture lights the room (its average colour) and the audience (its most vivid colour),
  // read a few times a second from an 8 x 5 thumbnail of the frame
  const tiny = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  tiny.canvas.width = 8;
  tiny.canvas.height = 5;
  const tint = (source: CanvasImageSource) => {
    try {
      tiny.drawImage(source, 0, 0, 8, 5);
      const data = tiny.getImageData(0, 0, 8, 5).data;
      const px: number[][] = [];
      for (let i = 0; i < data.length; i += 4) px.push([data[i], data[i + 1], data[i + 2]]);
      const mean = (list: number[][]) => [0, 1, 2].map((c) => list.reduce((sum, p) => sum + p[c], 0) / list.length);
      // the room: the average, lifted so dark scenes still glow
      const lift = (v: number) => Math.round(90 + (v / 255) * 165);
      root.style.setProperty('--glow', mean(px).map(lift).join(' '));
      // the audience: the most colourful quarter of the picture, brightened to full strength
      const vivid = (p: number[]) => (Math.max(...p) - Math.min(...p)) * Math.max(...p);
      const colour = mean([...px].sort((a, b) => vivid(b) - vivid(a)).slice(0, 10));
      const k = 230 / Math.max(1, ...colour);
      root.style.setProperty('--tint', colour.map((v) => Math.round(v * k)).join(' '));
    } catch {
      /* keep the last colours */
    }
  };
  window.setInterval(() => {
    const v = videoOf(index);
    if (visible && !v.paused && v.readyState >= 2) tint(v);
  }, 700);
  const tintFromStill = (i: number) => {
    const still = videoOf(i).dataset.poster;
    if (!still) return;
    const img = new Image();
    img.onload = () => i === index && tint(img);
    img.src = still;
  };

  const ready = (i: number) => {
    const v = videoOf(i);
    if (v.dataset.poster && !v.poster) v.poster = v.dataset.poster;
  };

  function show(next: number) {
    const old = videoOf(index);
    old.pause();
    slides[index].classList.remove('is-on');
    index = (next + slides.length) % slides.length;
    slides[index].classList.add('is-on');
    const slide = slides[index];
    if (title) title.textContent = slide.dataset.title || 'Music by Shez Manzoor';
    if (kind) kind.textContent = slide.dataset.kind || 'Film and television';
    if (details) {
      details.hidden = !slide.dataset.id;
      if (slide.dataset.id) details.dataset.openWork = slide.dataset.id;
    }
    ready(index);
    ready((index + 1) % slides.length);
    // the old clip starts from the beginning next time round
    window.setTimeout(() => (old.currentTime = 0), 1200);
    tintFromStill(index);
    play();
  }

  function play() {
    window.clearTimeout(timer);
    if (!visible || reduced) return;
    const v = videoOf(index);
    if (!v.src) v.src = v.dataset.src!;
    v.muted = true;
    // one clip only: it loops; otherwise the next one starts when it ends
    v.loop = slides.length === 1;
    // a clip that stalls does not hold the screen for ever
    if (slides.length > 1) timer = window.setTimeout(() => show(index + 1), 30000);
    v.play().catch(() => {
      // cannot play here (format, data saver): show the next one after a moment
      window.clearTimeout(timer);
      if (slides.length > 1 && visible) timer = window.setTimeout(() => show(index + 1), 2500);
    });
  }

  slides.forEach((s, i) =>
    s.querySelector('video')!.addEventListener('ended', () => {
      if (i === index && slides.length > 1) show(index + 1);
    }),
  );
  if (slides.length > 1) {
    screen.addEventListener('click', () => show(index + 1));
    root.querySelector('[data-cinema-next]')?.addEventListener('click', () => show(index + 1));
  }
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) play();
      else {
        window.clearTimeout(timer);
        videoOf(index).pause();
      }
    },
    { threshold: 0.25 },
  ).observe(root);
  ready(1 % slides.length);
  tintFromStill(0);
}

export {};
