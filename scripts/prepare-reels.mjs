/**
 * Makes his showreels ready for the site. Each line of public/reels/drive.txt is a Google
 * Drive file ID (or share link) and the name to give the reel, for example
 *
 *   1SA5qv4CKKQ78WFP61OwNr8xSzpyDJSFb we-are-lady-parts
 *
 * The file must be shared with "Anyone with the link"; until it is, the script keeps trying
 * (WAIT_MINUTES, 30 by default). It becomes public/reels/<name>.mp4: H.264 and AAC that every
 * browser streams, at most 1280 px wide, sound kept, about 1.5 Mb/s (a four-minute reel is
 * under 50 MB), plus a still, <name>.jpg, for the player to show before it plays: a colourful,
 * well-lit moment, cut to the film's picture when the reel has black bands above and below it
 * (the site gives the player the still's shape). A still made by hand is kept. Its line then
 * leaves drive.txt. Needs ffmpeg and ffprobe.
 *
 *   node scripts/prepare-reels.mjs
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const dir = path.join(process.cwd(), 'public', 'reels');
const list = path.join(dir, 'drive.txt');
if (!fs.existsSync(list)) {
  console.log('No public/reels/drive.txt');
  process.exit(0);
}
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'reels-'));
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const lines = fs.readFileSync(list, 'utf8').split('\n');
const entryOf = (line) => {
  if (line.trim().startsWith('#')) return null;
  const id = line.match(/[-\w]{25,}/)?.[0];
  if (!id) return null;
  const name = line.replace(/\S*[-\w]{25,}\S*/, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { id, name: name || `reel-${id.slice(0, 8)}` };
};
const pending = new Map(lines.map(entryOf).filter(Boolean).map((e) => [e.id, e]));
// a reel that could not be made stays on the list, for the next run
const failed = new Set();

/** The original from Drive, saved to a temporary folder; false while it is not shared yet. */
async function download({ id, name }) {
  const res = await fetch(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, { redirect: 'follow' });
  // not shared yet: Google answers with a sign-in page
  if (!res.ok || (res.headers.get('content-type') ?? '').startsWith('text/html')) return false;
  const file = path.join(work, `${name}.source`);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(file));
  console.log(`${name}: downloaded ${(fs.statSync(file).size / 1e6).toFixed(1)} MB`);
  return file;
}

function encode(src, name) {
  const out = path.join(dir, `${name}.mp4`);
  const tmp = path.join(work, `${name}.mp4`);
  const log = path.join(work, name);
  const video = [
    '-vf', "scale='min(1280,iw)':-2:flags=lanczos,format=yuv420p",
    '-c:v', 'libx264', '-preset', 'slow', '-tune', 'film', '-profile:v', 'high', '-level', '4.0',
    // two passes at an average of 1.35 Mb/s, never more than twice that
    '-b:v', '1350k', '-maxrate', '2700k', '-bufsize', '5400k',
    // a keyframe every 4 seconds, so a jump along the timeline starts playing at once
    '-force_key_frames', 'expr:gte(t,n_forced*4)',
    '-passlogfile', log,
  ];
  run('ffmpeg', ['-v', 'error', '-y', '-i', src, ...video, '-pass', '1', '-an', '-f', 'null', os.devNull]);
  run('ffmpeg', ['-v', 'error', '-y', '-i', src, ...video, '-pass', '2', '-c:a', 'aac', '-b:a', '160k', '-ac', '2', '-movflags', '+faststart', tmp]);
  fs.copyFileSync(tmp, out);
  console.log(`${name}.mp4: ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);

  const still = path.join(dir, `${name}.jpg`);
  if (!fs.existsSync(still)) {
    const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], { encoding: 'utf8' })) || 0;
    const crop = picture(out);
    const at = bestMoment(out, duration, crop);
    run('ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-i', out, '-frames:v', '1', ...(crop ? ['-vf', crop] : []), '-q:v', '3', still]);
    console.log(`${name}.jpg: still at ${at.toFixed(1)} s${crop ? `, ${crop}` : ''}`);
  }
}

/** The film's picture inside black bands, as an ffmpeg crop (the one found most often, a frame a second), or null. */
function picture(file) {
  const res = spawnText(['-i', file, '-vf', 'fps=1,cropdetect=limit=24:round=2:reset=1', '-an', '-f', 'null', '-']);
  const counts = new Map();
  for (const m of res.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)) counts.set(m[0], (counts.get(m[0]) ?? 0) + 1);
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', file], { encoding: 'utf8' })).streams[0];
  const [, w, h] = best?.match(/crop=(\d+):(\d+)/) ?? [];
  // only bands across the whole width, and a picture of at least half the height
  if (!best || Number(w) !== info.width || Number(h) >= info.height || Number(h) < info.height / 2) return null;
  return best;
}

/** The most colourful well-lit moment, from frames between 15% and 85% of the reel. */
function bestMoment(file, duration, crop) {
  const from = duration * 0.15;
  const step = Math.max(1, (duration * 0.7) / 48);
  const res = spawnText(['-ss', String(from), '-t', String(duration * 0.7), '-i', file, '-vf', `fps=1/${step},${crop ? `${crop},` : ''}signalstats,metadata=print:file=-`, '-an', '-f', 'null', '-']);
  let best = { at: duration / 3, score: -1 };
  let at = 0, y = 0;
  for (const line of res.split('\n')) {
    const t = /pts_time:([\d.]+)/.exec(line);
    if (t) at = from + Number(t[1]);
    const lum = /YAVG=([\d.]+)/.exec(line);
    if (lum) y = Number(lum[1]);
    const sat = /SATAVG=([\d.]+)/.exec(line);
    // colour counts, darkness does not; a frame that is mostly black or blown out never wins
    if (sat && y > 45 && y < 190) {
      const score = Number(sat[1]) * Math.min(1, y / 110);
      if (score > best.score) best = { at, score };
    }
  }
  return best.at;
}

/** What ffmpeg prints (it writes its log and filter output to stderr and stdout). */
function spawnText(args) {
  const res = spawnSync('ffmpeg', ['-v', 'info', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  return `${res.stdout}\n${res.stderr}`;
}

const deadline = Date.now() + Number(process.env.WAIT_MINUTES ?? 30) * 60_000;
let waiting = false;
while (pending.size) {
  for (const entry of [...pending.values()]) {
    try {
      const src = await download(entry);
      if (!src) continue;
      encode(src, entry.name);
      fs.rmSync(src);
      pending.delete(entry.id);
    } catch (err) {
      console.log(`${entry.name}: ${err.message}`);
      process.exitCode = 1;
      failed.add(entry.id);
      pending.delete(entry.id);
    }
  }
  if (!pending.size || Date.now() > deadline) break;
  if (!waiting) console.log(`Waiting for ${pending.size} file(s) to be shared with "Anyone with the link"…`);
  waiting = true;
  await sleep(30_000);
}

// keep only the lines still to do
const left = lines.filter((line) => !entryOf(line) || pending.has(entryOf(line).id) || failed.has(entryOf(line).id));
if (left.some((line) => entryOf(line))) fs.writeFileSync(list, left.join('\n'));
else fs.rmSync(list);
fs.rmSync(work, { recursive: true, force: true });
if (pending.size) console.log(`::warning::Not shared with "Anyone with the link" yet: ${[...pending.keys()].join(', ')}`);
