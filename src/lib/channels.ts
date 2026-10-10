/**
 * What plays on the old TV and on the cinema screen: every clip in public/clips (always muted),
 * and nothing else. Films and series without a clip are only in the list of credits.
 * A clip whose file name contains a title ("we-are-lady-parts-2.mp4", "WALP s2.mp4") is
 * linked to that work, for the caption and its "Music and credits" panel.
 */
import fs from 'node:fs';
import path from 'node:path';
import { tvChannels } from '../data/work';
import { href } from './url';

export type ScreenChannel = {
  video: string;
  /** still shown before the clip plays (made by scripts/prepare-clips.mjs) */
  still?: string;
  /** the work it comes from, when its file name says which */
  id?: string;
  title?: string;
  kind?: string;
};

const clipsDir = path.join(process.cwd(), 'public', 'clips');
const files = fs.existsSync(clipsDir) ? fs.readdirSync(clipsDir) : [];
const clips = files.filter((f) => /\.(mp4|m4v|webm|mov)$/i.test(f)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
const stem = (f: string) => f.replace(/\.[^.]+$/, '');
const squash = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');

/** The work a clip comes from: its slug, its title or (four letters or more) its initials in the file name. */
const workFor = (file: string) =>
  tvChannels.find((c) => {
    const initials = c.title
      .split(/\s+/)
      .map((w) => w[0] ?? '')
      .join('');
    const keys = [squash(c.id), squash(c.title), initials.length >= 4 ? squash(initials) : ''].filter(Boolean);
    return keys.some((k) => squash(stem(file)).includes(k));
  });

export function screenChannels(): ScreenChannel[] {
  const all = clips.map((file) => {
    const work = workFor(file);
    const still = files.find((f) => stem(f) === stem(file) && /\.(jpe?g|webp|png)$/i.test(f));
    return {
      video: href(`/clips/${encodeURIComponent(file)}`),
      ...(still ? { still: href(`/clips/${encodeURIComponent(still)}`) } : {}),
      ...(work ? { id: work.id, title: work.title, kind: work.kind } : {}),
    };
  });
  // take turns between works, so the same series does not play twice in a row
  const groups = [...tvChannels.map((c) => all.filter((ch) => ch.id === c.id)), all.filter((ch) => !ch.id)].filter((g) => g.length);
  const out: ScreenChannel[] = [];
  for (let i = 0; out.length < all.length; i++) for (const g of groups) if (g[i]) out.push(g[i]);
  return out;
}
