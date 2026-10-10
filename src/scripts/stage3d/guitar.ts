/**
 * A Stratocaster-style electric guitar in natural ash with a maple neck (like his own),
 * resting on an A-frame stand. Built in centimetres, then scaled to metres.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ashBody, decal, maple } from './textures';

const CM = 0.01;
const SCALE = 64.8; // scale length
const NUT_Y = 76.2;
const SADDLE_Y = 10.6;
const BODY_FRONT = 4.05;
const NECK_FRONT = 5.1;

function bodyShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(-7, 0, -16, 3, -16.2, 11);
  s.bezierCurveTo(-16.4, 17, -12, 19, -11.2, 23);
  s.bezierCurveTo(-10.6, 27, -13.8, 29, -13.5, 33);
  s.bezierCurveTo(-13.2, 39, -11.8, 45.6, -9.5, 45.5);
  s.bezierCurveTo(-7.5, 45.4, -5.5, 40, -2.8, 37.2);
  s.lineTo(2.8, 37.2);
  s.bezierCurveTo(4.8, 37.6, 5.8, 41.2, 7.8, 41.5);
  s.bezierCurveTo(10.6, 41.8, 13.2, 35, 12.6, 30);
  s.bezierCurveTo(12.2, 26.5, 11.0, 25.5, 11.2, 23);
  s.bezierCurveTo(11.6, 19, 16.4, 17, 16.2, 11);
  s.bezierCurveTo(16, 3, 7, 0, 0, 0);
  return s;
}

function pickguardShape() {
  const s = new THREE.Shape();
  s.moveTo(-3.1, 36.9);
  s.bezierCurveTo(-5, 37.4, -8.4, 36.6, -9.6, 35.0);
  s.bezierCurveTo(-10.8, 33.4, -10.4, 29.0, -10.0, 26.0);
  s.bezierCurveTo(-9.6, 22.5, -8.8, 16.8, -6.2, 15.8);
  s.lineTo(4.8, 14.0);
  s.bezierCurveTo(6.0, 13.4, 6.4, 8.8, 8.8, 7.8);
  s.bezierCurveTo(10.8, 6.8, 13.2, 7.6, 13.6, 9.8);
  s.bezierCurveTo(14.2, 13.0, 12.0, 17.2, 11.6, 22.0);
  s.bezierCurveTo(11.2, 25.5, 11.6, 28.0, 10.8, 30.0);
  s.bezierCurveTo(9.6, 34.2, 5.4, 36.4, 3.1, 36.9);
  s.closePath();
  return s;
}

function headstockShape() {
  const s = new THREE.Shape();
  s.moveTo(-2.15, NUT_Y);
  s.lineTo(2.15, NUT_Y);
  s.bezierCurveTo(2.6, 77.6, 3.6, 78.8, 3.5, 80.6);
  s.bezierCurveTo(3.4, 82.6, 2.3, 84.0, 2.4, 86.2);
  s.bezierCurveTo(2.5, 89.0, 3.6, 91.2, 3.4, 93.6);
  s.bezierCurveTo(3.2, 96.6, 0.6, 97.6, -1.4, 97.0);
  s.bezierCurveTo(-3.2, 96.4, -4.4, 95.0, -4.3, 93.2);
  s.lineTo(-3.9, 80.4);
  s.bezierCurveTo(-3.8, 78.6, -3.0, 77.0, -2.15, NUT_Y);
  return s;
}

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Map extruded UVs to the shape's bounding box so textures land once across the part. */
function fitUVs(geo: THREE.BufferGeometry) {
  geo.computeBoundingBox();
  const b = geo.boundingBox!;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - b.min.x) / (b.max.x - b.min.x), (pos.getY(i) - b.min.y) / (b.max.y - b.min.y));
  }
  uv.needsUpdate = true;
  return geo;
}

const neckHalfWidth = (y: number) => {
  const t = (y - 29.6) / (NUT_Y - 29.6);
  return 2.8 + (2.15 - 2.8) * t;
};

