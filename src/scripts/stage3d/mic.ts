/**
 * A vocal microphone (SM58 style) on a round-base stand, angled towards where
 * the singer stands, with its cable trailing across the stage.
 */
import * as THREE from 'three';
import { grille } from './textures';

export function createMicStand() {
  const g = new THREE.Group();
  g.name = 'mic-stand';
  const black = new THREE.MeshStandardMaterial({ color: 0x121212, metalness: 0.55, roughness: 0.38 });
  const satin = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, metalness: 0.4, roughness: 0.55 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 1, roughness: 0.14 });
  const shadow = (m: THREE.Mesh) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  // weighted round base
  const base = shadow(
    new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0, 0.024),
          new THREE.Vector2(0.11, 0.024),
          new THREE.Vector2(0.14, 0.02),
          new THREE.Vector2(0.15, 0.01),
          new THREE.Vector2(0.149, 0.0),
          new THREE.Vector2(0, 0),
        ],
        64,
      ),
      satin,
    ),
  );
  g.add(base);
  const hub = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.03, 24), black));
  hub.position.y = 0.035;
  g.add(hub);

  // poles and clutch
  const lower = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.95, 20), black));
  lower.position.y = 0.025 + 0.475;
  g.add(lower);
  const clutch = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 24), black));
  clutch.position.y = 0.98;
  g.add(clutch);
  const ring = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.0205, 0.003, 8, 32), chrome));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.0;
  g.add(ring);
  const upper = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.0092, 0.0092, 0.46, 20), chrome));
  upper.position.y = 0.98 + 0.23;
  g.add(upper);

  // clip and microphone, tilted up and towards the singer
  const head = new THREE.Group();
  head.position.set(0, 1.44, 0);
  head.rotation.x = -0.95; // points back towards the singer, slightly up
  g.add(head);
  const clip = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.015, 0.06, 20, 1, true), black));
  clip.position.y = 0.05;
  head.add(clip);
  const joint = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.013, 16, 12), black));
  head.add(joint);

  const handleMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, metalness: 0.35, roughness: 0.45 });
  const handle = shadow(
    new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.0, 0.0),
          new THREE.Vector2(0.0098, 0.0),
          new THREE.Vector2(0.0105, 0.006),
          new THREE.Vector2(0.0112, 0.06),
          new THREE.Vector2(0.0138, 0.128),
          new THREE.Vector2(0.0158, 0.148),
          new THREE.Vector2(0.0172, 0.152),
          new THREE.Vector2(0.0172, 0.158),
          new THREE.Vector2(0.0, 0.158),
        ],
        40,
      ),
      handleMat,
    ),
  );
  handle.position.y = -0.04;
  head.add(handle);
  const band = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.0174, 0.0174, 0.006, 40), chrome));
  band.position.y = 0.115;
  head.add(band);

  // the grille is a real mesh: the alpha map cuts holes, dark foam shows behind
  const foam = new THREE.Mesh(new THREE.SphereGeometry(0.0235, 32, 24), new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 1 }));
  foam.position.y = 0.142;
  foam.scale.set(1, 1.05, 1);
  head.add(foam);
  const mesh = shadow(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.0262, 48, 32),
      new THREE.MeshStandardMaterial({
        color: 0xc9c9cc,
        metalness: 0.95,
        roughness: 0.32,
        alphaMap: grille(),
        alphaTest: 0.5,
        side: THREE.DoubleSide,
      }),
    ),
  );
  mesh.position.y = 0.143;
  mesh.scale.set(1, 1.08, 1);
  head.add(mesh);

  // XLR cable: from the connector, down the stand, then across the floor
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const cable = shadow(
    new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          v(0, 1.42, 0.03),
          v(0.02, 1.36, 0.06),
          v(0.03, 1.2, 0.05),
          v(0.025, 0.9, 0.035),
          v(0.03, 0.5, 0.03),
          v(0.05, 0.12, 0.05),
          v(0.12, 0.006, 0.14),
          v(0.3, 0.006, 0.2),
          v(0.42, 0.006, 0.06),
          v(0.3, 0.006, -0.12),
          v(0.55, 0.006, -0.35),
          v(1.4, 0.006, -0.55),
          v(3.0, 0.006, -0.6),
        ]),
        220,
        0.0038,
        8,
        false,
      ),
      new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.55 }),
    ),
  );
  g.add(cable);
  return g;
}
