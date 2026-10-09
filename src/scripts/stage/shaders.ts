/**
 * GLSL ES 1.00 so the stage runs on WebGL 1 and 2 alike.
 * Space "p" is the screen centred on 0, with y up and 1 unit = viewport height.
 */

const beamFn = /* glsl */ `
float beam(vec2 p, vec2 apex, vec2 dir, float spread) {
  vec2 d = p - apex;
  float along = dot(d, dir);
  if (along <= 0.0) return 0.0;
  float perp = length(d - along * dir);
  float width = along * spread + 0.015;
  float core = exp(-(perp * perp) / (width * width) * 2.4);
  return core * exp(-along * 0.55) * smoothstep(0.0, 0.18, along);
}
`;

export const bgVert = /* glsl */ `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const bgFrag = /* glsl */ `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec4 uBeamA;
uniform vec4 uBeamB;
uniform vec2 uIntensity;
uniform vec3 uPointer;
uniform float uFade;
uniform vec3 uColA;
uniform vec3 uColB;
${beamFn}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - 0.5 * uRes) / uRes.y;
  float hazeA = 0.55 + 0.75 * noise(p * vec2(2.2, 1.4) + vec2(uTime * 0.035, -uTime * 0.06));
  float hazeB = 0.55 + 0.75 * noise(p * vec2(2.0, 1.6) + vec2(-uTime * 0.03, -uTime * 0.05) + 7.3);
  float a = beam(p, uBeamA.xy, uBeamA.zw, 0.3) * hazeA * uIntensity.x;
  float b = beam(p, uBeamB.xy, uBeamB.zw, 0.3) * hazeB * uIntensity.y;

  vec3 col = vec3(0.043, 0.035, 0.071);
  col += vec3(0.022, 0.016, 0.04) * smoothstep(0.2, -0.6, p.y);
  col += uColA * a * 0.62 + uColB * b * 0.5;
  // where the two beams overlap the light turns paler, like real gels
  col += vec3(0.9, 0.95, 1.0) * a * b * 0.35;

  // pools of light on the floor
  vec2 fa = (p - vec2(uBeamA.x + uBeamA.z * 1.25, -0.52)) * vec2(1.0, 3.2);
  vec2 fb = (p - vec2(uBeamB.x + uBeamB.z * 1.25, -0.52)) * vec2(1.0, 3.2);
  col += uColA * exp(-dot(fa, fa) * 5.0) * 0.1 * uIntensity.x;
  col += uColB * exp(-dot(fb, fb) * 5.0) * 0.08 * uIntensity.y;

  // soft light that follows the pointer
  vec2 dp = p - uPointer.xy;
  col += mix(uColA, uColB, 0.5) * exp(-dot(dp, dp) * 22.0) * 0.07 * uPointer.z;

  vec2 v = p * vec2(0.75, 1.0);
  col *= 1.0 - 0.6 * dot(v, v);
  col *= uFade;
  // dithering kills banding in the dark gradients
  col += (hash(frag + fract(uTime) * 61.0) - 0.5) * 0.014;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const stringVert = /* glsl */ `
attribute float aT;
attribute float aSide;
uniform mat4 uPV;
uniform vec3 uA;
uniform vec3 uB;
uniform vec2 uRes;
uniform float uTime;
uniform vec4 uPluck;
uniform float uHalo;
uniform float uSeed;
varying float vSide;
varying float vT;
varying float vEnergy;

vec3 pointAt(float t) {
  vec3 p = mix(uA, uB, t);
  float tau = max(uTime - uPluck.x, 0.0);
  float env = uPluck.y * exp(-tau * 1.9);
  float s = 0.0;
  for (int n = 1; n <= 3; n++) {
    float fn = float(n);
    s += sin(fn * 3.14159 * uPluck.z) / (fn * fn) * sin(fn * 3.14159 * t) * cos(uPluck.w * fn * tau);
  }
  float idle = 0.012 * sin(3.14159 * t) * sin(uTime * 0.9 + uSeed * 6.0 + t * 2.5);
  p.x += env * s + idle;
  return p;
}

void main() {
  vT = aT;
  vSide = aSide;
  vec3 p = pointAt(aT);
  vec4 c = uPV * vec4(p, 1.0);
  vec4 c0 = uPV * vec4(pointAt(max(aT - 0.012, 0.0)), 1.0);
  vec4 c2 = uPV * vec4(pointAt(min(aT + 0.012, 1.0)), 1.0);
  vec2 s0 = c0.xy / c0.w * uRes;
  vec2 s2 = c2.xy / c2.w * uRes;
  vec2 dir = normalize(s2 - s0 + vec2(0.0, 1e-5));
  vec2 nrm = vec2(-dir.y, dir.x);
  float tau = max(uTime - uPluck.x, 0.0);
  vEnergy = uPluck.y * exp(-tau * 1.9);
  float w = uHalo * (1.0 + vEnergy * 2.5) * clamp(9.0 / c.w, 0.45, 1.6);
  c.xy += nrm * aSide * w * 2.0 / uRes * c.w;
  gl_Position = c;
}
`;

