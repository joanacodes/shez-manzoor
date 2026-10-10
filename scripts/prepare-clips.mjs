/**
 * Prepares the clips in public/clips for the TV and the cinema. Any video uploaded there
 * (an iPhone screen recording, a .mov, an .mp4…) becomes a small silent MP4: sound removed,
 * black bars and phone screen around the film cropped off, at most 1280 px wide and 30 seconds,
 * with a still (same name, .jpg) for the screens to show before it plays.
 * Clips already prepared are left alone. Needs ffmpeg and ffprobe.
 *
 *   node scripts/prepare-clips.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'public', 'clips');
const VIDEO = /\.(mp4|m4v|mov|webm|mkv|avi|3gp)$/i;
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { maxBuffer: 1 << 30, ...opts });

const slug = (name) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'clip';

function probe(file) {
  const info = JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' }));
  const video = info.streams.find((s) => s.codec_type === 'video');
  return {
    codec: video?.codec_name,
    width: video?.width ?? 0,
    sound: info.streams.some((s) => s.codec_type === 'audio'),
    duration: Number(info.format.duration) || 0,
  };
}

/**
 * Where the film is in the frame, and when. Frames are read small and grey, two a second.
 * A frame's picture is the rows and columns where at least 15% of pixels are lit, which
 * ignores small things like the orange recording dot. Frames without bars (the phone's own
 * screen before or after the film) are trimmed off.
 */
function findPicture(file) {
  const w = 320, h = 180, fps = 2;
  const raw = run('ffmpeg', ['-v', 'error', '-i', file, '-vf', `fps=${fps},scale=${w}:${h},format=gray`, '-f', 'rawvideo', '-']);
  const size = w * h;
  const boxes = [];
  for (let f = 0; f + size <= raw.length; f += size) {
    const px = raw.subarray(f, f + size);
    const lit = (i) => px[i] > 40;
    const cols = [], rows = [];
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let y = 0; y < h; y++) if (lit(y * w + x)) n++;
      if (n > h * 0.15) cols.push(x);
    }
    for (let y = 0; y < h; y++) {
      let n = 0;
      for (let x = 0; x < w; x++) if (lit(y * w + x)) n++;
      if (n > w * 0.15) rows.push(y);
    }
    boxes.push(cols.length && rows.length ? { x0: cols[0], x1: cols.at(-1), y0: rows[0], y1: rows.at(-1) } : null);
  }
  const barred = (b) => b && (b.x1 - b.x0 < w * 0.96 || b.y1 - b.y0 < h * 0.96);
  const film = boxes.map((b, i) => (barred(b) ? i : -1)).filter((i) => i >= 0);
  // no bars anywhere, or only in a few dark frames: keep the whole frame
  if (film.length < boxes.length * 0.4) return null;
  const first = film[0], last = film.at(-1);
  const inside = boxes.slice(first, last + 1).filter(barred);
  const box = {
    x0: Math.min(...inside.map((b) => b.x0)),
    x1: Math.max(...inside.map((b) => b.x1)),
    y0: Math.min(...inside.map((b) => b.y0)),
    y1: Math.max(...inside.map((b) => b.y1)),
  };
  // a pixel inside each edge, as fractions of the frame (ffmpeg works out the real sizes)
  const fx = (v) => (v / w).toFixed(4), fy = (v) => (v / h).toFixed(4);
  return {
    crop: `crop=iw*${fx(box.x1 - box.x0 - 1)}:ih*${fy(box.y1 - box.y0 - 1)}:iw*${fx(box.x0 + 1)}:ih*${fy(box.y0 + 1)}`,
    start: first / fps,
    end: (last + 1) / fps,
  };
}

function prepare(file) {
  const src = path.join(dir, file);
  const out = path.join(dir, `${slug(path.parse(file).name)}.mp4`);
  const info = probe(src);
  const ready = /\.mp4$/i.test(file) && info.codec === 'h264' && !info.sound && info.width <= 1280;
  if (!ready) {
    const picture = findPicture(src);
    const start = picture?.start ?? 0;
    const end = Math.min(picture?.end ?? info.duration, info.duration, start + 30);
    const length = Math.max(1, end - start);
    const filters = [
      picture?.crop,
      "scale='min(1280,iw)':-2:flags=lanczos",
      'fps=30',
      'fade=t=in:st=0:d=0.3',
      `fade=t=out:st=${Math.max(0, length - 0.35).toFixed(2)}:d=0.35`,
      'format=yuv420p',
    ].filter(Boolean);
    const tmp = `${out}.part.mp4`;
    run('ffmpeg', [
      '-v', 'error', '-y',
      '-ss', String(start), '-t', String(length), '-i', src,
      '-an', '-vf', filters.join(','),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-profile:v', 'high', '-level', '4.0',
      '-movflags', '+faststart',
      tmp,
    ]);
    fs.renameSync(tmp, out);
    if (path.resolve(src) !== path.resolve(out)) fs.rmSync(src);
    console.log(`${file} -> ${path.basename(out)} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB${picture ? ', cropped' : ''}, ${length.toFixed(1)} s)`);
  }
  const still = out.replace(/\.mp4$/, '.jpg');
  if (!fs.existsSync(still)) {
    const at = Math.min(1, probe(out).duration / 3);
    run('ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-i', out, '-frames:v', '1', '-vf', "scale='min(1280,iw)':-2", '-q:v', '5', still]);
    console.log(`still: ${path.basename(still)}`);
  }
}

const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => VIDEO.test(f) && !f.endsWith('.part.mp4')).sort() : [];
for (const file of files) {
  try {
    prepare(file);
  } catch (err) {
    console.error(`could not prepare ${file}: ${err.message}`);
    process.exitCode = 1;
  }
}
if (!files.length) console.log('No clips in public/clips');
