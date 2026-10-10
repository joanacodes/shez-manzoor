/**
 * Fetches Shez Manzoor's artwork and release information, then saves it into the repo.
 * Runs on GitHub's servers (see .github/workflows/fetch-artwork.yml), because the
 * development environment has no access to these services.
 *
 * Sources: Apple's iTunes Search API and Spotify's public oEmbed and embed pages.
 * No keys or accounts are needed.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ART_DIR = path.join(ROOT, 'src/assets/artwork');
const OUT = path.join(ROOT, 'src/data/catalog.json');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

const APPLE_ARTISTS = [
  { id: '1484492113', name: 'SHEZ' },
  { id: '1477261034', name: 'Shez Manzoor' },
];
const SPOTIFY_ARTIST = '3q8Gg6UErCDwopoXFWQwb4';
const SOUNDCLOUD_SHORT = 'https://on.soundcloud.com/xJEiUCaJ997a3IyLT1';

// Film and TV artwork from the iTunes store
const SCREEN = [
  { slug: 'we-are-lady-parts', term: 'We Are Lady Parts', media: 'tvShow', entity: 'tvSeason', match: /lady parts/i },
  { slug: 'polite-society', term: 'Polite Society', media: 'movie', entity: 'movie', match: /^polite society/i },
  { slug: 'clarksons-farm', term: "Clarkson's Farm", media: 'tvShow', entity: 'tvSeason', match: /clarkson/i },
  { slug: 'bride-or-die', term: 'Bride or Die', media: 'movie', entity: 'movie', match: /bride or die/i },
];
// Soundtrack albums he worked on, credited to other artists
const SOUNDTRACK_SEARCHES = [
  { term: 'We Are Lady Parts', match: /lady parts/i },
  { term: 'Polite Society Original Motion Picture Soundtrack', match: /polite society/i },
];

const log = (...a) => console.log(...a);
const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
const big = (url, w, h) => url.replace(/\/\d+x\d+(bb|cc|sr)?(-\d+)?\.(jpg|jpeg|png|webp)$/i, `/${w}x${h}bb.jpg`);

async function get(url, as = 'json') {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-GB,en;q=0.9' }, redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (as === 'json') return await res.json();
      if (as === 'text') return { text: await res.text(), url: res.url };
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (attempt === 3) throw new Error(`${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

async function save(url, name) {
  const buf = await get(url, 'buffer');
  await fs.writeFile(path.join(ART_DIR, name), buf);
  return { file: name, bytes: buf.length };
}

async function itunes(params) {
  const qs = new URLSearchParams({ country: 'gb', limit: '200', ...params });
  const endpoint = params.id ? 'lookup' : 'search';
  const data = await get(`https://itunes.apple.com/${endpoint}?${qs}`);
  if (data.resultCount === 0 && (params.country ?? 'gb') === 'gb') {
    return itunes({ ...params, country: 'us' });
  }
  return data.results;
}

const catalog = {
  fetchedAt: new Date().toISOString(),
  sources: ['iTunes Search API', 'Spotify oEmbed', 'Spotify public pages'],
  artists: [],
  releases: [],
  soundtracks: [],
  screen: [],
  spotify: { artist: null, albums: [], tracks: [] },
  soundcloud: null,
  errors: [],
};

await fs.mkdir(ART_DIR, { recursive: true });

/* ---------- Apple Music: releases and tracks ---------- */
for (const artist of APPLE_ARTISTS) {
  try {
    const albums = await itunes({ id: artist.id, entity: 'album' });
    const songs = await itunes({ id: artist.id, entity: 'song' });
    const info = albums.find((r) => r.wrapperType === 'artist');
    catalog.artists.push({ name: info?.artistName ?? artist.name, appleId: artist.id, appleUrl: info?.artistLinkUrl ?? null });
    log(`\n== Apple Music: ${info?.artistName ?? artist.name} (${artist.id})`);
    for (const a of albums.filter((r) => r.wrapperType === 'collection')) {
      if (catalog.releases.some((r) => r.appleId === a.collectionId)) continue;
      const tracks = songs
        .filter((s) => s.wrapperType === 'track' && s.collectionId === a.collectionId)
        .sort((x, y) => (x.discNumber - y.discNumber) || (x.trackNumber - y.trackNumber))
        .map((s) => ({ title: s.trackName, number: s.trackNumber, ms: s.trackTimeMillis, appleUrl: s.trackViewUrl, artist: s.artistName }));
      const slug = slugify(a.collectionName.replace(/\s*-\s*(single|ep)$/i, ''));
      const entry = {
        slug,
        title: a.collectionName,
        artist: a.artistName,
        appleArtistId: artist.id,
        appleId: a.collectionId,
        appleUrl: a.collectionViewUrl?.split('?')[0] ?? null,
        releaseDate: a.releaseDate?.slice(0, 10) ?? null,
        trackCount: a.trackCount,
        genre: a.primaryGenreName,
        copyright: a.copyright ?? null,
        tracks,
        artwork: null,
      };
      try {
        entry.artwork = (await save(big(a.artworkUrl100, 1200, 1200), `release-${slug}.jpg`)).file;
      } catch (err) {
        catalog.errors.push(`artwork ${a.collectionName}: ${err.message}`);
      }
      catalog.releases.push(entry);
      log(`- ${entry.releaseDate} | ${entry.title} | ${entry.artist} | ${entry.trackCount} tracks | ${entry.appleUrl} | ${entry.artwork ?? 'no artwork'}`);
      for (const t of tracks) log(`    ${t.number}. ${t.title} (${Math.round((t.ms ?? 0) / 1000)}s)`);
    }
  } catch (err) {
    catalog.errors.push(`apple ${artist.name}: ${err.message}`);
    log(`! ${err.message}`);
  }
}