export const stringFrag = /* glsl */ `
precision mediump float;
uniform vec3 uColFar;
uniform vec3 uColNear;
uniform float uCore;
uniform vec2 uFadeEnds;
uniform float uFade;
varying float vSide;
varying float vT;
varying float vEnergy;
void main() {
  float d = abs(vSide);
  float core = 1.0 - smoothstep(uCore * 0.4, uCore * 1.3, d);
  float halo = exp(-d * d * 7.0);
  float glow = core * (0.85 + vEnergy * 2.0) + halo * (0.16 + vEnergy * 1.6);
  float ends = smoothstep(0.0, uFadeEnds.x, vT) * (1.0 - smoothstep(uFadeEnds.y, 1.0, vT));
  vec3 col = mix(uColFar, uColNear, vT);
  col = mix(col, vec3(1.0), core * min(vEnergy * 1.6, 0.5));
  gl_FragColor = vec4(col * glow * ends * uFade, 1.0);
}
`;

export const dustVert = /* glsl */ `
attribute vec3 aPos;
attribute float aSeed;
uniform mat4 uPV;
uniform float uTime;
uniform float uAspect;
uniform float uSize;
uniform vec4 uBeamA;
uniform vec4 uBeamB;
uniform vec2 uIntensity;
uniform vec3 uColA;
uniform vec3 uColB;
varying vec3 vColor;
${beamFn}
void main() {
  vec3 p = aPos;
  p.y = mod(p.y + uTime * (0.03 + aSeed * 0.05) + 5.0, 10.0) - 5.0;
  p.x += sin(uTime * 0.17 + aSeed * 40.0) * 0.35;
  p.z += cos(uTime * 0.13 + aSeed * 25.0) * 0.3;
  vec4 c = uPV * vec4(p, 1.0);
  gl_Position = c;
  vec2 ndc = c.xy / c.w;
  vec2 sp = vec2(ndc.x * 0.5 * uAspect, ndc.y * 0.5);
  float a = beam(sp, uBeamA.xy, uBeamA.zw, 0.3) * uIntensity.x;
  float b = beam(sp, uBeamB.xy, uBeamB.zw, 0.3) * uIntensity.y;
  float twinkle = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed) + aSeed * 30.0);
  vColor = (uColA * a + uColB * b) * 1.6 * twinkle;
  gl_PointSize = clamp(uSize * (8.0 / c.w) * (0.45 + aSeed), 1.0, uSize * 2.2);
}
`;

export const dustFrag = /* glsl */ `
precision mediump float;
varying vec3 vColor;
uniform float uFade;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(d));
  gl_FragColor = vec4(vColor * a * a * uFade, 1.0);
}
`;
