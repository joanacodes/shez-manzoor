/**
 * Downloads the clips listed in public/clips/drive.txt from Google Drive: one file ID or
 * share link per line. The files must be shared with "Anyone with the link". Until they are,
 * it keeps trying (WAIT_MINUTES, 120 by default), so the job can start before the sharing
 * changes. Each file lands in public/clips as drive-<id>.<ext>, its line leaves drive.txt,
 * and scripts/prepare-clips.mjs does the rest.
 *
 *   node scripts/fetch-drive-clips.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'public', 'clips');
const list = path.join(dir, 'drive.txt');
if (!fs.existsSync(list)) {
  console.log('No public/clips/drive.txt');
  process.exit(0);
}

const lines = fs.readFileSync(list, 'utf8').split('\n');
const idOf = (line) => (line.trim().startsWith('#') ? null : (line.match(/[-\w]{25,}/)?.[0] ?? null));
const pending = new Set(lines.map(idOf).filter(Boolean));
const deadline = Date.now() + Number(process.env.WAIT_MINUTES ?? 120) * 60_000;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function fetchOne(id) {
  const res = await fetch(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, { redirect: 'follow' });
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || type.startsWith('text/html')) return false; // not shared yet: Google answers with a sign-in page
  const name = /filename="?([^";]+)"?/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? '';
  const ext = (path.extname(name) || '.mov').toLowerCase();
  const file = path.join(dir, `drive-${id}${ext}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log(`${id}: ${name || 'clip'} (${(fs.statSync(file).size / 1e6).toFixed(1)} MB)`);
  return true;
}

let waiting = false;
while (pending.size) {
  for (const id of [...pending]) {
    try {
      if (await fetchOne(id)) pending.delete(id);
    } catch (err) {
      console.log(`${id}: ${err.message}`);
    }
  }
  if (!pending.size || Date.now() > deadline) break;
  if (!waiting) console.log(`Waiting for ${pending.size} file(s) to be shared with "Anyone with the link"…`);
  waiting = true;
  await sleep(30_000);
}

// keep only the lines still to fetch
const left = lines.filter((line) => !idOf(line) || pending.has(idOf(line)));
if (left.some((line) => idOf(line))) fs.writeFileSync(list, left.join('\n'));
else fs.rmSync(list);
// the ones that did arrive are still prepared and published
if (pending.size) console.log(`::warning::Not shared with "Anyone with the link" yet: ${[...pending].join(', ')}`);
