/**
 * Procedural textures drawn on canvas: nothing to download, sharp at any size.
 */
import * as THREE from 'three';

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

let seed = 7;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const range = (a: number, b: number) => a + rand() * (b - a);

function canvas(w: number, h: number, draw: Draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  return c;
}

function texture(c: HTMLCanvasElement, { color = true, repeat = [1, 1] as [number, number] } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  return t;
}

/** Natural ash, the finish of his own Stratocaster: pale gold with bold grain. */
export function ashBody() {
  seed = 11;
  return texture(
    canvas(1024, 1024, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#e6c48f');
      g.addColorStop(0.5, '#dcb47c');
      g.addColorStop(1, '#d4a96f');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // long grain lines with cathedral arches in the middle
      for (let k = 0; k < 120; k++) {
        const x0 = range(-0.1, 1.1) * w;
        const amp = range(4, 26);
        const freq = range(0.002, 0.008);
        const phase = range(0, 6.28);
        const arch = Math.abs(x0 - w / 2) < w * 0.22 ? range(0.0002, 0.0007) : 0;
        ctx.beginPath();
        for (let y = -20; y <= h + 20; y += 8) {
          const x = x0 + Math.sin(y * freq + phase) * amp + arch * (y - h * 0.55) ** 2 * Math.sign(x0 - w / 2);
          if (y === -20) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${Math.round(range(120, 160))},${Math.round(range(76, 98))},${Math.round(range(38, 52))},${range(0.12, 0.42)})`;
        ctx.lineWidth = range(0.8, 4.5);
        ctx.stroke();
      }
      // pores
      for (let i = 0; i < 9000; i++) {
        ctx.fillStyle = `rgba(110,70,35,${range(0.04, 0.16)})`;
        ctx.fillRect(range(0, w), range(0, h), 1, range(2, 7));
      }
    }),
  );
}

/** Maple neck: lighter and finer than the body. */
export function maple() {
  seed = 23;
  return texture(
    canvas(512, 1024, (ctx, w, h) => {
      ctx.fillStyle = '#e8c98f';
      ctx.fillRect(0, 0, w, h);
      for (let k = 0; k < 70; k++) {
        const x0 = range(0, w);
        ctx.beginPath();
        for (let y = 0; y <= h; y += 16) {
          const x = x0 + Math.sin(y * 0.01 + k) * 3;
          if (y === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(170,120,60,${range(0.05, 0.18)})`;
        ctx.lineWidth = range(0.5, 2);
        ctx.stroke();
      }
    }),
  );
}

