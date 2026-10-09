/**
 * The hero scene: six strings of light under two stage lights, purple and green.
 * Plain WebGL, three passes. It never touches the DOM, so it can run in a worker
 * (OffscreenCanvas) or on the main thread; the host feeds it size, pointer, scroll and visibility.
 */
import { bgFrag, bgVert, dustFrag, dustVert, stringFrag, stringVert } from './shaders';

export type Mode = 'mixed' | 'composer' | 'artist';

export interface SceneInit {
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  coarse: boolean;
  /** Run even on software renderers (testing only). */
  force: boolean;
}

export interface SceneEvents {
  ready(): void;
  pluck(string: number, strength: number): void;
  lost(): void;
}

export interface Scene {
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
  pointer(kind: 'move' | 'down' | 'leave', x: number, y: number, t: number): void;
  setMode(mode: Mode): void;
  setScroll(progress: number): void;
  setVisible(visible: boolean): void;
  strum(direction?: 1 | -1, strength?: number): void;
}

/** Messages from the page to the scene. */
export type Msg =
  | { type: 'resize'; w: number; h: number; dpr: number }
  | { type: 'pointer'; kind: 'move' | 'down' | 'leave'; x: number; y: number; t: number }
  | { type: 'mode'; mode: Mode }
  | { type: 'scroll'; p: number }
  | { type: 'visible'; v: boolean }
  | { type: 'strum'; dir: 1 | -1; s: number };

export type SceneResult = { scene: Scene } | { reason: 'no-webgl' | 'software' | 'shader' };

export function dispatch(scene: Scene, m: Msg) {
  switch (m.type) {
    case 'resize': return scene.resize(m.w, m.h, m.dpr);
    case 'pointer': return scene.pointer(m.kind, m.x, m.y, m.t);
    case 'mode': return scene.setMode(m.mode);
    case 'scroll': return scene.setScroll(m.p);
    case 'visible': return scene.setVisible(m.v);
    case 'strum': return scene.strum(m.dir, m.s);
  }
}

type Vec3 = [number, number, number];
type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

const STRINGS = 6;
const SEGMENTS = 96;
const FOV = (38 * Math.PI) / 180;
const CAM_Z = 9;
const Z_FAR = -5;
const Z_NEAR = 2;

const LAVENDER: Vec3 = [0.8, 0.73, 1.0];
const VIOLET: Vec3 = [0.48, 0.3, 1.0];
const MINT: Vec3 = [0.49, 0.94, 0.75];
const EMERALD: Vec3 = [0.12, 0.61, 0.45];

const raf: (cb: (t: number) => void) => number =
  typeof requestAnimationFrame === 'function'
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
const caf: (id: number) => void =
  typeof cancelAnimationFrame === 'function' ? (id) => cancelAnimationFrame(id) : (id) => clearTimeout(id);

/* ---------- tiny matrix helpers (column-major) ---------- */
function perspective(out: Float32Array, fovy: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

function lookAt(out: Float32Array, eye: Vec3, target: Vec3) {
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;
  let xx = zz, xy = 0, xz = -zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len; xy /= len; xz /= len;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}

function multiply(out: Float32Array, a: Float32Array, b: Float32Array) {
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[j * 4 + i] =
        a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3];
    }
  }
  return out;
}

function project(m: Float32Array, p: Vec3) {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
  const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return { x: x / w, y: y / w, w };
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ---------- GL helpers ---------- */
function program(gl: WebGLRenderingContext, vs: string, fs: string) {
  const p = gl.createProgram()!;
  const v = gl.createShader(gl.VERTEX_SHADER)!;
  const f = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(v, vs);
  gl.shaderSource(f, fs);
  gl.compileShader(v);
  gl.compileShader(f);
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  const u = (name: string) => {
    if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(p, name));
    return uniforms.get(name)!;
  };
  const ok = () => gl.getProgramParameter(p, gl.LINK_STATUS) === true;
  return { p, u, a: (name: string) => gl.getAttribLocation(p, name), ok };
}

