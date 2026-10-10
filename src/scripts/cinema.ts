/**
 * The cinema screen: plays his clips one after another (muted) in a single player, lights the
 * room and the audience with the colours of the film, and rests when it is out of view.
 * Until a clip plays, its still is on screen. When the phone wants a tap before any video
 * plays (iPhone in Low Power Mode, data saver), a play button shows, and any tap on the page
 * starts the clips. A tap earlier on the page already lets them start on their own.
 */
const root = document.querySelector<HTMLElement>('[data-cinema]');
if (root) setup(root);

/** The audience rows: [property, the row's own dark, how much of the film's colour it catches]. */
const ROWS: [string, number[], number][] = [
  ['--far', [21, 17, 28], 0.28],
  ['--far-low', [15, 12, 21], 0.14],
  ['--middle', [14, 11, 20], 0.14],
  ['--middle-low', [8, 7, 12], 0.06],
  ['--near', [4, 3, 7], 0.04],
];

function setup(root: HTMLElement) {
  const screen = root.querySelector<HTMLElement>('[data-cinema-screen]')!;
  const slides = [...root.querySelectorAll<HTMLElement>('[data-cinema-slide]')];
  const video = root.querySelector<HTMLVideoElement>('[data-cinema-video]')!;
  const playButton = root.querySelector<HTMLButtonElement>('[data-cinema-play]')!;
  if (!slides.length) return;
  let index = 0;
  let timer = 0;
  let visible = false;
  let blocked = false;
  let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
      const lit = colour.map((v) => v * k);
      root.style.setProperty('--tint', lit.map(Math.round).join(' '));
      // each row of the audience: that colour mixed into its own dark, the far row most
      for (const [name, base, share] of ROWS) {
        root.style.setProperty(name, base.map((b, c) => Math.round(b + (lit[c] - b) * share)).join(' '));
      }
    } catch {
      /* keep the last colours */
    }
  };
  window.setInterval(() => {
    if (visible && !video.paused && video.readyState >= 2) tint(video);
  }, 700);

  const stillOf = (i: number) => slides[i].querySelector<HTMLImageElement>('.cinema__still');
  // stills load when their clip is next
  const ready = (i: number) => {
    const img = stillOf(i);
    if (img && !img.getAttribute('src') && img.dataset.src) img.src = img.dataset.src;
  };
  const tintFromStill = (i: number) => {
    const img = stillOf(i);
    if (!img) return;
    if (img.complete && img.naturalWidth) tint(img);
    else img.addEventListener('load', () => i === index && tint(img), { once: true });
  };

  function show(next: number) {
    window.clearTimeout(timer);
    slides[index].classList.remove('is-on');
    index = (next + slides.length) % slides.length;
    slides[index].classList.add('is-on');
    ready(index);
    ready((index + 1) % slides.length);
    video.classList.remove('is-playing');
    tintFromStill(index);
    play();
  }

  function play() {
    window.clearTimeout(timer);
    const src = slides[index].dataset.video!;
    if (video.getAttribute('src') !== src) video.src = src;
    if (!visible) return;
    if (reduced) {
      playButton.hidden = false;
      return;
    }
    video.muted = true;
    // one clip only: it loops; otherwise the next one starts when it ends
    video.loop = slides.length === 1;
    // a clip that stalls does not hold the screen for ever
    if (slides.length > 1) timer = window.setTimeout(() => show(index + 1), 30000);
    video.play().then(
      () => {
        blocked = false;
        playButton.hidden = true;
      },
      (err: DOMException) => {
        window.clearTimeout(timer);
        if (err.name === 'NotAllowedError') {
          // the phone wants a tap: the still stays, with a play button
          blocked = true;
          playButton.hidden = false;
        } else if (err.name !== 'AbortError' && slides.length > 1 && visible) {
          timer = window.setTimeout(() => show(index + 1), 2500);
        }
      },
    );
  }

  // play() has to be called during the tap itself
  let startedAt = 0;
  const start = () => {
    startedAt = performance.now();
    blocked = false;
    reduced = false;
    playButton.hidden = true;
    play();
  };
  playButton.addEventListener('click', (e) => {
    e.stopPropagation();
    start();
  });
  // a phone that wants a tap lets a player go on by itself once it has started during one, so the
  // first tap anywhere on the page starts it and stops it again at once while it is out of view
  let primed = false;
  const unlock = () => {
    if (visible) {
      if (blocked) start();
      return;
    }
    if (primed) return;
    primed = true;
    video.play().catch((err: DOMException) => {
      if (err.name === 'NotAllowedError') primed = false;
    });
    video.pause();
  };
  for (const type of ['pointerup', 'touchend', 'click', 'keydown']) addEventListener(type, unlock, { capture: true, passive: true });

  video.addEventListener('playing', () => video.classList.add('is-playing'));
  video.addEventListener('ended', () => {
    if (slides.length > 1) show(index + 1);
  });
  if (slides.length > 1) {
    // a tap on the screen moves on, unless that tap has just started the clips
    screen.addEventListener('click', () => performance.now() - startedAt > 500 && show(index + 1));
    root.querySelector('[data-cinema-next]')?.addEventListener('click', () => show(index + 1));
  }
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) play();
      else {
        window.clearTimeout(timer);
        video.pause();
      }
    },
    { threshold: 0.25 },
  ).observe(root);
  ready(1 % slides.length);
  tintFromStill(0);
}

export {};
