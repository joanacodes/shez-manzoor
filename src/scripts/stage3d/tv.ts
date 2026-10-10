/**
 * An old wood-cabinet CRT television on a mid-century side table. The screen is a
 * shader that curves, scans and flickers like a tube, and plays clips of his film and
 * TV work one after another (static when there are none).
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { decal, speakerCloth, walnut } from './textures';

export type Channel = {
  /** short muted clip of his film and TV work */
  video: string;
};

const screenVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const screenFrag = /* glsl */ `
uniform sampler2D uTex;
uniform float uTime;
uniform float uPower;
uniform float uStatic;
uniform float uBright;
// where the picture sits on the tube: (1, 1) fills it; wider clips get bars top and bottom
uniform vec2 uScale;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 barrel(vec2 uv) { vec2 c = uv - 0.5; float r2 = dot(c, c); return 0.5 + c * (1.0 + 0.1 * r2 + 0.08 * r2 * r2); }
float rounded(vec2 uv) { vec2 q = abs(uv - 0.5) - vec2(0.44); float d = length(max(q, 0.0)) - 0.06; return 1.0 - smoothstep(-0.004, 0.004, d); }
void main() {
  vec2 uv = barrel(vUv);
  float mask = rounded(uv);
  float shift = 0.0022 + uStatic * 0.012;
  vec2 tuv = (uv - 0.5) * uScale + 0.5;
  vec3 col;
  col.r = texture2D(uTex, tuv + vec2(shift, 0.0)).r;
  col.g = texture2D(uTex, tuv).g;
  col.b = texture2D(uTex, tuv - vec2(shift, 0.0)).b;
  col *= step(0.0, tuv.y) * step(tuv.y, 1.0);
  float n = hash(floor(uv * vec2(320.0, 240.0)) + fract(uTime * 23.0) * 91.0);
  col = mix(col, vec3(n * 0.9), clamp(uStatic, 0.0, 1.0));
  col *= 0.8 + 0.2 * sin(uv.y * 240.0 * 6.2831);
  col *= 0.92 + 0.08 * sin(uv.x * 320.0 * 6.2831);
  float roll = fract(uv.y * 0.85 - uTime * 0.11);
  col *= 0.95 + 0.07 * smoothstep(0.0, 0.05, roll) * (1.0 - smoothstep(0.05, 0.18, roll));
  col *= 0.985 + 0.015 * sin(uTime * 60.0);
  col += (n - 0.5) * 0.045;
  vec2 c = uv - 0.5;
  col *= 1.0 - dot(c, c) * 1.3;
  // power on: a dot, then a line, then the picture opens up
  float wide = smoothstep(0.0, 0.18, uPower);
  float tall = smoothstep(0.18, 1.0, uPower);
  float hx = mix(0.0, 0.5, wide);
  float hy = mix(0.003, 0.5, tall);
  float on = (1.0 - smoothstep(hx, hx + 0.01, abs(uv.x - 0.5))) * (1.0 - smoothstep(hy, hy + 0.01, abs(uv.y - 0.5)));
  col = col * tall + vec3(1.4) * (1.0 - tall) * on;
  col *= on;
  float glare = smoothstep(0.55, 0.0, length((vUv - vec2(0.24, 0.82)) * vec2(1.0, 1.7))) * 0.07;
  gl_FragColor = vec4((col * uBright + glare) * mask, 1.0);
}`;

