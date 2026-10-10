/**
 * The stage: an electric guitar on its stand, a vocal mic, an old TV playing his film
 * and TV work, and one light from above. Runs the intro (lights come up, the camera
 * walks in) and then idles, reacting to the pointer, the scroll position and taps.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createGuitar, createGuitarStand, mountGuitar } from './guitar';
import { createMicStand } from './mic';
import { createTV, type Channel } from './tv';
import { createBeam, createCurtain, createDust, createEnvironment, createFloor, createSetlist, createTapeMarks } from './set';

export type StageEvent = 'lit' | 'settled';
export type Pickable = 'tv' | 'guitar' | 'mic';
export type StageOptions = {
  canvas: HTMLCanvasElement;
  fonts: { serif: string; mono: string };
  channels: Channel[];
  setlist: string[];
  tier: 'high' | 'low';
  onEvent?: (e: StageEvent) => void;
};

/** Seconds into the intro at which each thing happens. The whole intro lasts INTRO_LENGTH. */
export const INTRO_LENGTH = 3.5;
const T = {
  keyOn: 0.25,
  keyFull: 0.95,
  tvOn: 0.95,
  tvFull: 1.75,
  rims: [1.25, 2.4],
  wash: [1.6, 2.9],
  camera: [0, 3.3],
  settled: 3.3,
};

type Spot = [x: number, z: number, rotY: number];
type Layout = {
  mic: Spot;
  guitar: Spot;
  tv: Spot;
  setlist: Spot;
  /** vertical field of view, degrees */
  fov: number;
  /** where the stage (floor to the top of the mic) sits on screen: top and bottom, 0 to 1 */
  band: [number, number];
  /** half-width of the set, which must stay in frame */
  halfWidth: number;
  /** x of the coloured washes on the curtain: purple left, green right */
  wash: [number, number];
};