export function createGuitar(fonts: { serif: string }) {
  const g = new THREE.Group();
  g.name = 'guitar';

  const chrome = new THREE.MeshStandardMaterial({ color: 0xe6e6e6, metalness: 1, roughness: 0.16 });
  const nickel = new THREE.MeshStandardMaterial({ color: 0xd8d2c6, metalness: 1, roughness: 0.3 });
  const cream = new THREE.MeshPhysicalMaterial({ color: 0xede4d0, roughness: 0.38, clearcoat: 0.3 });
  const guard = new THREE.MeshPhysicalMaterial({ color: 0xd6cfc2, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.2 });
  const wood = new THREE.MeshPhysicalMaterial({ map: ashBody(), color: 0xb9a588, roughness: 0.52, clearcoat: 0.25, clearcoatRoughness: 0.38 });
  const mapleTex = maple();
  const neckMat = new THREE.MeshPhysicalMaterial({ map: mapleTex, roughness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.25 });

  // body
  const body = new THREE.Mesh(
    fitUVs(
      new THREE.ExtrudeGeometry(bodyShape(), {
        depth: 3.6,
        bevelEnabled: true,
        bevelThickness: 0.45,
        bevelSize: 0.55,
        bevelSegments: 5,
        curveSegments: 28,
      }),
    ),
    wood,
  );
  g.add(body);

  // pickguard
  const pg = new THREE.Mesh(
    new THREE.ExtrudeGeometry(pickguardShape(), { depth: 0.18, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.06, bevelSegments: 2, curveSegments: 20 }),
    guard,
  );
  pg.position.z = BODY_FRONT + 0.02;
  g.add(pg);
  const guardTop = BODY_FRONT + 0.26;

  // neck and headstock
  const neckShape = new THREE.Shape();
  neckShape.moveTo(-2.8, 29.6);
  neckShape.lineTo(2.8, 29.6);
  neckShape.lineTo(2.15, NUT_Y);
  neckShape.lineTo(-2.15, NUT_Y);
  neckShape.closePath();
  const neck = new THREE.Mesh(
    fitUVs(new THREE.ExtrudeGeometry(neckShape, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.3, bevelSegments: 4 })),
    neckMat,
  );
  neck.position.z = NECK_FRONT - 1.6 - 0.35;
  g.add(neck);

  const head = new THREE.Mesh(
    fitUVs(new THREE.ExtrudeGeometry(headstockShape(), { depth: 1.1, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 3, curveSegments: 24 })),
    neckMat,
  );
  head.position.z = NECK_FRONT - 0.45 - 1.1 - 0.2;
  g.add(head);
  const headFront = NECK_FRONT - 0.45;

  // headstock decal: his name instead of a brand
  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 1.45),
    new THREE.MeshStandardMaterial({
      map: decal('SHEZ', `italic 120px ${fonts.serif}`, '#d6b25e'),
      transparent: true,
      metalness: 0.6,
      roughness: 0.35,
    }),
  );
  logo.position.set(0.9, 88.2, headFront + 0.02);
  logo.rotation.z = Math.PI / 2 - 0.08;
  g.add(logo);

  // nut
  const nut = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.45, 0.42), cream);
  nut.position.set(0, NUT_Y - 0.2, NECK_FRONT + 0.15);
  g.add(nut);

  // frets and dots
  const frets: THREE.BufferGeometry[] = [];
  const dots: THREE.BufferGeometry[] = [];
  const fretY = (n: number) => NUT_Y - SCALE * (1 - Math.pow(2, -n / 12));
  for (let n = 1; n <= 21; n++) {
    const y = fretY(n);
    const w = neckHalfWidth(y) * 2 - 0.2;
    const f = new THREE.CylinderGeometry(0.07, 0.07, w, 6);
    f.rotateZ(Math.PI / 2);
    f.translate(0, y, NECK_FRONT + 0.02);
    frets.push(f);
  }
  for (const n of [3, 5, 7, 9, 12, 15, 17, 19, 21]) {
    const y = (fretY(n) + fretY(n - 1)) / 2;
    const xs = n === 12 ? [-0.9, 0.9] : [0];
    for (const x of xs) {
      const d = new THREE.CircleGeometry(0.3, 16);
      d.translate(x, y, NECK_FRONT + 0.01);
      dots.push(d);
    }
  }
  g.add(new THREE.Mesh(mergeGeometries(frets), nickel));
  g.add(new THREE.Mesh(mergeGeometries(dots), new THREE.MeshStandardMaterial({ color: 0x1b1410, roughness: 0.6 })));

  // pickups with pole pieces
  const pickupGeo = new THREE.ExtrudeGeometry(roundedRect(8.3, 1.8, 0.9), { depth: 0.55, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 3 });
  const poles: THREE.BufferGeometry[] = [];
  for (const [y, rot, x] of [
    [26.9, 0, 0],
    [20.6, 0, 0],
    [14.9, -0.17, 0.2],
  ] as const) {
    const p = new THREE.Mesh(pickupGeo, cream);
    p.position.set(x, y, guardTop);
    p.rotation.z = rot;
    g.add(p);
    for (let i = 0; i < 6; i++) {
      const pole = new THREE.CylinderGeometry(0.22, 0.22, 0.1, 10);
      pole.rotateX(Math.PI / 2);
      const px = -2.6 + i * 1.04;
      pole.translate(px * Math.cos(rot) + x, y + px * Math.sin(rot), guardTop + 0.72);
      poles.push(pole);
    }
  }

  // bridge, saddles, knobs, switch, jack
  const metal: THREE.BufferGeometry[] = [...poles];
  const plate = new THREE.BoxGeometry(8.6, 3.8, 0.25);
  plate.translate(0, 10.2, BODY_FRONT + 0.12);
  metal.push(plate);
  for (let i = 0; i < 6; i++) {
    const sdl = new THREE.BoxGeometry(0.88, 1.5, 0.9);
    sdl.translate(-2.6 + i * 1.04, SADDLE_Y, BODY_FRONT + 0.7);
    metal.push(sdl);
  }
  const jack = new THREE.CylinderGeometry(1.0, 1.0, 0.4, 24);
  jack.rotateX(Math.PI / 2);
  jack.scale(1, 1.5, 1);
  jack.translate(12.6, 4.8, BODY_FRONT + 0.1);
  metal.push(jack);
  g.add(new THREE.Mesh(mergeGeometries(metal), chrome));

  const knobs: THREE.BufferGeometry[] = [];
  for (const [x, y] of [
    [6.9, 14.6],
    [9.4, 12.1],
    [11.6, 10.3],
  ]) {
    const k = new THREE.CylinderGeometry(0.95, 1.08, 1.5, 28);
    k.rotateX(Math.PI / 2);
    k.translate(x, y, guardTop + 0.75);
    knobs.push(k);
  }
  const tip = new THREE.CapsuleGeometry(0.32, 0.6, 4, 10);
  tip.rotateX(Math.PI / 2 - 0.4);
  tip.translate(7.8, 18.6, guardTop + 0.9);
  knobs.push(tip);
  g.add(new THREE.Mesh(mergeGeometries(knobs), cream));

  // tuners: posts on the front, keys sticking out on the bass side
  const tuners: THREE.BufferGeometry[] = [];
  const postY = (i: number) => 81.0 + i * 2.4;
  for (let i = 0; i < 6; i++) {
    const post = new THREE.CylinderGeometry(0.34, 0.38, 1.1, 14);
    post.rotateX(Math.PI / 2);
    post.translate(-2.4, postY(i), headFront + 0.5);
    tuners.push(post);
    const key = new THREE.SphereGeometry(0.75, 14, 10);
    key.scale(1.25, 0.75, 0.35);
    key.translate(-5.4, postY(i), headFront - 1.0);
    tuners.push(key);
    const shaft = new THREE.CylinderGeometry(0.14, 0.14, 1.6, 8);
    shaft.rotateZ(Math.PI / 2);
    shaft.translate(-4.4, postY(i), headFront - 1.0);
    tuners.push(shaft);
  }
  g.add(new THREE.Mesh(mergeGeometries(tuners), chrome));

  // strings: saddle to nut, then nut to the tuner post
  const strings: THREE.BufferGeometry[] = [];
  const stringZ = NECK_FRONT + 0.32;
  for (let i = 0; i < 6; i++) {
    const r = 0.055 - i * 0.006;
    const a = new THREE.Vector3(-2.6 + i * 1.04, SADDLE_Y, stringZ + 0.05);
    const b = new THREE.Vector3(-1.75 + i * 0.7, NUT_Y, stringZ);
    const c = new THREE.Vector3(-2.4, postY(i), headFront + 0.9);
    for (const [p, q] of [
      [a, b],
      [b, c],
    ]) {
      const len = p.distanceTo(q);
      const s = new THREE.CylinderGeometry(r, r, len, 5, 1);
      const mid = p.clone().add(q).multiplyScalar(0.5);
      const dir = q.clone().sub(p).normalize();
      s.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
      s.translate(mid.x, mid.y, mid.z);
      strings.push(s);
    }
  }
  // strings get their own material and a name, so the scene can make them ring when tapped
  const stringSet = new THREE.Mesh(mergeGeometries(strings), nickel.clone());
  stringSet.name = 'strings';
  g.add(stringSet);

  g.scale.setScalar(CM);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

