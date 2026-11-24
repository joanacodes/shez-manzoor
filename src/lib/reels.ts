/**
 * His showreels: every MP4 in public/reels (made by scripts/prepare-reels.mjs), with the still
 * of the same name. A reel named after a film or series ("we-are-lady-parts.mp4") takes its
 * title, role and channels from it, and the reels come in the order of the credits.
 * The still is cut to the film's picture, without the black bands of a widescreen film, so its
 * shape is the shape the players give the reel (they crop the bands off the video to match).
 */
import fs from 'node:fs';
import path from 'node:path';
import { tvChannels, work } from '../data/work';
import { href } from './url';

export type Reel = {
  /** the file name without .mp4, which is also the film's or series' id when it is one */
  id: string;
  title: string;
  /** "Composer · Original songs" */
  role?: string;
  /** "Channel 4 · Peacock" */
  where?: string;
  /** paths from the root of the site, for links (through href) and structured data (through absolute) */
  path: string;
  stillPath?: string;
  /** the same, ready for a link */
  video: string;
  still?: string;
  /** in seconds, read from the file */
  duration?: number;
  /** width / height of the film's picture: the still's shape, 16 / 9 without a still */
  aspect: number;
};

/** The day the reels were added to the site, for search engines. */
export const reelsAdded = '2026-11-24';

const dir = path.join(process.cwd(), 'public', 'reels');
const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
const squash = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');

/** The length of an MP4, from its header (the mvhd box inside moov). */
function mp4Duration(file: string): number | undefined {
  let fd: number | undefined;
  try {
    fd = fs.openSync(file, 'r');
    const read = (at: number, length: number) => {
      const b = Buffer.alloc(length);
      fs.readSync(fd!, b, 0, length, at);
      return b;
    };
    // the first box of a type between two offsets: where its content starts, and its length
    const find = (type: string, from: number, to: number): [number, number] | undefined => {
      for (let at = from; at + 8 <= to; ) {
        const h = read(at, 16);
        let size = h.readUInt32BE(0);
        let header = 8;
        if (size === 1) {
          size = Number(h.readBigUInt64BE(8));
          header = 16;
        } else if (size === 0) size = to - at;
        if (size < header) return undefined;
        if (h.toString('latin1', 4, 8) === type) return [at + header, size - header];
        at += size;
      }
      return undefined;
    };
    const moov = find('moov', 0, fs.fstatSync(fd).size);
    const mvhd = moov && find('mvhd', moov[0], moov[0] + moov[1]);
    if (!mvhd) return undefined;
    const b = read(mvhd[0], 32);
    const v1 = b[0] === 1;
    const scale = v1 ? b.readUInt32BE(20) : b.readUInt32BE(12);
    const units = v1 ? Number(b.readBigUInt64BE(24)) : b.readUInt32BE(16);
    return scale ? units / scale : undefined;
  } catch {
    return undefined;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/** The width and height of a JPEG, from its header (the start-of-frame marker). */
function jpegSize(file: string): { width: number; height: number } | undefined {
  try {
    const b = fs.readFileSync(file);
    for (let at = 2; at + 9 < b.length; ) {
      if (b[at] !== 0xff) return undefined;
      const marker = b[at + 1];
      // SOF0 to SOF15, except DHT (C4), JPG (C8) and DAC (CC)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: b.readUInt16BE(at + 5), width: b.readUInt16BE(at + 7) };
      at += 2 + b.readUInt16BE(at + 2);
    }
  } catch {
    /* no still */
  }
  return undefined;
}

/** "4:18" */
export const clock = (seconds?: number) => {
  if (!seconds) return '';
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
/** "PT4M18S", for structured data */
export const isoDuration = (seconds?: number) => {
  if (!seconds) return undefined;
  const s = Math.round(seconds);
  return `PT${Math.floor(s / 60)}M${s % 60}S`;
};

const shapeOf = (still?: string) => {
  const size = still && /\.jpe?g$/i.test(still) ? jpegSize(path.join(dir, still)) : undefined;
  return size ? Math.round((size.width / size.height) * 1e4) / 1e4 : 16 / 9;
};

let cache: Reel[] | undefined;
export function reels(): Reel[] {
  if (cache) return cache;
  const order = (id: string) => {
    const i = tvChannels.findIndex((c) => c.id === id);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  cache = files
    .filter((f) => /\.mp4$/i.test(f))
    .map((file) => {
      const id = file.replace(/\.mp4$/i, '');
      const w = work.find((x) => x.id === id) ?? work.find((x) => squash(id).includes(squash(x.id)) || squash(id).includes(squash(x.title)));
      const still = files.find((f) => f.replace(/\.[^.]+$/, '') === id && /\.(jpe?g|webp|png)$/i.test(f));
      const filePath = `/reels/${encodeURIComponent(file)}`;
      const stillPath = still ? `/reels/${encodeURIComponent(still)}` : undefined;
      return {
        id: w?.id ?? id,
        title: w?.title ?? id.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
        role: w?.role,
        where: w?.artist,
        path: filePath,
        stillPath,
        video: href(filePath),
        still: stillPath ? href(stillPath) : undefined,
        duration: mp4Duration(path.join(dir, file)),
        aspect: shapeOf(still),
      };
    })
    .sort((a, b) => order(a.id) - order(b.id) || a.id.localeCompare(b.id));
  return cache;
}

/** The reel of a film or series, when there is one. */
export const reelFor = (id: string) => reels().find((r) => r.id === id);
