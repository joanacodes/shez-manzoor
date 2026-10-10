/**
 * What plays on the old TV and on the cinema screen: his film and TV work, as a clip when
 * one is saved at public/clips/<slug>.mp4 (always played muted), otherwise as its poster.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getImage } from 'astro:assets';
import { tvChannels } from '../data/work';
import { href } from './url';

export type ScreenChannel = { id: string; title: string; kind: string; image?: string; video?: string };

export const clipFor = (id: string) => (fs.existsSync(path.join(process.cwd(), 'public', 'clips', `${id}.mp4`)) ? href(`/clips/${id}.mp4`) : undefined);

export async function screenChannels(width: number): Promise<ScreenChannel[]> {
  const shrink = async (src?: ImageMetadata) => (src ? (await getImage({ src, width, format: 'webp', quality: 74 })).src : undefined);
  const out: ScreenChannel[] = [];
  for (const c of tvChannels) {
    const video = clipFor(c.id);
    out.push({ id: c.id, title: c.title, kind: c.kind, image: await shrink(c.image), video });
    if (c.image2 && !video) out.push({ id: c.id, title: c.title, kind: `${c.kind}, series 1`, image: await shrink(c.image2) });
  }
  return out;
}