/* ---------- Soundtracks credited to other artists ---------- */
for (const s of SOUNDTRACK_SEARCHES) {
  try {
    const results = await itunes({ term: s.term, entity: 'album', limit: '25' });
    log(`\n== Soundtrack search: ${s.term}`);
    for (const a of results.filter((r) => s.match.test(r.collectionName))) {
      log(`- ${a.releaseDate?.slice(0, 10)} | ${a.collectionName} | ${a.artistName} | ${a.collectionViewUrl?.split('?')[0]}`);
      if (catalog.releases.some((r) => r.appleId === a.collectionId) || catalog.soundtracks.some((r) => r.appleId === a.collectionId)) continue;
      const slug = slugify(a.collectionName);
      const entry = {
        slug,
        title: a.collectionName,
        artist: a.artistName,
        appleId: a.collectionId,
        appleUrl: a.collectionViewUrl?.split('?')[0] ?? null,
        releaseDate: a.releaseDate?.slice(0, 10) ?? null,
        trackCount: a.trackCount,
        artwork: null,
      };
      try {
        entry.artwork = (await save(big(a.artworkUrl100, 1200, 1200), `soundtrack-${slug}.jpg`)).file;
      } catch (err) {
        catalog.errors.push(`artwork ${a.collectionName}: ${err.message}`);
      }
      catalog.soundtracks.push(entry);
    }
  } catch (err) {
    catalog.errors.push(`soundtrack ${s.term}: ${err.message}`);
  }
}