/** Walnut veneer for the old TV cabinet and the side table. */
export function walnut() {
  seed = 31;
  return texture(
    canvas(1024, 512, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#5a3720');
      g.addColorStop(1, '#4a2c19');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let k = 0; k < 140; k++) {
        const y0 = range(0, h);
        ctx.beginPath();
        for (let x = 0; x <= w; x += 10) {
          const y = y0 + Math.sin(x * range(0.004, 0.012) + k) * range(2, 10);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${Math.round(range(20, 45))},${Math.round(range(10, 25))},5,${range(0.15, 0.5)})`;
        ctx.lineWidth = range(0.6, 3);
        ctx.stroke();
      }
    }),
  );
}

/** Worn black stage boards, with a matching roughness map. */
export function stageBoards() {
  seed = 41;
  const planks = 14;
  const color = canvas(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#0d0b0a';
    ctx.fillRect(0, 0, w, h);
    const pw = w / planks;
    for (let i = 0; i < planks; i++) {
      let y = -range(0, h);
      while (y < h) {
        const len = range(h * 0.45, h * 1.2);
        const tone = Math.round(range(14, 30));
        ctx.fillStyle = `rgb(${tone + 4},${tone},${tone - 2})`;
        ctx.fillRect(i * pw + 1.5, y + 1.5, pw - 3, len - 3);
        // grain
        for (let k = 0; k < 8; k++) {
          ctx.fillStyle = `rgba(255,240,220,${range(0.01, 0.035)})`;
          ctx.fillRect(i * pw + range(2, pw - 4), y, range(0.6, 1.6), len);
        }
        y += len;
      }
    }
    // scuffs and gaffer marks of past shows
    for (let i = 0; i < 260; i++) {
      ctx.strokeStyle = `rgba(200,190,180,${range(0.02, 0.07)})`;
      ctx.lineWidth = range(0.5, 2);
      ctx.beginPath();
      const x = range(0, w), y = range(0, h);
      ctx.moveTo(x, y);
      ctx.lineTo(x + range(-40, 40), y + range(-12, 12));
      ctx.stroke();
    }
  });
  const rough = canvas(512, 512, (ctx, w, h) => {
    ctx.fillStyle = 'rgb(150,150,150)';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) {
      const v = Math.round(range(110, 230));
      ctx.fillStyle = `rgba(${v},${v},${v},0.35)`;
      ctx.fillRect(range(0, w), range(0, h), range(1, 30), range(1, 3));
    }
  });
  return { map: texture(color, { repeat: [5, 5] }), roughness: texture(rough, { color: false, repeat: [5, 5] }) };
}

/** Diamond wire mesh for the microphone grille, used as an alpha map. */
export function grille() {
  const t = texture(
    canvas(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#000';
      const n = 16;
      const s = w / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          ctx.beginPath();
          const cx = i * s + s / 2, cy = j * s + s / 2;
          ctx.moveTo(cx, cy - s * 0.36);
          ctx.lineTo(cx + s * 0.36, cy);
          ctx.lineTo(cx, cy + s * 0.36);
          ctx.lineTo(cx - s * 0.36, cy);
          ctx.closePath();
          ctx.fill();
        }
      }
    }),
    { color: false, repeat: [6, 3] },
  );
  return t;
}

/** Fabric for the TV speaker. */
export function speakerCloth() {
  seed = 51;
  return texture(
    canvas(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#1b1712';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 4) {
        ctx.fillStyle = `rgba(120,100,80,${y % 8 ? 0.18 : 0.08})`;
        ctx.fillRect(0, y, w, 2);
      }
      for (let x = 0; x < w; x += 4) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x, 0, 1, h);
      }
    }),
  );
}

/** A setlist gaffer-taped to the floor, written in his song titles. */
export function setlist(titles: string[], fonts: { serif: string; mono: string }) {
  seed = 61;
  return texture(
    canvas(600, 848, (ctx, w, h) => {
      ctx.fillStyle = '#efe9dd';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2400; i++) {
        ctx.fillStyle = `rgba(120,100,80,${range(0.01, 0.05)})`;
        ctx.fillRect(range(0, w), range(0, h), 1, 1);
      }
      // tape
      ctx.fillStyle = 'rgba(20,20,22,0.92)';
      ctx.save();
      ctx.translate(40, 10);
      ctx.rotate(-0.5);
      ctx.fillRect(-60, -10, 150, 40);
      ctx.restore();
      ctx.save();
      ctx.translate(w - 40, 10);
      ctx.rotate(0.5);
      ctx.fillRect(-90, -10, 150, 40);
      ctx.restore();
      ctx.fillStyle = '#16131b';
      ctx.font = `600 34px ${fonts.mono}`;
      ctx.fillText('SHEZ · SET', 60, 120);
      ctx.fillRect(60, 138, w - 120, 4);
      titles.slice(0, 9).forEach((t, i) => {
        ctx.save();
        ctx.translate(64, 210 + i * 68);
        ctx.rotate(range(-0.02, 0.02));
        ctx.font = `italic 50px ${fonts.serif}`;
        ctx.fillStyle = i % 3 === 1 ? '#3b2a7a' : '#16131b';
        ctx.fillText(`${i + 1}. ${t}`, 0, 0);
        ctx.restore();
      });
    }),
    { repeat: [1, 1] },
  );
}

/** Small brand decals: the headstock logo and the TV badge. */
export function decal(text: string, font: string, color: string, w = 512, h = 160) {
  return texture(
    canvas(w, h, (ctx) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, h / 2);
    }),
  );
}