/** Black A-frame stand with rubber cradles, holding the guitar leaning back. */
export function createGuitarStand() {
  const g = new THREE.Group();
  g.name = 'guitar-stand';
  const metal = new THREE.MeshStandardMaterial({ color: 0x141414, metalness: 0.65, roughness: 0.42 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.92 });
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const tube = (pts: THREE.Vector3[], r: number, mat: THREE.Material, seg = 24) => {
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 10, false), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const hinge = v(0, 0.3, -0.02);
  const top = v(0, 0.86, -0.08);
  tube([hinge, top], 0.009, metal, 8);
  tube([hinge, v(-0.17, 0.012, 0.13)], 0.009, metal, 8);
  tube([hinge, v(0.17, 0.012, 0.13)], 0.009, metal, 8);
  tube([hinge, v(0, 0.012, -0.3)], 0.009, metal, 8);
  for (const s of [-1, 1]) {
    const from = hinge.clone().lerp(v(0.17 * s, 0.012, 0.13), 0.42);
    tube([from, v(0.1 * s, 0.205, 0.15)], 0.008, metal, 8);
    tube([v(0.1 * s, 0.205, 0.105), v(0.1 * s, 0.218, 0.17)], 0.014, rubber, 6);
    // feet
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), rubber);
    foot.position.set(0.17 * s, 0.012, 0.13);
    g.add(foot);
  }
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), rubber);
  back.position.set(0, 0.012, -0.3);
  g.add(back);
  // neck yoke
  tube([v(-0.034, 0.9, -0.08), v(-0.03, 0.865, -0.08), v(0, 0.852, -0.08), v(0.03, 0.865, -0.08), v(0.034, 0.9, -0.08)], 0.011, rubber, 20);
  return g;
}

/** Places the guitar on the stand: bottom on the cradle, neck in the yoke. */
export function mountGuitar(stand: THREE.Group, guitar: THREE.Group) {
  guitar.rotation.x = -0.37;
  guitar.position.set(0, 0.215, 0.12);
  stand.add(guitar);
}