/** Waits for shaders to compile without blocking, where the browser supports it. */
function compiled(gl: WebGLRenderingContext, programs: WebGLProgram[]) {
  const ext = gl.getExtension('KHR_parallel_shader_compile') as { COMPLETION_STATUS_KHR: number } | null;
  if (!ext) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const poll = () => {
      if (programs.every((p) => gl.getProgramParameter(p, ext.COMPLETION_STATUS_KHR))) resolve();
      else raf(poll);
    };
    poll();
  });
}

/** Software rendering (no usable GPU) makes the scene janky, so the static hero is better there. */
function isSoftware(gl: WebGLRenderingContext) {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
}

/* ---------- layout: where the strings sit on screen (matches the CSS fallback) ---------- */
function layoutFor(aspect: number) {
  if (aspect >= 1.15) {
    return { cx: 0.7, top: 0.1, bottom: 1.04, spreadTop: 0.1, spreadBottom: 0.42, fade: [0.12, 0.8] as const };
  }
  return { cx: 0.5, top: 0.12, bottom: 0.68, spreadTop: 0.22, spreadBottom: 0.92, fade: [0.12, 0.62] as const };
}

export async function createScene(canvas: AnyCanvas, init: SceneInit, events: SceneEvents): Promise<SceneResult> {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
  }) as WebGLRenderingContext | null;
  if (!gl) return { reason: 'no-webgl' };
  if (!init.force && isSoftware(gl)) return { reason: 'software' };

  const bg = program(gl, bgVert, bgFrag);
  const str = program(gl, stringVert, stringFrag);
  const dust = program(gl, dustVert, dustFrag);
  await compiled(gl, [bg.p, str.p, dust.p]);
  if (!bg.ok() || !str.ok() || !dust.ok()) return { reason: 'shader' };

  const coarse = init.coarse;

  /* ---------- buffers ---------- */
  const tri = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tri);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const ribbon = new Float32Array((SEGMENTS + 1) * 4);
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    ribbon.set([t, -1, t, 1], i * 4);
  }
  const ribbonBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, ribbonBuf);
  gl.bufferData(gl.ARRAY_BUFFER, ribbon, gl.STATIC_DRAW);

  const DUST = coarse ? 170 : 420;
  const dustData = new Float32Array(DUST * 4);
  for (let i = 0; i < DUST; i++) {
    dustData.set([(Math.random() * 2 - 1) * 7.5, Math.random() * 10 - 5, Math.random() * 9 - 6, Math.random()], i * 4);
  }
  const dustBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, dustBuf);
  gl.bufferData(gl.ARRAY_BUFFER, dustData, gl.STATIC_DRAW);

  /* ---------- state ---------- */
  const proj = new Float32Array(16);
  const view = new Float32Array(16);
  const pv = new Float32Array(16);
  let cssW = Math.max(init.cssWidth, 1), cssH = Math.max(init.cssHeight, 1);
  let dpr = init.dpr;
  let width = 1, height = 1, aspect = 1;
  let layout = layoutFor(1);
  const ends: { a: Vec3; b: Vec3 }[] = [];
  const pluck = Array.from({ length: STRINGS }, () => ({ t0: -100, amp: 0, pos: 0.5 }));
  const screen = Array.from({ length: STRINGS }, () => ({ ax: 0, ay: 0, bx: 0, by: 0, aw: 1, bw: 1 }));

  let mode: Mode = 'mixed';
  const intensity = { a: 0, b: 0 };
  let greenness = 0.5;
  let scroll = 0;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0, glow: 0, active: false, lastX: NaN, lastY: NaN, lastT: 0 };

  let visible = true;
  let running = false;
  let handle = 0;
  let readyFired = false;
  let lost = false;
  const start = performance.now();
  let time = 0;
  let lastNow = 0;
  let frameTimes: number[] = [];

  function worldAt(fx: number, fy: number, z: number): Vec3 {
    const half = Math.tan(FOV / 2) * (CAM_Z - z);
    return [(fx * 2 - 1) * half * aspect, (1 - fy * 2) * half, z];
  }

  function applySize() {
    width = Math.max(1, Math.round(cssW * dpr));
    height = Math.max(1, Math.round(cssH * dpr));
    canvas.width = width;
    canvas.height = height;
    aspect = cssW / cssH;
    layout = layoutFor(aspect);
    ends.length = 0;
    for (let i = 0; i < STRINGS; i++) {
      const u = i / (STRINGS - 1) - 0.5;
      ends.push({
        a: worldAt(layout.cx + u * layout.spreadTop, layout.top, Z_FAR),
        b: worldAt(layout.cx + u * layout.spreadBottom, layout.bottom, Z_NEAR),
      });
    }
    perspective(proj, FOV, aspect, 0.1, 60);
    gl!.viewport(0, 0, width, height);
  }

  /** Beams in screen space "p": apex outside the top corners, aimed across the strings. */
  function beams() {
    const half = aspect / 2;
    const cx = (layout.cx - 0.5) * aspect;
    const sway = Math.sin(time * 0.21) * 0.05;
    const px = pointer.sx * half * 0.35;
    const norm = (from: number[], to: number[]) => {
      const dx = to[0] - from[0], dy = to[1] - from[1];
      const l = Math.hypot(dx, dy) || 1;
      return [from[0], from[1], dx / l, dy / l];
    };
    return {
      a: norm([-half - 0.1, 0.62], [cx - 0.12 + sway + px, -0.3]),
      b: norm([half + 0.1, 0.62], [cx + 0.14 - sway + px, -0.34]),
    };
  }

  function alongString(s: (typeof screen)[number], k: number) {
    return (k / s.bw) / ((1 - k) / s.aw + k / s.bw);
  }

  function strumAt(x: number, y: number, prevX: number, speed: number) {
    for (let i = 0; i < STRINGS; i++) {
      const s = screen[i];
      const lo = Math.min(s.ay, s.by) - 30, hi = Math.max(s.ay, s.by) + 30;
      if (y < lo || y > hi) continue;
      const k = clamp((y - s.ay) / (s.by - s.ay || 1), 0, 1);
      const sx = s.ax + (s.bx - s.ax) * k;
      if ((prevX - sx) * (x - sx) < 0) hit(i, clamp(speed * 0.085, 0.05, 0.3), clamp(alongString(s, k), 0.08, 0.92));
    }
  }

  function tapAt(x: number, y: number) {
    let best = -1, bestD = 26, bestT = 0.5;
    for (let i = 0; i < STRINGS; i++) {
      const s = screen[i];
      if (y < Math.min(s.ay, s.by) - 10 || y > Math.max(s.ay, s.by) + 10) continue;
      const k = clamp((y - s.ay) / (s.by - s.ay || 1), 0, 1);
      const d = Math.abs(s.ax + (s.bx - s.ax) * k - x);
      if (d < bestD) {
        bestD = d;
        best = i;
        bestT = alongString(s, k);
      }
    }
    if (best >= 0) hit(best, 0.2, clamp(bestT, 0.08, 0.92));
  }

  function hit(i: number, amp: number, pos: number) {
    const p = pluck[i];
    const residual = p.amp * Math.exp(-(time - p.t0) * 1.9);
    p.amp = Math.min(residual * 0.5 + amp, 0.36);
    p.t0 = time;
    p.pos = pos;
    events.pluck(i, clamp(amp / 0.3, 0.15, 1));
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    running = false;
    caf(handle);
    events.lost();
  });

  function play() {
    if (running || !visible || lost) return;
    running = true;
    lastNow = performance.now();
    handle = raf(frame);
  }

  function frame(now: number) {
    if (!running || !visible || lost) {
      running = false;
      return;
    }
    handle = raf(frame);
    const dt = Math.min(Math.max((now - lastNow) / 1000, 0), 0.05);
    lastNow = now;
    time = (now - start) / 1000;

    // trade resolution for frame rate on weaker devices
    frameTimes.push(dt);
    if (frameTimes.length >= 90) {
      const avg = frameTimes.reduce((s, v) => s + v, 0) / frameTimes.length;
      frameTimes = [];
      if (avg > 0.026 && dpr > 1) {
        dpr = Math.max(1, dpr - 0.25);
        applySize();
      }
    }

    const target =
      mode === 'composer' ? { a: 0.4, b: 1.15, g: 0.92 } : mode === 'artist' ? { a: 1.2, b: 0.32, g: 0.08 } : { a: 0.95, b: 0.82, g: 0.5 };
    const k = 1 - Math.exp(-dt * 2.6);
    intensity.a = mix(intensity.a, target.a, k);
    intensity.b = mix(intensity.b, target.b, k);
    greenness = mix(greenness, target.g, k);

    const pk = 1 - Math.exp(-dt * 3);
    pointer.sx = mix(pointer.sx, pointer.active ? pointer.x : 0, pk);
    pointer.sy = mix(pointer.sy, pointer.active ? pointer.y : 0, pk);
    pointer.glow = mix(pointer.glow, pointer.active && !coarse ? 1 : 0, pk);

    const eye: Vec3 = [
      Math.sin(time * 0.11) * 0.35 + pointer.sx * 0.7,
      Math.cos(time * 0.09) * 0.2 + pointer.sy * 0.35 + scroll * 1.6,
      CAM_Z,
    ];
    lookAt(view, eye, [pointer.sx * 0.12, scroll * 0.9, 0]);
    multiply(pv, proj, view);

    for (let i = 0; i < STRINGS; i++) {
      const A = project(pv, ends[i].a), B = project(pv, ends[i].b);
      const s = screen[i];
      s.ax = (A.x * 0.5 + 0.5) * cssW;
      s.ay = (1 - (A.y * 0.5 + 0.5)) * cssH;
      s.bx = (B.x * 0.5 + 0.5) * cssW;
      s.by = (1 - (B.y * 0.5 + 0.5)) * cssH;
      s.aw = A.w;
      s.bw = B.w;
    }

    const fade = 1 - clamp(scroll, 0, 1) * 0.55;
    const b = beams();
    const colA = mix3(VIOLET, LAVENDER, 0.25);
    const colB = MINT;
    const g = gl!;

    // background
    g.disable(g.BLEND);
    g.useProgram(bg.p);
    g.bindBuffer(g.ARRAY_BUFFER, tri);
    const aPos = bg.a('aPos');
    g.enableVertexAttribArray(aPos);
    g.vertexAttribPointer(aPos, 2, g.FLOAT, false, 0, 0);
    g.uniform2f(bg.u('uRes'), width, height);
    g.uniform1f(bg.u('uTime'), time);
    g.uniform4f(bg.u('uBeamA'), b.a[0], b.a[1], b.a[2], b.a[3]);
    g.uniform4f(bg.u('uBeamB'), b.b[0], b.b[1], b.b[2], b.b[3]);
    g.uniform2f(bg.u('uIntensity'), intensity.a, intensity.b);
    g.uniform3f(bg.u('uPointer'), pointer.sx * aspect * 0.5, pointer.sy * 0.5, pointer.glow);
    g.uniform1f(bg.u('uFade'), fade);
    g.uniform3fv(bg.u('uColA'), colA);
    g.uniform3fv(bg.u('uColB'), colB);
    g.drawArrays(g.TRIANGLES, 0, 3);
    g.disableVertexAttribArray(aPos);

    // additive light from here on
    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE);

    // dust in the beams
    g.useProgram(dust.p);
    g.bindBuffer(g.ARRAY_BUFFER, dustBuf);
    const dPos = dust.a('aPos'), dSeed = dust.a('aSeed');
    g.enableVertexAttribArray(dPos);
    g.enableVertexAttribArray(dSeed);
    g.vertexAttribPointer(dPos, 3, g.FLOAT, false, 16, 0);
    g.vertexAttribPointer(dSeed, 1, g.FLOAT, false, 16, 12);
    g.uniformMatrix4fv(dust.u('uPV'), false, pv);
    g.uniform1f(dust.u('uTime'), time);
    g.uniform1f(dust.u('uAspect'), aspect);
    g.uniform1f(dust.u('uSize'), 3.2 * dpr);
    g.uniform4f(dust.u('uBeamA'), b.a[0], b.a[1], b.a[2], b.a[3]);
    g.uniform4f(dust.u('uBeamB'), b.b[0], b.b[1], b.b[2], b.b[3]);
    g.uniform2f(dust.u('uIntensity'), intensity.a, intensity.b);
    g.uniform3fv(dust.u('uColA'), colA);
    g.uniform3fv(dust.u('uColB'), colB);
    g.uniform1f(dust.u('uFade'), fade);
    g.drawArrays(g.POINTS, 0, DUST);
    g.disableVertexAttribArray(dPos);
    g.disableVertexAttribArray(dSeed);

    // strings
    g.useProgram(str.p);
    g.bindBuffer(g.ARRAY_BUFFER, ribbonBuf);
    const sT = str.a('aT'), sSide = str.a('aSide');
    g.enableVertexAttribArray(sT);
    g.enableVertexAttribArray(sSide);
    g.vertexAttribPointer(sT, 1, g.FLOAT, false, 8, 0);
    g.vertexAttribPointer(sSide, 1, g.FLOAT, false, 8, 4);
    g.uniformMatrix4fv(str.u('uPV'), false, pv);
    g.uniform2f(str.u('uRes'), width, height);
    g.uniform1f(str.u('uTime'), time);
    g.uniform2f(str.u('uFadeEnds'), layout.fade[0], layout.fade[1]);
    g.uniform1f(str.u('uFade'), fade);
    const halo = 13 * dpr;
    g.uniform1f(str.u('uHalo'), halo);
    for (let i = 0; i < STRINGS; i++) {
      const u = i / (STRINGS - 1);
      const tint = clamp(u * 0.85 + (greenness - 0.5) * 1.5 + 0.08, 0, 1);
      const near = mix3(LAVENDER, MINT, tint);
      const far = mix3(VIOLET, EMERALD, tint).map((v) => v * 0.8) as Vec3;
      const p = pluck[i];
      g.uniform3f(str.u('uA'), ends[i].a[0], ends[i].a[1], ends[i].a[2]);
      g.uniform3f(str.u('uB'), ends[i].b[0], ends[i].b[1], ends[i].b[2]);
      g.uniform4f(str.u('uPluck'), p.t0, p.amp, p.pos, 30 + (STRINGS - i) * 4);
      g.uniform1f(str.u('uSeed'), i * 0.37);
      g.uniform1f(str.u('uCore'), ((1.9 - u * 0.8) * dpr) / halo);
      g.uniform3fv(str.u('uColFar'), far);
      g.uniform3fv(str.u('uColNear'), near);
      g.drawArrays(g.TRIANGLE_STRIP, 0, (SEGMENTS + 1) * 2);
    }
    g.disableVertexAttribArray(sT);
    g.disableVertexAttribArray(sSide);

    if (!readyFired) {
      readyFired = true;
      events.ready();
    }
  }

  applySize();
  play();

  const scene: Scene = {
    resize(w, h, nextDpr) {
      cssW = Math.max(w, 1);
      cssH = Math.max(h, 1);
      dpr = Math.min(dpr, nextDpr) || nextDpr;
      applySize();
    },
    pointer(kind, x, y, t) {
      if (kind === 'leave') {
        pointer.active = false;
        pointer.lastX = NaN;
        return;
      }
      pointer.x = (x / cssW) * 2 - 1;
      pointer.y = -((y / cssH) * 2 - 1);
      pointer.active = true;
      if (kind === 'down') {
        tapAt(x, y);
      } else if (!Number.isNaN(pointer.lastX)) {
        const dt = Math.max(t - pointer.lastT, 8);
        strumAt(x, y, pointer.lastX, Math.hypot(x - pointer.lastX, y - pointer.lastY) / dt);
      }
      pointer.lastX = x;
      pointer.lastY = y;
      pointer.lastT = t;
    },
    setMode(next) {
      mode = next;
    },
    setScroll(p) {
      scroll = p;
    },
    setVisible(v) {
      visible = v;
      if (v) play();
    },
    strum(direction = 1, strength = 0.2) {
      for (let n = 0; n < STRINGS; n++) {
        const i = direction === 1 ? n : STRINGS - 1 - n;
        setTimeout(() => hit(i, strength, 0.35 + Math.random() * 0.3), n * 70);
      }
    },
  };
  return { scene };
}
