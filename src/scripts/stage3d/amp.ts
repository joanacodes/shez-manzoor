/**
 * A 1960s-style combo amp standing behind the guitar: black tolex, silver grille cloth
 * framed in white piping, a black control panel with a row of knobs and a red pilot light,
 * and a leather handle. The script badge on the grille carries his name, like the
 * SHEZVISION badge on the TV.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ampPanel, contactShadow, grilleCloth, scriptBadge, tolex } from './textures';

/** The size of the real thing, in metres. */
const W = 0.62;
const H = 0.445;
const D = 0.24;
/** tolex left showing around the grille and the panel */
const BORDER = 0.021;
const PANEL_H = 0.085;
const PANEL_TOP = H - 0.012;
/** the knobs sit a little below the middle of the panel, under their labels */
const KNOB_Y = 0.4;

/** The panel, left to right: two channels, each with two inputs and its knobs. */
const CONTROLS = [
  { x: 0.035, label: 'INPUT', jack: true },
  { x: 0.075, label: '', jack: true },
  { x: 0.135, label: 'VOLUME', jack: false },
  { x: 0.195, label: 'TREBLE', jack: false },
  { x: 0.255, label: 'BASS', jack: false },
  { x: 0.335, label: 'INPUT', jack: true },
  { x: 0.375, label: '', jack: true },
  { x: 0.435, label: 'VOLUME', jack: false },
  { x: 0.495, label: 'TREBLE', jack: false },
  { x: 0.555, label: 'BASS', jack: false },
  { x: 0.625, label: 'REVERB', jack: false },
  { x: 0.685, label: 'SPEED', jack: false },
  { x: 0.745, label: 'INTENSITY', jack: false },
];
const PILOT_X = 0.935;

export function createAmp(fonts: { serif: string; mono: string }) {
  const g = new THREE.Group();
  g.name = 'amp';
  const shadow = <T extends THREE.Mesh>(m: T) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  const grain = tolex();
  const vinyl = new THREE.MeshPhysicalMaterial({ map: grain.map, bumpMap: grain.bump, bumpScale: 0.8, roughness: 0.58, clearcoat: 0.2, clearcoatRoughness: 0.45 });
  // the amp stands outside the spotlight: the pale cloth, the piping and the badge keep a
  // little light of their own, so they read silver and white in the dark, not tinted by the washes
  const weave = grilleCloth();
  const cloth = new THREE.MeshStandardMaterial({ map: weave, roughness: 0.8, metalness: 0.1, envMapIntensity: 0.45, emissive: 0xffffff, emissiveMap: weave, emissiveIntensity: 0.16 });
  const piping = new THREE.MeshStandardMaterial({ color: 0xe7e2d6, roughness: 0.45, emissive: 0xe7e2d6, emissiveIntensity: 0.07 });
  const face = new THREE.MeshPhysicalMaterial({ map: ampPanel(fonts.mono, CONTROLS, PILOT_X, KNOB_Y), roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.32, metalness: 0.1 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe2e2e2, metalness: 1, roughness: 0.18 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x141110, roughness: 0.55 });
  const jewel = new THREE.MeshStandardMaterial({ color: 0x4a0806, emissive: 0xff2414, emissiveIntensity: 0, roughness: 0.2 });

  // cabinet
  const cabinet = shadow(new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 4, 0.014), vinyl));
  cabinet.position.y = H / 2;
  g.add(cabinet);
  const front = D / 2;

  // grille cloth framed in white piping
  const gw = W - 2 * BORDER;
  const gBottom = 0.024;
  const gTop = PANEL_TOP - PANEL_H - 0.012;
  const gh = gTop - gBottom;
  const pipe = new THREE.Mesh(new THREE.PlaneGeometry(gw + 0.007, gh + 0.007), piping);
  pipe.position.set(0, gBottom + gh / 2, front + 0.001);
  const grille = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), cloth);
  grille.position.set(0, gBottom + gh / 2, front + 0.0016);
  g.add(shadow(pipe), shadow(grille));

  // the script badge, rising a little to the right in the top left corner of the grille
  const script = scriptBadge('Shez', `italic 600 128px ${fonts.serif}`);
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(0.17, 0.064),
    new THREE.MeshStandardMaterial({ map: script, transparent: true, depthWrite: false, metalness: 0.5, roughness: 0.3, emissive: 0xffffff, emissiveMap: script, emissiveIntensity: 0.22 }),
  );
  badge.position.set(-gw / 2 + 0.105, gTop - 0.048, front + 0.0026);
  badge.rotation.z = 0.08;
  g.add(badge);

  // control panel
  const pw = W - 2 * BORDER;
  const panelY = PANEL_TOP - PANEL_H / 2;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(pw, PANEL_H), face);
  panel.position.set(0, panelY, front + 0.0012);
  g.add(shadow(panel));

  // knobs (black, with a chrome cap) and the chrome nuts of the inputs
  const knobY = panelY - PANEL_H / 2 + KNOB_Y * PANEL_H;
  const knobs: THREE.BufferGeometry[] = [];
  const bright: THREE.BufferGeometry[] = [];
  const along = (geo: THREE.BufferGeometry, x: number, z: number) => geo.rotateX(Math.PI / 2).translate(x, knobY, front + z);
  for (const c of CONTROLS) {
    const x = (c.x - 0.5) * pw;
    if (c.jack) {
      bright.push(new THREE.TorusGeometry(0.0055, 0.0018, 8, 20).translate(x, knobY, front + 0.002));
      continue;
    }
    knobs.push(along(new THREE.CylinderGeometry(0.0125, 0.0135, 0.005, 28), x, 0.004));
    knobs.push(along(new THREE.CylinderGeometry(0.0085, 0.0095, 0.013, 24), x, 0.011));
    bright.push(along(new THREE.CylinderGeometry(0.006, 0.006, 0.0016, 24), x, 0.0178));
  }
  g.add(shadow(new THREE.Mesh(mergeGeometries(knobs), black)));

  // pilot light: a red jewel in a chrome bezel, lit when the amp is on
  const pilotX = (PILOT_X - 0.5) * pw;
  bright.push(new THREE.TorusGeometry(0.009, 0.0022, 8, 24).translate(pilotX, knobY, front + 0.002));
  g.add(new THREE.Mesh(mergeGeometries(bright), chrome));
  const pilot = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), jewel);
  pilot.rotation.x = Math.PI / 2;
  pilot.position.set(pilotX, knobY, front + 0.002);
  g.add(pilot);

  // leather handle between two chrome caps
  const strap = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.08, 0, 0),
      new THREE.Vector3(-0.05, 0.016, 0),
      new THREE.Vector3(0, 0.022, 0),
      new THREE.Vector3(0.05, 0.016, 0),
      new THREE.Vector3(0.08, 0, 0),
    ]),
    24,
    0.0075,
    10,
    false,
  ).scale(1, 0.75, 2.4);
  const handle = shadow(new THREE.Mesh(strap, leather));
  handle.position.y = H + 0.006;
  g.add(handle);
  for (const s of [-1, 1]) {
    const cap = shadow(new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.011, 0.042, 2, 0.004), chrome));
    cap.position.set(s * 0.086, H + 0.004, 0);
    g.add(cap);
  }

  // a soft patch of shadow on the boards around its base
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 0.34, D + 0.4),
    new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: contactShadow(), transparent: true, opacity: 0.8, depthWrite: false }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.0016;
  g.add(contact);

  return {
    group: g,
    /** 0 to 1: the pilot light comes on with the rest of the stage */
    setPower(v: number) {
      jewel.emissiveIntensity = 2.6 * v;
    },
  };
}
