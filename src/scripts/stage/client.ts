/**
 * Starts the hero scene. Prefers a worker with OffscreenCanvas so WebGL never blocks
 * the page; falls back to the main thread where workers cannot draw WebGL.
 */
import type { Mode, Msg, Scene, SceneEvents, SceneInit } from './scene';

export interface StageOptions {
  canvas: HTMLCanvasElement;
  /** Receives pointer input (the whole hero, so the text does not block strumming). */
  surface: HTMLElement;
  force: boolean;
  onReady(): void;
  onPluck(string: number, strength: number): void;
  onLost(): void;
  /** WebGL is unavailable or unsuitable: keep the static hero. */
  onStatic(): void;
}

export interface StageControl {
  setMode(mode: Mode): void;
  strum(direction?: 1 | -1, strength?: number): void;
}

type Reply =
  | { type: 'ready' }
  | { type: 'pluck'; i: number; s: number }
  | { type: 'lost' }
  | { type: 'failed'; reason: 'no-webgl' | 'software' | 'shader' };

export function startStage(opts: StageOptions): StageControl {
  const { surface } = opts;
  let canvas = opts.canvas;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const dpr = () => Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);

  const queue: Msg[] = [];
  let deliver: ((m: Msg) => void) | null = null;
  const send = (m: Msg) => (deliver ? deliver(m) : queue.push(m));
  const connect = (fn: (m: Msg) => void) => {
    deliver = fn;
    queue.splice(0).forEach(fn);
  };

  const events: SceneEvents = {
    ready: () => opts.onReady(),
    pluck: (i, s) => opts.onPluck(i, s),
    lost: () => opts.onLost(),
  };

  const initFor = (c: HTMLCanvasElement): SceneInit => {
    const r = c.getBoundingClientRect();
    return { cssWidth: r.width, cssHeight: r.height, dpr: dpr(), coarse, force: opts.force };
  };

  async function onMainThread() {
    const { createScene, dispatch } = await import('./scene');
    const result = await createScene(canvas, initFor(canvas), events);
    if (!('scene' in result)) return opts.onStatic();
    const scene: Scene = result.scene;
    connect((m) => dispatch(scene, m));
  }

  function freshCanvas() {
    const next = canvas.cloneNode(false) as HTMLCanvasElement;
    canvas.replaceWith(next);
    resizeObserver.unobserve(canvas);
    visibility.unobserve(canvas);
    canvas = next;
    resizeObserver.observe(canvas);
    visibility.observe(canvas);
  }

  function inWorker() {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    } catch {
      return void onMainThread();
    }
    const offscreen = canvas.transferControlToOffscreen();
    worker.postMessage({ type: 'init', canvas: offscreen, init: initFor(canvas) }, [offscreen]);
    connect((m) => worker.postMessage(m));
    worker.onmessage = (e: MessageEvent<Reply>) => {
      const m = e.data;
      if (m.type === 'ready') events.ready();
      else if (m.type === 'pluck') events.pluck(m.i, m.s);
      else if (m.type === 'lost') events.lost();
      else if (m.type === 'failed') {
        worker.terminate();
        if (m.reason === 'no-webgl') {
          // Some browsers have OffscreenCanvas but no WebGL in workers: draw on the main thread instead.
          deliver = null;
          freshCanvas();
          void onMainThread();
        } else {
          opts.onStatic();
        }
      }
    };
    worker.onerror = () => {
      worker.terminate();
      deliver = null;
      freshCanvas();
      void onMainThread();
    };
  }

  /* ---------- page signals the scene needs ---------- */
  const resizeObserver = new ResizeObserver(() => {
    const r = canvas.getBoundingClientRect();
    send({ type: 'resize', w: r.width, h: r.height, dpr: dpr() });
  });
  let onScreen = true;
  const visibility = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    send({ type: 'visible', v: onScreen && !document.hidden });
  });
  resizeObserver.observe(canvas);
  visibility.observe(canvas);
  document.addEventListener('visibilitychange', () => send({ type: 'visible', v: onScreen && !document.hidden }));

  const pointer = (kind: 'move' | 'down' | 'leave') => (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    send({ type: 'pointer', kind, x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp });
  };
  surface.addEventListener('pointermove', pointer('move'), { passive: true });
  surface.addEventListener('pointerdown', pointer('down'), { passive: true });
  surface.addEventListener('pointerleave', pointer('leave'), { passive: true });
  surface.addEventListener('pointercancel', pointer('leave'), { passive: true });

  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        send({ type: 'scroll', p: Math.min(1, Math.max(0, window.scrollY / (surface.offsetHeight || 1))) });
      });
    },
    { passive: true },
  );

  if ('transferControlToOffscreen' in canvas && typeof Worker === 'function') inWorker();
  else void onMainThread();

  return {
    setMode: (mode) => send({ type: 'mode', mode }),
    strum: (dir = 1, s = 0.2) => send({ type: 'strum', dir, s }),
  };
}
