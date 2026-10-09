/// <reference lib="webworker" />
/**
 * Runs the hero scene off the main thread, so the page stays responsive
 * however busy the 3D gets.
 */
import { createScene, dispatch, type Msg, type Scene, type SceneInit } from './scene';

type Init = { type: 'init'; canvas: OffscreenCanvas; init: SceneInit };

const post = (m: unknown) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);
let scene: Scene | null = null;
const queue: Msg[] = [];

self.onmessage = async (e: MessageEvent<Init | Msg>) => {
  const m = e.data;
  if (m.type === 'init') {
    const result = await createScene(m.canvas, m.init, {
      ready: () => post({ type: 'ready' }),
      pluck: (i, s) => post({ type: 'pluck', i, s }),
      lost: () => post({ type: 'lost' }),
    });
    if ('scene' in result) {
      scene = result.scene;
      queue.splice(0).forEach((q) => dispatch(scene!, q));
    } else {
      post({ type: 'failed', reason: result.reason });
    }
    return;
  }
  if (scene) dispatch(scene, m);
  else queue.push(m);
};
