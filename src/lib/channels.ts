/**
 * What plays on the old TV and on the cinema screen: his film and TV work, as a clip when
 * one is saved in public/clips (always played muted), otherwise as its poster.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getImage } from 'astro:assets';
import { tvChannels } from '../data/work';
import { href } from './url';

export type ScreenChannel = { id: string; title: string; kind: string; image?: string; video?: string };

const clipsDir = path.join(process.cwd(), 'public', 'clips');
const clips = fs.existsSync(clipsDir) ? fs.readdirSync(clipsDir).filter((f) => /\.(mp4|m4v|webm|mov)$/i.test(f)) : [];
const squash = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');

/**
 * The clip for a film or series, whatever the file is called: "we-are-lady-parts.mp4",
 * "We Are Lady Parts trailer.mov" and "WALP s2.mp4" all count.
 */
export const clipFor = (id: string, title = id) => {
  const initials = title
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('');
  const keys = [squash(id), squash(title), initials.length >= 4 ? squash(initials) : ''].filter(Boolean);
  const file = clips.find((f) => keys.some((k) => squash(f.replace(/\.[^.]+$/, '')).includes(k)));
  return file ? href(`/clips/${encodeURIComponent(file)}`) : undefined;
};

export async function screenChannels(width: number): Promise<ScreenChannel[]> {
  const shrink = async (src?: ImageMetadata) => (src ? (await getImage({ src, width, format: 'webp', quality: 74 })).src : undefined);
  const out: ScreenChannel[] = [];
  for (const c of tvChannels) {
    const video = clipFor(c.id, c.title);
    out.push({ id: c.id, title: c.title, kind: c.kind, image: await shrink(c.image), video });
    if (c.image2 && !video) out.push({ id: c.id, title: c.title, kind: `${c.kind}, series 1`, image: await shrink(c.image2) });
  }
  return out;
}
