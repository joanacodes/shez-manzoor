/**
 * The stage itself: boards, a velvet curtain, the beam of the light from above with
 * dust drifting in it, glow tape marks and a setlist taped to the floor.
 */
import * as THREE from 'three';
import { setlist, stageBoards } from './textures';

export function createFloor() {
  const { map } = stageBoards();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 9),
    new THREE.MeshStandardMaterial({ map, color: 0x6e655e, roughness: 0.74, metalness: 0, envMapIntensity: 0.6 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 0.5;
  floor.receiveShadow = true;
  floor.name = 'floor';
  return floor;
}

/** Velvet drape: soft vertical folds that catch the coloured wash lights. */
export function createCurtain(width = 11, height = 6.5) {
  const geo = new THREE.PlaneGeometry(width, height, 260, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = 0.11 * Math.sin(x * 11.4) + 0.06 * Math.sin(x * 4.3 + 1.2) + 0.03 * Math.sin(x * 23.1 + 0.4);
    pos.setZ(i, z);
  }
  geo.computeVertexNormals();
  const curtain = new THREE.Mesh(
    geo,
    new THREE.MeshPhysicalMaterial({
      color: 0x272030,
      roughness: 0.9,
      sheen: 0.9,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color(0xd9ceff),
      envMapIntensity: 0.2,
    }),
  );
  curtain.position.set(0, height / 2, -2.5);
  curtain.receiveShadow = true;
  curtain.name = 'curtain';
  return curtain;
}

const beamVert = /* glsl */ `
uniform float uHeight;
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vT;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vT = clamp(-position.y / uHeight, 0.0, 1.0);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const beamFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vT;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  float facing = abs(dot(normalize(vNormalW), V));
  float body = pow(facing, 3.0);
  float ends = smoothstep(0.0, 0.12, vT) * (1.0 - smoothstep(0.82, 1.0, vT) * 0.85);
  float n = noise(vec3(vWorld.x * 1.7, vWorld.y * 0.9 - uTime * 0.07, vWorld.z * 1.7 + uTime * 0.03));
  float n2 = noise(vec3(vWorld.x * 4.0 + uTime * 0.05, vWorld.y * 2.2, vWorld.z * 4.0));
  float haze = 0.55 + 0.35 * n + 0.15 * n2;
  float a = body * ends * haze * uOpacity * mix(1.25, 0.5, vT);
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

/** A cone of light in the haze, from the lamp down to the floor. */
export function createBeam(from: THREE.Vector3, to: THREE.Vector3, angle: number, color: THREE.ColorRepresentation) {
  const dir = to.clone().sub(from);
  const height = dir.length();
  const radius = Math.tan(angle) * height;
  const geo = new THREE.CylinderGeometry(0.07, radius, height, 72, 24, true);
  geo.translate(0, -height / 2, 0);
  const uniforms = {
    uColor: { value: new THREE.Color(color) },
    uOpacity: { value: 0 },
    uTime: { value: 0 },
    uHeight: { value: height },
  };
  const mesh = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      vertexShader: beamVert,
      fragmentShader: beamFrag,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  mesh.position.copy(from);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
  mesh.renderOrder = 2;
  mesh.name = 'beam';
  return { mesh, uniforms, radius, height };
}

const dustVert = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uSize;
uniform vec3 uFrom;
uniform vec3 uAxis;
uniform vec3 uU;
uniform vec3 uV;
uniform float uHeight;
uniform float uRadius;
varying float vAlpha;
void main() {
  float t = fract(aSeed.x + uTime * 0.004 * (0.4 + aSeed.w));
  float ang = aSeed.z * 6.2831 + uTime * 0.05 * (aSeed.w - 0.5);
  float r = aSeed.y * uRadius * mix(0.06, 1.0, t) * 0.92;
  vec3 p = uFrom + uAxis * (t * uHeight) + (uU * cos(ang) + uV * sin(ang)) * r;
  p += vec3(sin(uTime * 0.3 + aSeed.z * 20.0), cos(uTime * 0.23 + aSeed.x * 17.0), sin(uTime * 0.19 + aSeed.y * 13.0)) * 0.02;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (0.5 + aSeed.w) / -mv.z;
  vAlpha = smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.8, 1.0, t)) * (0.35 + 0.65 * fract(aSeed.w * 7.0 + uTime * 0.2 * aSeed.y));
}`;

const dustFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d) * vAlpha * uOpacity;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

/** Specks of dust that drift through the beam and catch the light. */
export function createDust(from: THREE.Vector3, to: THREE.Vector3, radius: number, count = 700) {
  const axis = to.clone().sub(from);
  const height = axis.length();
  axis.normalize();
  const u = new THREE.Vector3(1, 0, 0).cross(axis).normalize();
  const v = axis.clone().cross(u).normalize();
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    seeds[i * 4] = Math.random();
    seeds[i * 4 + 1] = Math.sqrt(Math.random());
    seeds[i * 4 + 2] = Math.random();
    seeds[i * 4 + 3] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const uniforms = {
    uTime: { value: 0 },
    uSize: { value: 9 },
    uOpacity: { value: 0 },
    uColor: { value: new THREE.Color(1.0, 0.93, 0.82) },
    uFrom: { value: from.clone() },
    uAxis: { value: axis },
    uU: { value: u },
    uV: { value: v },
    uHeight: { value: height },
    uRadius: { value: radius },
  };
  const points = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      vertexShader: dustVert,
      fragmentShader: dustFrag,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  points.frustumCulled = false;
  points.renderOrder = 3;
  points.name = 'dust';
  return { points, uniforms };
}

/** Fluorescent spike tape: the marks that tell performers where to stand. */
export function createTapeMarks(marks: { x: number; z: number; r?: number }[]) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.25, 0.8), toneMapped: false });
  const strip = new THREE.PlaneGeometry(0.11, 0.022);
  for (const m of marks) {
    const t = new THREE.Group();
    const a = new THREE.Mesh(strip, mat);
    const b = new THREE.Mesh(strip, mat);
    a.rotation.x = b.rotation.x = -Math.PI / 2;
    b.rotation.z = Math.PI / 2;
    b.position.z = 0.044;
    t.add(a, b);
    t.position.set(m.x, 0.0015, m.z);
    t.rotation.y = m.r ?? 0;
    g.add(t);
  }
  g.name = 'tape';
  return g;
}

/** An A4 setlist taped to the boards in front of the mic. */
export function createSetlist(titles: string[], fonts: { serif: string; mono: string }) {
  const sheet = new THREE.Mesh(
    new THREE.PlaneGeometry(0.21, 0.297),
    new THREE.MeshStandardMaterial({ map: setlist(titles, fonts), color: 0x8f8a84, roughness: 0.9, envMapIntensity: 0.3 }),
  );
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.y = 0.002;
  sheet.receiveShadow = true;
  sheet.name = 'setlist';
  return sheet;
}

/** A dark studio environment with stage-coloured panels, for reflections in chrome and lacquer. */
export function createEnvironment(renderer: THREE.WebGLRenderer) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: 0x050408, side: THREE.BackSide })));
  const panel = (w: number, h: number, color: THREE.ColorRepresentation, strength: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 1, 0);
    env.add(m);
  };
  panel(3, 3, 0xfff1dc, 6, 0.3, 9, 2); // the lamp overhead
  panel(5, 4, 0x8a5cff, 2.2, -9, 3, -3); // purple wash
  panel(5, 4, 0x2fe3a2, 1.8, 9, 3, -2); // green wash
  panel(12, 1.5, 0xffc89a, 0.35, 0, 1.2, 10); // the room, out front
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  return tex;
}