/** The screen bands leave room for the name above and the carousel below (see StageHero and WorkCarousel). */
function layoutFor(aspect: number): Layout {
  if (aspect < 0.85) {
    return {
      mic: [0.02, 0.3, 0],
      guitar: [-0.52, -0.42, 0.45],
      tv: [0.47, -0.62, -0.52],
      setlist: [0.3, 0.78, 0.22],
      fov: 38,
      band: [0.29, 0.655],
      halfWidth: 0.86,
      wash: [-1.15, 1.2],
    };
  }
  return {
    mic: [0, 0.24, 0],
    guitar: [-1.02, -0.18, 0.42],
    tv: [1.04, -0.32, -0.4],
    setlist: [0.4, 0.7, 0.22],
    fov: 28,
    band: [0.3, 0.635],
    halfWidth: 1.5,
    wash: [-2.1, 2.2],
  };
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** A lamp being struck: two stutters, then up to full. */
function strike(t: number) {
  const s = t - T.keyOn;
  if (s < 0) return 0;
  if (s < 0.07) return 0.55;
  if (s < 0.16) return 0.04;
  if (s < 0.22) return 0.3;
  if (s < 0.3) return 0.08;
  return smooth(T.keyOn + 0.3, T.keyFull, t);
}

export async function createStage(opts: StageOptions) {
  const { canvas, fonts, tier } = opts;
  const high = tier === 'high';

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.setClearColor(0x040306, 1);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, high ? 2 : 1.5);
  renderer.setPixelRatio(pixelRatio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040306);
  scene.fog = new THREE.FogExp2(0x050408, 0.05);
  scene.environment = createEnvironment(renderer);
  scene.environmentIntensity = 0;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);

  /* ---------- the set ---------- */
  scene.add(createFloor());
  scene.add(createCurtain());

  const stand = createGuitarStand();
  const guitar = createGuitar({ serif: fonts.serif });
  mountGuitar(stand, guitar);
  scene.add(stand);
  const strings = guitar.getObjectByName('strings') as THREE.Mesh;

  const mic = createMicStand();
  scene.add(mic);

  const tv = createTV(fonts);
  scene.add(tv.group);
  tv.setChannels(opts.channels);

  const sheet = createSetlist(opts.setlist, fonts);
  scene.add(sheet);
  const tape = createTapeMarks([
    { x: 0.16, z: 0.62, r: 0.1 },
    { x: -0.3, z: 0.52, r: -0.2 },
    { x: 0.62, z: 0.28, r: 0.4 },
  ]);
  scene.add(tape);

  /* ---------- light ---------- */
  const lampPos = new THREE.Vector3(0.12, 5.6, 1.0);
  const lampAim = new THREE.Vector3(0, 0, 0.05);
  const KEY = 150;
  const key = new THREE.SpotLight(0xfff0dc, 0, 0, 0.3, 0.72, 2);
  key.position.copy(lampPos);
  key.target.position.copy(lampAim);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(high ? 2048 : 1024);
  key.shadow.radius = 5;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.012;
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 9;
  scene.add(key, key.target);

  const beam = createBeam(lampPos, lampAim, 0.21, new THREE.Color(1.0, 0.9, 0.78));
  scene.add(beam.mesh);
  const dust = createDust(lampPos, lampAim, beam.radius, high ? 520 : 300);
  scene.add(dust.points);

  const spot = (color: number, from: [number, number, number], to: [number, number, number], angle: number, penumbra: number) => {
    const l = new THREE.SpotLight(color, 0, 0, angle, penumbra, 2);
    l.position.set(...from);
    l.target.position.set(...to);
    scene.add(l, l.target);
    return l;
  };
  const rimPurple = spot(0xa463ff, [-3.4, 3.4, -1.9], [-0.7, 0.7, -0.2], 0.42, 0.9);
  const rimGreen = spot(0x2cf0a6, [3.4, 3.2, -1.7], [0.6, 0.8, -0.3], 0.42, 0.9);
  const RIM = 70;
  const washes = [spot(0xa052ff, [-2.2, 0.15, -1.7], [-2.0, 3.6, -2.5], 0.62, 1), spot(0x1fe09c, [2.3, 0.15, -1.7], [2.2, 3.6, -2.5], 0.62, 1)];
  const WASH = 34;

  // tapping the mic changes the gel in the lamp: warm, lavender, mint
  const tints = [new THREE.Color(0xfff0dc), new THREE.Color(0xd6c2ff), new THREE.Color(0xb8ffe2)];
  const beamTint = new THREE.Color(1.0, 0.9, 0.78);
  let tint = 0;
  let gel = 0;

  const tvGlow = new THREE.PointLight(0xaabbff, 0, 2.0, 2);
  scene.add(tvGlow);
  const hemi = new THREE.HemisphereLight(0x2a2142, 0x0b0907, 0);
  scene.add(hemi);

  /* ---------- post ---------- */
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: high ? 4 : 2 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), high ? 0.45 : 0.38, 0.5, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- layout ---------- */
  let layout = layoutFor(1);
  const camBase = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  const camStart = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  const place = (o: THREE.Object3D, [x, z, r]: Spot) => {
    o.position.set(x, o.position.y, z);
    o.rotation.y = r;
  };
  let sizedAs = '';
  /** Where the page leaves room for the stage, measured between the name and the covers. */
  let band: [number, number] | null = null;
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const key = `${w}x${h}@${pixelRatio}:${band?.join(',') ?? ''}`;
    if (key === sizedAs) return;
    sizedAs = key;
    const aspect = w / h;
    layout = layoutFor(aspect);
    place(mic, layout.mic);
    place(stand, layout.guitar);
    place(tv.group, layout.tv);
    place(sheet, layout.setlist);
    washes.forEach((w, i) => {
      w.position.x = layout.wash[i] * 1.05;
      w.target.position.x = layout.wash[i];
    });
    sheet.rotation.set(-Math.PI / 2, 0, layout.setlist[2]);
    // frame the set (floor to the top of the mic, 1.5 m) inside its band on screen
    const SET_H = 1.5;
    const tan = Math.tan(THREE.MathUtils.degToRad(layout.fov / 2));
    let [top, bottom] = band ?? layout.band;
    // never squeeze the set smaller than a fifth of the screen; let it tuck under the name instead
    if (bottom - top < 0.2) top = Math.max(0.08, bottom - 0.2);
    let dist = SET_H / ((bottom - top) * 2 * tan);
    dist = Math.max(dist, layout.halfWidth / (aspect * tan * 0.94));
    const visible = 2 * tan * dist;
    const lookY = SET_H / 2 + ((top + bottom) / 2 - 0.5) * visible;
    camera.fov = layout.fov;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    camBase.target.set(0, lookY, 0);
    camBase.pos.set(0, lookY + 0.42, dist);
    camStart.pos.copy(camBase.pos).add(new THREE.Vector3(0.5, 1.1, 2.8));
    camStart.target.copy(camBase.target).add(new THREE.Vector3(0, -0.2, 0));
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(w, h);
    bloom.resolution.set(w * pixelRatio * 0.5, h * pixelRatio * 0.5);
    // the stage only moves when the layout changes, so the shadows are drawn once per layout
    renderer.shadowMap.needsUpdate = true;
    tvGlowPos();
    if (!running) render();
  }

  const tvFront = new THREE.Vector3();
  function tvGlowPos() {
    tv.group.updateMatrixWorld(true);
    tv.screenWorld.getWorldPosition(tvFront);
    const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(tv.group.quaternion);
    tvGlow.position.copy(tvFront).addScaledVector(facing, 0.3);
  }

  /* ---------- state ---------- */
  let running = false;
  let raf = 0;
  let last = 0;
  let time = 0;
  let started = false;
  let intro = 0; // seconds since the intro began
  let lit = false;
  let settled = false;
  const pointer = new THREE.Vector2();
  const pointerSmooth = new THREE.Vector2();
  let scroll = 0;
  let nextChannelAt = Infinity;
  let zapping = false;
  const CLIP_MAX = 30;
  let staticLevel = 0;
  let ring = 0;
  const glow = new THREE.Color(0.6, 0.7, 1);

  function update(dt: number) {
    time += dt;
    if (started) intro += dt;
    const t = intro;

    // lights up
    gel = Math.max(0, gel - dt * 2.2);
    const keyLevel = strike(t) * (1 - Math.sin(gel * Math.PI) * 0.75);
    key.intensity = KEY * keyLevel;
    key.color.lerp(tints[tint], Math.min(1, dt * (gel > 0.5 ? 0 : 6)));
    beam.uniforms.uColor.value.copy(key.color).multiply(beamTint);
    dust.uniforms.uColor.value.copy(key.color);
    beam.uniforms.uOpacity.value = 0.22 * keyLevel;
    dust.uniforms.uOpacity.value = 0.55 * keyLevel;
    const rims = smooth(T.rims[0], T.rims[1], t);
    rimPurple.intensity = RIM * rims;
    rimGreen.intensity = RIM * 0.8 * rims;
    const wash = smooth(T.wash[0], T.wash[1], t);
    for (const w of washes) w.intensity = WASH * wash;
    hemi.intensity = 0.5 * smooth(0.6, 2.4, t);
    scene.environmentIntensity = 0.55 * smooth(0.5, 2.2, t);

    // the TV warms up, then plays his clips one after another
    const power = smooth(T.tvOn, T.tvFull, t);
    tv.uniforms.uPower.value = power;
    tv.uniforms.uTime.value = time;
    if (!zapping && (tv.ended || time >= nextChannelAt)) zap();
    staticLevel = Math.max(0, staticLevel - dt * 2.6);
    tv.uniforms.uStatic.value = Math.min(1, Math.max(staticLevel * 1.6, tv.noSignal ? 0.6 : 0));
    glow.lerp(tv.glow, Math.min(1, dt * 3));
    tvGlow.color.copy(glow);
    tvGlow.intensity = 1.3 * power * (0.88 + 0.12 * Math.sin(time * 17.0) * Math.sin(time * 5.3)) * (1 + staticLevel);

    beam.uniforms.uTime.value = time;
    dust.uniforms.uTime.value = time;

    // strings ringing after a tap
    if (ring > 0) {
      ring = Math.max(0, ring - dt * 0.9);
      strings.scale.x = 1 + Math.sin(time * 140) * 0.04 * ring;
      (strings.material as THREE.MeshStandardMaterial).emissive.setRGB(0.5 * ring, 0.45 * ring, 0.35 * ring);
    }

    // camera: walks in during the intro, then breathes and follows the pointer
    const k = easeInOut(smooth(T.camera[0], T.camera[1], t));
    const pos = camStart.pos.clone().lerp(camBase.pos, k);
    const look = camStart.target.clone().lerp(camBase.target, k);
    pointerSmooth.lerp(pointer, Math.min(1, dt * 2.5));
    const idle = k;
    pos.x += (Math.sin(time * 0.17) * 0.05 + pointerSmooth.x * 0.3) * idle;
    pos.y += (Math.sin(time * 0.23) * 0.025 - pointerSmooth.y * 0.12) * idle + scroll * 0.9;
    look.y += scroll * 1.6;
    camera.position.copy(pos);
    camera.lookAt(look);

    if (!lit && t >= T.keyOn) {
      lit = true;
      opts.onEvent?.('lit');
    }
    if (!settled && t >= T.settled) {
      settled = true;
      nextChannelAt = time + CLIP_MAX;
      opts.onEvent?.('settled');
    }
  }

  function render() {
    composer.render();
  }

  // adaptive quality: if frames are slow once the intro is over, draw fewer pixels, then drop the glow
  let slowFrames = 0;
  let sampled = 0;
  function adapt(dt: number) {
    if (!settled) return;
    sampled++;
    if (dt > 1 / 40) slowFrames++;
    if (sampled < 90) return;
    if (slowFrames > 45) {
      if (pixelRatio > 1) {
        pixelRatio = Math.max(1, pixelRatio - 0.5);
        renderer.setPixelRatio(pixelRatio);
        resize();
      } else if (bloom.enabled) {
        bloom.enabled = false;
      }
    }
    slowFrames = 0;
    sampled = 0;
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    // the first frame after a start or a pause has no previous timestamp to measure from
    const dt = last ? Math.min(0.05, Math.max(0, (now - last) / 1000)) : 1 / 60;
    last = now;
    update(dt);
    render();
    adapt(dt);
  }

  /** a burst of static, then the next clip; a clip that never ends moves on after CLIP_MAX seconds */
  function zap() {
    if (zapping) return;
    zapping = true;
    staticLevel = 1;
    nextChannelAt = time + CLIP_MAX;
    window.setTimeout(() => {
      void tv.next().finally(() => (zapping = false));
    }, 140);
  }

  /* ---------- picking ---------- */
  const raycaster = new THREE.Raycaster();
  const targets: [Pickable, THREE.Object3D][] = [
    ['tv', tv.group],
    ['guitar', stand],
    ['mic', mic],
  ];
  function pick(clientX: number, clientY: number): Pickable | null {
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    let best: { name: Pickable; d: number } | null = null;
    for (const [name, obj] of targets) {
      const hit = raycaster.intersectObject(obj, true)[0];
      if (hit && (!best || hit.distance < best.d)) best = { name, d: hit.distance };
    }
    return best?.name ?? null;
  }

  /** Screen position of a thing on stage, for placing hints next to it. */
  function project(name: Pickable) {
    const obj = targets.find(([n]) => n === name)![1];
    const box = new THREE.Box3().setFromObject(obj);
    const p = box.getCenter(new THREE.Vector3());
    p.y = box.max.y;
    p.project(camera);
    return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
  }

  /* ---------- start ---------- */
  resize();
  camera.position.copy(camStart.pos);
  camera.lookAt(camStart.target);
  // compile every shader before the first frame, without blocking the page
  await renderer.compileAsync(scene, camera);
  render();

  return {
    canvas,
    /** Plays the intro from the top, or jumps straight to the end of it. */
    start(skip = false) {
      intro = skip ? T.settled + 0.01 : 0;
      started = true;
      this.resume();
    },
    /** Jumps to the end of the intro. */
    skip() {
      if (intro < T.settled) intro = T.settled + 0.01;
    },
    resume() {
      if (running) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    },
    pause() {
      running = false;
      cancelAnimationFrame(raf);
    },
    resize,
    /** Frames the set between these two heights on screen (0 to 1, top to bottom). */
    setBand(top: number, bottom: number) {
      band = [Math.max(0, Math.min(top, 0.9)), Math.max(0.1, Math.min(bottom, 1))];
      resize();
    },
    /** -1..1 from the centre of the screen */
    setPointer(x: number, y: number) {
      pointer.set(x, y);
    },
    /** 0 at the top of the page, 1 when the stage has scrolled away */
    setScroll(v: number) {
      scroll = v;
    },
    pick,
    project,
    zap() {
      zap();
    },
    ringStrings() {
      ring = 1;
    },
    cycleLight() {
      tint = (tint + 1) % tints.length;
      gel = 1;
    },
    get settled() {
      return settled;
    },
    /** For checking the scene from the console */
    debug() {
      return {
        intro,
        time,
        camera: camera.position.toArray().map((v) => +v.toFixed(2)),
        fov: +camera.fov.toFixed(1),
        size: [canvas.width, canvas.height],
        key: +key.intensity.toFixed(1),
        washes: washes.map((w) => +w.intensity.toFixed(1)),
        rims: [rimPurple.intensity, rimGreen.intensity].map((v) => +v.toFixed(1)),
        scroll,
        tv: tv.onAir ?? (tv.noSignal ? 'static' : '-'),
        pixelRatio,
        bloom: bloom.enabled,
      };
    },
    dispose() {
      this.pause();
      renderer.dispose();
    },
  };
}

export type Stage = Awaited<ReturnType<typeof createStage>>;
