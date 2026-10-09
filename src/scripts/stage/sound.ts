/**
 * Plucked strings, synthesised with Karplus-Strong. Off until the visitor turns it on.
 * Artist light: Dmaj9 (soul). Composer light: Dm9 (cinematic).
 */
import type { Mode } from './scene';

const CHORDS: Record<'artist' | 'composer', number[]> = {
  artist: [73.42, 110.0, 164.81, 185.0, 220.0, 277.18],
  composer: [73.42, 110.0, 164.81, 174.61, 220.0, 261.63],
};

export interface Sound {
  play(string: number, strength: number, mode: Mode): void;
  setEnabled(on: boolean): void;
  readonly enabled: boolean;
}

export function createSound(): Sound | null {
  const AC: typeof AudioContext | undefined =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;

  const nav = navigator as Navigator & { audioSession?: { type: string } };
  if (nav.audioSession) {
    try {
      nav.audioSession.type = 'playback';
    } catch {
      /* not supported */
    }
  }

  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0.42;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 3800;
  tone.Q.value = 0.4;
  const dry = ctx.createGain();
  dry.gain.value = 0.82;
  const wet = ctx.createGain();
  wet.gain.value = 0.32;
  const room = ctx.createConvolver();
  room.buffer = impulse(ctx, 2.6, 2.4);
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -14;
  limiter.ratio.value = 6;

  tone.connect(dry).connect(master);
  tone.connect(room).connect(wet).connect(master);
  master.connect(limiter).connect(ctx.destination);

  const cache = new Map<number, AudioBuffer>();
  const voices: AudioBufferSourceNode[] = [];
  let enabled = false;

  function pluckBuffer(freq: number) {
    const hit = cache.get(freq);
    if (hit) return hit;
    const sr = ctx.sampleRate;
    const length = Math.floor(sr * 3);
    const buffer = ctx.createBuffer(1, length, sr);
    const out = buffer.getChannelData(0);
    const period = Math.max(2, Math.round(sr / freq));
    const ring = new Float32Array(period);
    let smooth = 0;
    for (let i = 0; i < period; i++) {
      smooth = smooth * 0.55 + (Math.random() * 2 - 1) * 0.45;
      ring[i] = smooth;
    }
    const decay = freq < 120 ? 0.9975 : 0.9962;
    let idx = 0;
    for (let i = 0; i < length; i++) {
      const next = idx + 1 === period ? 0 : idx + 1;
      const v = ring[idx];
      out[i] = v * (i < 64 ? i / 64 : 1);
      ring[idx] = decay * 0.5 * (v + ring[next]);
      idx = next;
    }
    const tail = Math.floor(sr * 0.4);
    for (let i = 0; i < tail; i++) out[length - tail + i] *= 1 - i / tail;
    cache.set(freq, buffer);
    return buffer;
  }

  return {
    get enabled() {
      return enabled;
    },
    setEnabled(on) {
      enabled = on;
      if (on && ctx.state !== 'running') void ctx.resume();
      if (!on) {
        voices.forEach((v) => {
          try {
            v.stop();
          } catch {
            /* already stopped */
          }
        });
        voices.length = 0;
      }
    },
    play(string, strength, mode) {
      if (!enabled) return;
      if (ctx.state !== 'running') void ctx.resume();
      const chord = CHORDS[mode === 'composer' ? 'composer' : 'artist'];
      const src = ctx.createBufferSource();
      src.buffer = pluckBuffer(chord[string % chord.length]);
      const gain = ctx.createGain();
      gain.gain.value = 0.16 + strength * 0.4;
      src.connect(gain).connect(tone);
      src.start();
      voices.push(src);
      src.onended = () => {
        const i = voices.indexOf(src);
        if (i >= 0) voices.splice(i, 1);
      };
      if (voices.length > 14) {
        try {
          voices.shift()!.stop();
        } catch {
          /* already stopped */
        }
      }
    },
  };
}

function impulse(ctx: BaseAudioContext, seconds: number, decay: number) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return buffer;
}