/* ---------- Film and TV posters ---------- */
for (const s of SCREEN) {
  try {
    const results = await itunes({ term: s.term, media: s.media, entity: s.entity, limit: '25' });
    const names = results.map((r) => r.collectionName ?? r.trackName);
    log(`\n== Screen search: ${s.term} -> ${names.slice(0, 8).join(' | ') || 'nothing'}`);
    const hits = results.filter((r) => s.match.test(r.collectionName ?? r.trackName ?? ''));
    if (!hits.length) continue;
    const pick = hits.sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))[0];
    const isMovie = s.entity === 'movie';
    const url = big(pick.artworkUrl100, isMovie ? 800 : 1200, isMovie ? 1200 : 1200);
    const entry = {
      slug: s.slug,
      title: pick.collectionName ?? pick.trackName,
      releaseDate: pick.releaseDate?.slice(0, 10) ?? null,
      appleUrl: (pick.collectionViewUrl ?? pick.trackViewUrl)?.split('?')[0] ?? null,
      artwork: null,
      seasons: hits.map((h) => ({ title: h.collectionName ?? h.trackName, date: h.releaseDate?.slice(0, 10) })),
    };
    try {
      entry.artwork = (await save(url, `screen-${s.slug}.jpg`)).file;
    } catch (err) {
      catalog.errors.push(`poster ${s.term}: ${err.message}`);
    }
    catalog.screen.push(entry);
    log(`- picked ${entry.title} (${entry.releaseDate}) -> ${entry.artwork}`);
  } catch (err) {
    catalog.errors.push(`screen ${s.term}: ${err.message}`);
  }
}

/* ---------- Spotify ---------- */
const spotifyUrl = `https://open.spotify.com/artist/${SPOTIFY_ARTIST}`;
try {
  const o = await get(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`);
  catalog.spotify.artist = { url: spotifyUrl, title: o.title, image: null };
  if (o.thumbnail_url) catalog.spotify.artist.image = (await save(o.thumbnail_url, 'spotify-artist.jpg')).file;
  log(`\n== Spotify artist: ${o.title} ${o.thumbnail_url ?? ''}`);
} catch (err) {
  catalog.errors.push(`spotify artist: ${err.message}`);
}

const albumIds = new Set();
const trackIds = new Set();
for (const page of [spotifyUrl, `${spotifyUrl}/discography/all`, `https://open.spotify.com/embed/artist/${SPOTIFY_ARTIST}`]) {
  try {
    const { text } = await get(page, 'text');
    for (const m of text.matchAll(/(?:open\.spotify\.com\/|spotify:)album[/:]([A-Za-z0-9]{22})/g)) albumIds.add(m[1]);
    for (const m of text.matchAll(/(?:open\.spotify\.com\/|spotify:)track[/:]([A-Za-z0-9]{22})/g)) trackIds.add(m[1]);
    log(`== Spotify page ${page}: ${text.length} chars, albums so far ${albumIds.size}, tracks so far ${trackIds.size}`);
  } catch (err) {
    catalog.errors.push(`spotify page ${page}: ${err.message}`);
  }
}
for (const id of [...albumIds].slice(0, 40)) {
  try {
    const o = await get(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/album/${id}`)}`);
    catalog.spotify.albums.push({ id, url: `https://open.spotify.com/album/${id}`, title: o.title, thumbnail: o.thumbnail_url ?? null });
    log(`- album ${id} | ${o.title}`);
  } catch (err) {
    catalog.errors.push(`spotify album ${id}: ${err.message}`);
  }
}
for (const id of [...trackIds].slice(0, 40)) {
  try {
    const o = await get(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`);
    catalog.spotify.tracks.push({ id, url: `https://open.spotify.com/track/${id}`, title: o.title, thumbnail: o.thumbnail_url ?? null });
    log(`- track ${id} | ${o.title}`);
  } catch (err) {
    catalog.errors.push(`spotify track ${id}: ${err.message}`);
  }
}

/* ---------- SoundCloud: resolve the short link he shared ---------- */
try {
  const { url } = await get(SOUNDCLOUD_SHORT, 'text');
  catalog.soundcloud = { short: SOUNDCLOUD_SHORT, url: url.split('?')[0] };
  log(`\n== SoundCloud: ${catalog.soundcloud.url}`);
} catch (err) {
  catalog.errors.push(`soundcloud: ${err.message}`);
}

catalog.releases.sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
await fs.writeFile(OUT, `${JSON.stringify(catalog, null, 2)}\n`);
log(`\nSaved ${catalog.releases.length} releases, ${catalog.soundtracks.length} soundtracks, ${catalog.screen.length} screen posters, ${catalog.spotify.albums.length} Spotify albums.`);
if (catalog.errors.length) log(`Errors:\n- ${catalog.errors.join('\n- ')}`);
