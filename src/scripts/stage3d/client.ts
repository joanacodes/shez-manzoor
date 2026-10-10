/**
 * Runs the first screen: decides whether this device gets the 3D stage or the still,
 * plays the intro (name → lights → the name dims → the carousel arrives), and wires the
 * stage to scrolling, the pointer and taps on the TV, the guitar and the mic.
 */
import type { Stage, Pickable } from './scene';

type Phase = 'loading' | 'intro' | 'ready';
type Data = { channels: { title: string; kind: string; image?: string; video?: string }[]; setlist: string[] };

const stageEl = document.querySelector<HTMLElement>('[data-stage]');
if (stageEl) void init(stageEl);

/** The scene needs a real GPU: software renderers (no graphics card, some VMs, test bots) get the still. */
function gpuName() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || 'unknown');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return null;
  }
}

async function loadFonts() {
  const cs = getComputedStyle(document.documentElement);
  const serif = cs.getPropertyValue('--font-serif').trim() || 'Georgia, serif';
  const mono = cs.getPropertyValue('--font-mono').trim() || 'monospace';
  const first = (v: string) => v.split(',')[0].trim();
  await Promise.race([
    Promise.allSettled([document.fonts.load(`italic 46px ${first(serif)}`), document.fonts.load(`400 30px ${first(mono)}`)]),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  return { serif, mono };
}

async function init(el: HTMLElement) {
  const html = document.documentElement;
  const canvas = el.querySelector<HTMLCanvasElement>('[data-stage-canvas]')!;
  const data = JSON.parse(el.querySelector('[data-stage-data]')?.textContent || '{}') as Data;
  const params = new URLSearchParams(location.search);
  const force = params.has('stage');
  const still = params.has('still');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

  // the page's watchdog may already have shown everything (very slow connections)
  let phase: Phase = el.dataset.phase === 'ready' ? 'ready' : 'loading';
  let stage: Stage | null = null;
  let skipped = params.has('skip') || phase === 'ready';
  let gaveUp = false;
  let readyTimer = 0;

  const setPhase = (p: Phase) => {
    if (p === phase) return;
    phase = p;
    el.dataset.phase = p;
    if (p === 'ready') {
      html.dataset.intro = 'off';
      window.clearTimeout(readyTimer);
    }
    document.dispatchEvent(new CustomEvent('stage:phase', { detail: p }));
  };
  html.dataset.intro = 'on';
  el.dataset.client = 'on';
  if (still) html.classList.add('still');

  /* ---------- the still, for devices without the 3D stage ---------- */
  const fallback = () => {
    html.classList.remove('has-3d');
    html.classList.add('no-3d');
    if (phase === 'loading') {
      setPhase('intro');
      readyTimer = window.setTimeout(() => setPhase('ready'), skipped ? 0 : 3300);
    }
  };

  /* ---------- skipping the intro ---------- */
  const skip = () => {
    if (phase === 'ready') return;
    skipped = true;
    if (stage) stage.skip();
    else {
      html.classList.add('no-3d');
      setPhase('intro');
    }
    setPhase('ready');
  };
  el.querySelector('[data-stage-skip]')?.addEventListener('click', skip);
  const skipOnce = (e: Event) => {
    if (phase === 'ready') return;
    if (e.type === 'keydown') {
      const k = (e as KeyboardEvent).key;
      if (!['Escape', 'Enter', ' ', 'ArrowDown', 'PageDown', 'Tab'].includes(k)) return;
    }
    skip();
  };
  addEventListener('keydown', skipOnce);
  addEventListener('wheel', skipOnce, { passive: true });
  addEventListener('touchmove', skipOnce, { passive: true });
  el.addEventListener('focusin', (e) => {
    if ((e.target as HTMLElement).closest('[data-work]')) skip();
  });

  // the fixed scene is hidden once the stage has scrolled out of view
  new IntersectionObserver(([entry]) => el.classList.toggle('is-away', !entry.isIntersecting)).observe(el);

  /* ---------- scrolling: the stage dims and the camera looks up into the light ---------- */
  const onScroll = () => {
    const v = Math.min(1, Math.max(0, scrollY / (innerHeight * 0.9)));
    el.style.setProperty('--veil', (v * 0.8).toFixed(3));
    stage?.setScroll(v);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const gpu = gpuName();
  const software = !gpu || /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu);
  if (!force && (software || reduced || saveData)) {
    fallback();
    return;
  }

  // if the stage takes too long (slow connection or device), show the still and carry on
  const patience = window.setTimeout(() => {
    if (!stage) {
      gaveUp = true;
      fallback();
    }
  }, force ? 60000 : 8000);

  try {
    const [fonts, mod] = await Promise.all([loadFonts(), import('./scene')]);
    const coarse = matchMedia('(pointer: coarse)').matches;
    const small = Math.min(screen.width, screen.height) < 700;
    const cores = navigator.hardwareConcurrency || 4;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    stage = await mod.createStage({
      canvas,
      fonts,
      channels: data.channels ?? [],
      setlist: data.setlist ?? [],
      tier: params.get('tier') === 'high' ? 'high' : params.get('tier') === 'low' || coarse || small || cores < 6 || memory < 6 ? 'low' : 'high',
      onEvent: (e) => {
        if (e === 'settled') setPhase('ready');
      },
    });
  } catch (err) {
    console.warn('Stage unavailable, showing the still instead', err);
    window.clearTimeout(patience);
    fallback();
    return;
  }
  window.clearTimeout(patience);
  if (gaveUp) {
    // this device took too long: it keeps the still for this visit rather than swapping mid-intro
    stage.dispose();
    stage = null;
    return;
  }
  if (force) (window as unknown as { __stage: Stage }).__stage = stage;
  html.classList.add('has-3d');
  // if the still was showing (the intro was skipped early), the canvas fades in over it first
  window.setTimeout(() => html.classList.remove('no-3d'), html.classList.contains('no-3d') ? 700 : 0);
  onScroll();
  stage.start(skipped || still);
  if (phase === 'loading') setPhase('intro');

  canvas.addEventListener('webglcontextlost', () => {
    stage?.pause();
    stage = null;
    fallback();
  });

  /* ---------- only draw while the stage can be seen ---------- */
  let inView = true;
  const sync = () => {
    if (!stage) return;
    if (inView && document.visibilityState === 'visible') stage.resume();
    else stage.pause();
  };
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    sync();
  }).observe(el);
  document.addEventListener('visibilitychange', sync);
  let resizeTimer = 0;
  addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => stage?.resize(), 120);
  });

  /* ---------- pointer: the camera leans, things on stage answer taps ---------- */
  const label = el.querySelector<HTMLElement>('[data-stage-label]');
  const labels: Record<Pickable, string> = { tv: 'Change channel', guitar: 'Strum it', mic: 'Change the light' };
  const blocked = (t: EventTarget | null) => (t as HTMLElement | null)?.closest?.('a, button, dialog, [data-work-viewport], .site-header');
  let hoverAt = 0;
  addEventListener('pointermove', (e: PointerEvent) => {
    if (!stage || e.pointerType !== 'mouse') return;
    stage.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    const now = performance.now();
    if (now - hoverAt < 90 || scrollY > innerHeight * 0.6) return;
    hoverAt = now;
    const hit = blocked(e.target) || phase !== 'ready' ? null : stage.pick(e.clientX, e.clientY);
    el.style.cursor = hit ? 'pointer' : '';
    if (label) {
      label.classList.toggle('is-on', Boolean(hit));
      if (hit) {
        label.textContent = labels[hit];
        label.style.setProperty('--x', `${e.clientX}px`);
        label.style.setProperty('--y', `${e.clientY}px`);
      }
    }
  });

  let sound: import('../stage/sound').Sound | null = null;
  const strum = async () => {
    if (!sound) {
      const { createSound } = await import('../stage/sound');
      sound = createSound();
      sound?.setEnabled(true);
    }
    if (!sound) return;
    for (let i = 0; i < 6; i++) window.setTimeout(() => sound?.play(i, 0.85 - i * 0.05, 'artist'), i * 28);
  };

  el.addEventListener('click', (e) => {
    if (!stage || phase !== 'ready' || blocked(e.target)) return;
    const hit = stage.pick(e.clientX, e.clientY);
    if (hit === 'tv') stage.zap();
    if (hit === 'guitar') {
      stage.ringStrings();
      void strum();
    }
    if (hit === 'mic') stage.cycleLight();
  });

  // one quiet hint, once the stage is set
  const tip = el.querySelector<HTMLElement>('[data-stage-tip]');
  const showTip = () => {
    if (!tip || !stage) return;
    const text = tip.querySelector('[data-stage-tip-text]');
    if (text) text.textContent = `${matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click'} the TV, the guitar or the mic`;
    tip.hidden = false;
  };
  if ((phase as Phase) === 'ready') showTip();
  else {
    const onPhase = (e: Event) => {
      if ((e as CustomEvent).detail !== 'ready') return;
      document.removeEventListener('stage:phase', onPhase);
      showTip();
    };
    document.addEventListener('stage:phase', onPhase);
  }
}