export function createTV(fonts: { serif: string; mono: string }) {
  const g = new THREE.Group();
  g.name = 'tv';
  const shadow = <T extends THREE.Object3D>(m: T) => {
    m.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return m;
  };
  const veneer = new THREE.MeshPhysicalMaterial({ map: walnut(), roughness: 0.5, clearcoat: 0.45, clearcoatRoughness: 0.3 });
  const darkWood = new THREE.MeshPhysicalMaterial({ map: walnut(), color: 0x8a6a55, roughness: 0.55, clearcoat: 0.3 });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x17140f, roughness: 0.5, metalness: 0.1 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdcdcdc, metalness: 1, roughness: 0.2 });

  // side table
  const table = new THREE.Group();
  const top = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.035, 0.5, 4, 0.012), darkWood);
  top.position.y = 0.42;
  table.add(top);
  for (const [x, z] of [
    [-0.29, -0.19],
    [0.29, -0.19],
    [-0.29, 0.19],
    [0.29, 0.19],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.009, 0.42, 14), darkWood);
    leg.position.set(x * 1.06, 0.205, z * 1.08);
    leg.rotation.z = -Math.sign(x) * 0.08;
    leg.rotation.x = Math.sign(z) * 0.08;
    table.add(leg);
  }
  g.add(shadow(table));

  // cabinet
  const tv = new THREE.Group();
  tv.position.y = 0.4375 + 0.23;
  g.add(tv);
  const cabinet = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.46, 0.44, 6, 0.035), veneer);
  tv.add(shadow(cabinet));
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.4, 0.03, 4, 0.02), plastic);
  bezel.position.z = 0.215;
  tv.add(shadow(bezel));

  // screen: slightly convex, like a tube
  const sw = 0.36, sh = 0.28;
  const geo = new THREE.PlaneGeometry(sw, sh, 32, 24);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (sw / 2), y = pos.getY(i) / (sh / 2);
    pos.setZ(i, 0.016 * (1 - 0.5 * x * x - 0.5 * y * y));
  }
  geo.computeVertexNormals();
  const placeholder = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  placeholder.needsUpdate = true;
  const uniforms = {
    uTex: { value: placeholder as THREE.Texture },
    uTime: { value: 0 },
    uPower: { value: 0 },
    uStatic: { value: 0 },
    uBright: { value: 1.35 },
    uScale: { value: new THREE.Vector2(1, 1) },
  };
  const screenMat = new THREE.ShaderMaterial({ vertexShader: screenVert, fragmentShader: screenFrag, uniforms, toneMapped: false });
  const screen = new THREE.Mesh(geo, screenMat);
  screen.position.set(-0.07, 0.0, 0.226);
  tv.add(screen);
  // dark glass rim around the tube
  const rim = new THREE.Mesh(new RoundedBoxGeometry(sw + 0.03, sh + 0.03, 0.01, 4, 0.03), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.2, metalness: 0.2 }));
  rim.position.set(-0.07, 0, 0.226);
  tv.add(rim);

  // controls: two dials, a speaker panel and a little badge with his name
  for (const y of [0.1, 0.0]) {
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.028, 32), plastic);
    dial.rotation.x = Math.PI / 2;
    dial.position.set(0.195, y, 0.24);
    tv.add(shadow(dial));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 20), chrome);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(0.195, y, 0.246);
    tv.add(cap);
  }
  const speaker = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.11), new THREE.MeshStandardMaterial({ map: speakerCloth(), roughness: 0.95 }));
  speaker.position.set(0.195, -0.115, 0.2315);
  tv.add(speaker);
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(0.11, 0.028),
    new THREE.MeshStandardMaterial({ map: decal('SHEZVISION', `600 64px ${fonts.mono}`, '#d9d3c4', 512, 128), transparent: true, metalness: 0.5, roughness: 0.4 }),
  );
  badge.position.set(-0.07, -0.172, 0.2315);
  tv.add(badge);

  // rabbit ears
  const ears = new THREE.Group();
  ears.position.set(0.05, 0.23, -0.05);
  tv.add(ears);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), plastic);
  ears.add(shadow(dome));
  for (const s of [-1, 1]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0032, 0.46, 8), chrome);
    rod.position.set(s * 0.1, 0.2, 0);
    rod.rotation.z = -s * 0.48;
    ears.add(shadow(rod));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), chrome);
    tip.position.set(s * 0.205, 0.405, 0);
    ears.add(tip);
  }

  /* ---------- channels: his clips, one after another ---------- */
  let channels: Channel[] = [];
  let current = -1;
  let showing = 0; // which show() call is the latest
  let video: HTMLVideoElement | null = null;
  let texture: THREE.VideoTexture | null = null;
  let upcoming: HTMLVideoElement | null = null; // the next clip, loading while this one plays
  let ended = false;
  let noSignal = true;
  const glowColor = new THREE.Color(0.6, 0.7, 1.0);
  const tint = document.createElement('canvas');
  tint.width = tint.height = 1;
  const tintCtx = tint.getContext('2d', { willReadFrequently: true })!;
  let tintedAt = 0;

  function off() {
    uniforms.uTex.value = placeholder;
    uniforms.uScale.value.set(1, 1);
    video?.pause();
    video?.removeAttribute('src');
    video?.load();
    texture?.dispose();
    video = null;
    texture = null;
  }

  function load(src: string) {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = src;
    v.addEventListener('ended', () => {
      if (v === video) ended = true;
    });
    return v;
  }

  async function show(index: number) {
    const ch = channels[index];
    if (!ch) return;
    const call = ++showing;
    current = index;
    ended = false;
    // static while the set changes channel
    noSignal = true;
    const v = upcoming?.getAttribute('src') === ch.video ? upcoming : load(ch.video);
    upcoming = null;
    try {
      // static while it loads; a clip that cannot start within 20 seconds counts as not playing
      await Promise.race([v.play(), new Promise((_, fail) => window.setTimeout(() => fail(new Error('timeout')), 20000))]);
    } catch {
      v.pause();
      v.removeAttribute('src');
      v.load();
      // cannot play here: a moment of static, then the next clip
      if (call !== showing) return;
      off();
      noSignal = true;
      window.setTimeout(() => {
        if (call === showing) ended = true;
      }, 2000);
      return;
    }
    if (call !== showing) {
      v.pause();
      return;
    }
    off();
    video = v;
    texture = new THREE.VideoTexture(v);
    texture.colorSpace = THREE.SRGBColorSpace;
    uniforms.uTex.value = texture;
    // a widescreen film on an old set: trimmed to 16:9 at most, with bars top and bottom
    const aspect = v.videoWidth / v.videoHeight || 16 / 9;
    const film = Math.min(aspect, 16 / 9);
    uniforms.uScale.value.set(film / aspect, film / (sw / sh));
    noSignal = false;
    if (channels.length > 1) upcoming = load(channels[(index + 1) % channels.length].video);
  }

  return {
    group: g,
    screenWorld: screen,
    uniforms,
    /** the colour the picture throws on the stage, read from the film a few times a second */
    get glow() {
      const now = performance.now();
      if (video && now - tintedAt > 400) {
        tintedAt = now;
        try {
          tintCtx.drawImage(video, 0, 0, 1, 1);
          const [r, gg, b] = tintCtx.getImageData(0, 0, 1, 1).data;
          glowColor.setRGB(r / 255, gg / 255, b / 255).lerp(new THREE.Color(0.75, 0.8, 1), 0.35);
        } catch {
          /* keep the last colour */
        }
      }
      return glowColor;
    },
    /** the clip has finished (or would not play): time for the next one */
    get ended() {
      return ended;
    },
    /** no clip on screen: the tube shows static */
    get noSignal() {
      return noSignal;
    },
    /** what is on, for debugging */
    get onAir() {
      return video ? `${decodeURIComponent(video.currentSrc.split('/').pop() ?? '')}@${video.currentTime.toFixed(1)}` : null;
    },
    setChannels(list: Channel[]) {
      channels = list;
      if (list.length) void show(0);
    },
    async next() {
      if (!channels.length) return;
      await show((current + 1) % channels.length);
    },
  };
}
