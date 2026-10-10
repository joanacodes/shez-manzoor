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
  { term: 'Lady Parts soundtrack', match: /lady parts/i },
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
  const target = path.join(ART_DIR, name);
  if (process.env.REFRESH !== '1') {
    const existing = await fs.stat(target).catch(() => null);
    if (existing?.size) return { file: name, bytes: existing.size, cached: true };
  }
  const buf = await get(url, 'buffer');
  await fs.writeFile(target, buf);
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
        .map((s) => ({ title: s.trackName, number: s.trackNumber, ms: s.trackTimeMillis, appleUrl: s.trackViewUrl, artist: s.artistName, preview: s.previewUrl ?? null }));
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

/* ---------- Releases that are missing from his main Apple profile ---------- */
for (const country of ['gb', 'us']) {
  try {
    const artists = await itunes({ term: 'SHEZ', entity: 'musicArtist', country, limit: '25' });
    log(`\n== Apple artists named SHEZ (${country}): ${artists.map((a) => `${a.artistName} ${a.artistId}`).join(' | ')}`);
    const songs = await itunes({ term: 'SHEZ Freeze', entity: 'song', country, limit: '25' });
    log(`== Apple search "SHEZ Freeze" (${country}):`);
    for (const t of songs) log(`- ${t.releaseDate?.slice(0, 10)} | ${t.trackName} | ${t.artistName} | ${t.collectionName} | ${t.collectionViewUrl?.split('?')[0]}`);
    for (const t of songs.filter((x) => /^freeze/i.test(x.trackName) && /shez/i.test(x.artistName))) {
      if (catalog.releases.some((r) => r.appleId === t.collectionId)) continue;
      const slug = slugify(t.collectionName.replace(/\s*-\s*(single|ep)$/i, ''));
      const entry = {
        slug,
        title: t.collectionName,
        artist: t.artistName,
        appleId: t.collectionId,
        appleUrl: t.collectionViewUrl?.split('?')[0] ?? null,
        releaseDate: t.releaseDate?.slice(0, 10) ?? null,
        trackCount: t.trackCount,
        genre: t.primaryGenreName,
        tracks: [{ title: t.trackName, number: t.trackNumber, ms: t.trackTimeMillis, appleUrl: t.trackViewUrl, artist: t.artistName, preview: t.previewUrl ?? null }],
        artwork: null,
      };
      try {
        entry.artwork = (await save(big(t.artworkUrl100, 1200, 1200), `release-${slug}.jpg`)).file;
      } catch (err) {
        catalog.errors.push(`artwork ${t.collectionName}: ${err.message}`);
      }
      catalog.releases.push(entry);
      log(`  + added ${entry.title} (${entry.releaseDate})`);
    }
  } catch (err) {
    catalog.errors.push(`apple extra ${country}: ${err.message}`);
  }
}

/* ---------- Soundtracks credited to other artists ---------- */
for (const s of SOUNDTRACK_SEARCHES) {
  try {
    const results = [
      ...(await itunes({ term: s.term, entity: 'album', limit: '25', country: 'gb' })),
      ...(await itunes({ term: s.term, entity: 'album', limit: '25', country: 'us' })),
    ];
    log(`\n== Soundtrack search: ${s.term} -> ${results.map((r) => `${r.collectionName} [${r.artistName}]`).slice(0, 12).join(' | ') || 'nothing'}`);
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
      entry.seasonArtwork = [];
      for (const h of hits) {
        const n = (h.collectionName ?? '').match(/season (\d+)/i)?.[1];
        if (!n) continue;
        const file = (await save(big(h.artworkUrl100, 1200, 1200), `screen-${s.slug}-s${n}.jpg`)).file;
        entry.seasonArtwork.push({ season: Number(n), file, date: h.releaseDate?.slice(0, 10) });
      }
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

// albums linked by hand: their covers and tracks come from Spotify's public player
const SPOTIFY_ALBUMS = ['0f5viaGiax7fV9JHS5NO2f', '0b3OOvrBz0WAphEUq5dteb'];
const albumIds = new Set(SPOTIFY_ALBUMS);
const trackIds = new Set();
const scan = (text) => {
  for (const m of text.matchAll(/(?:open\.spotify\.com\/|spotify:)album[/:]([A-Za-z0-9]{22})/g)) albumIds.add(m[1]);
  for (const m of text.matchAll(/(?:open\.spotify\.com\/|spotify:)track[/:]([A-Za-z0-9]{22})/g)) trackIds.add(m[1]);
};
const decodeState = (html) => {
  // Spotify pages carry their data as base64 JSON in script tags
  let out = '';
  for (const m of html.matchAll(/<script[^>]*id="(?:initialState|initial-state|appServerConfig)"[^>]*>([^<]+)<\/script>/g)) {
    try {
      out += Buffer.from(m[1].trim(), 'base64').toString('utf8');
    } catch {}
  }
  for (const m of html.matchAll(/<script[^>]*type="application\/(?:ld\+)?json"[^>]*>([^<]+)<\/script>/g)) out += m[1];
  return out;
};
for (const page of [spotifyUrl, `${spotifyUrl}/discography/all`, `https://open.spotify.com/embed/artist/${SPOTIFY_ARTIST}`]) {
  try {
    const { text } = await get(page, 'text');
    scan(text);
    const state = decodeState(text);
    scan(state);
    const scripts = [...text.matchAll(/<script[^>]*id="([^"]+)"/g)].map((m) => m[1]);
    log(`== Spotify page ${page}: ${text.length} chars, decoded ${state.length} chars, script ids [${scripts.join(', ')}], albums so far ${albumIds.size}, tracks so far ${trackIds.size}`);
  } catch (err) {
    catalog.errors.push(`spotify page ${page}: ${err.message}`);
  }
}
// Each track page names its album and release date
const meta = (html, prop) => html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, 'i'))?.[1] ?? null;
for (const id of [...trackIds].slice(0, 40)) {
  try {
    const { text } = await get(`https://open.spotify.com/track/${id}`, 'text');
    const album = meta(text, 'music:album');
    const date = meta(text, 'music:release_date');
    const desc = meta(text, 'og:description');
    if (album) {
      const albumId = album.match(/album\/([A-Za-z0-9]{22})/)?.[1];
      if (albumId) albumIds.add(albumId);
    }
    catalog.spotify.trackMeta = catalog.spotify.trackMeta ?? {};
    catalog.spotify.trackMeta[id] = { album, date, description: desc };
    log(`  track ${id}: album ${album} | ${date} | ${desc}`);
  } catch (err) {
    catalog.errors.push(`spotify track page ${id}: ${err.message}`);
  }
}
// albums are read further down, once every Apple release is known
for (const id of [...trackIds].slice(0, 40)) {
  try {
    const o = await get(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`);
    catalog.spotify.tracks.push({ id, url: `https://open.spotify.com/track/${id}`, title: o.title, thumbnail: o.thumbnail_url ?? null });
    log(`- track ${id} | ${o.title}`);
  } catch (err) {
    catalog.errors.push(`spotify track ${id}: ${err.message}`);
  }
}

/* ---------- Spotify embed data: names, artists and dates for each track ---------- */
const nextData = (html) => {
  const m = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
};
const findEntity = (obj) => {
  // walk the JSON looking for the object that describes the page's entity
  const stack = [obj];
  while (stack.length) {
    const cur = stack.pop();
    if (cur && typeof cur === 'object') {
      if (cur.entity && typeof cur.entity === 'object') return cur.entity;
      for (const v of Object.values(cur)) stack.push(v);
    }
  }
  return null;
};
try {
  const { text } = await get(`https://open.spotify.com/embed/artist/${SPOTIFY_ARTIST}`, 'text');
  const entity = findEntity(nextData(text));
  const list = entity?.trackList ?? [];
  catalog.spotify.topTracks = list.map((t) => ({ uri: t.uri, title: t.title, subtitle: t.subtitle, ms: t.duration }));
  log(`\n== Spotify top tracks (${list.length}):`);
  for (const t of list) log(`- ${t.uri} | ${t.title} | ${t.subtitle}`);
  if (!list.length) log(`  entity keys: ${entity ? Object.keys(entity).join(', ') : 'none'}`);
} catch (err) {
  catalog.errors.push(`spotify embed artist: ${err.message}`);
}
catalog.spotify.trackInfo = {};
for (const id of [...trackIds].slice(0, 40)) {
  try {
    const { text } = await get(`https://open.spotify.com/embed/track/${id}`, 'text');
    const e = findEntity(nextData(text));
    if (!e) {
      log(`  embed track ${id}: no entity`);
      continue;
    }
    const info = {
      name: e.name ?? e.title,
      artists: (e.artists ?? []).map((a) => a.name),
      releaseDate: e.releaseDate?.isoString?.slice(0, 10) ?? null,
      album: e.albumUri ?? e.album?.uri ?? (String(e.relatedEntityUri ?? '').startsWith('spotify:album:') ? e.relatedEntityUri : null),
      related: e.relatedEntityUri ?? null,
      cover: (e.coverArt?.sources ?? e.visualIdentity?.image ?? []).map((x) => x.url).slice(-1)[0] ?? null,
      keys: Object.keys(e).join(','),
    };
    catalog.spotify.trackInfo[id] = info;
    if (info.album) {
      const albumId = String(info.album).split(':').pop();
      if (/^[A-Za-z0-9]{22}$/.test(albumId)) albumIds.add(albumId);
    }
    log(`  embed track ${id}: ${info.name} | ${info.artists.join(', ')} | ${info.releaseDate} | album ${info.album} | keys ${info.keys}`);
  } catch (err) {
    catalog.errors.push(`spotify embed track ${id}: ${err.message}`);
  }
}
// Covers for the tracks, so features that live on other artists' pages still get artwork
const coverFiles = new Map();
for (const info of Object.values(catalog.spotify.trackInfo)) {
  if (!info.cover) continue;
  if (!coverFiles.has(info.cover)) {
    const name = `spotify-cover-${info.cover.split('/').pop().slice(-12)}.jpg`;
    try {
      await save(info.cover, name);
      coverFiles.set(info.cover, name);
    } catch (err) {
      catalog.errors.push(`spotify cover ${info.cover}: ${err.message}`);
      continue;
    }
  }
  info.coverFile = coverFiles.get(info.cover);
}
// Spotify tracks that are not on his Apple artist pages (features on other artists' records):
// find them on Apple Music too, so every song can be played on both services
const plain = (s) => slugify(String(s).replace(/\(.*?\)|\[.*?\]| - (single|ep)$/gi, ''));
const appleTitles = new Set(catalog.releases.flatMap((r) => [plain(r.title), ...(r.tracks ?? []).map((t) => plain(t.title))]));
catalog.extra = [];
for (const [id, info] of Object.entries(catalog.spotify.trackInfo)) {
  if (appleTitles.has(plain(info.name))) continue;
  try {
    const results = await itunes({ term: `${info.name} ${info.artists[0] ?? ''}`.trim(), entity: 'song', limit: '25' });
    const hit = results.find((r) => plain(r.trackName) === plain(info.name)) ?? results.find((r) => plain(r.trackName).startsWith(plain(info.name).slice(0, 10)));
    const entry = {
      spotifyId: id,
      slug: plain(info.name),
      title: info.name,
      artists: info.artists,
      releaseDate: info.releaseDate,
      spotifyCover: info.coverFile ?? null,
      apple: null,
    };
    if (hit) {
      const art = `release-${plain(info.name)}.jpg`;
      try {
        await save(big(hit.artworkUrl100, 1200, 1200), art);
      } catch (err) {
        catalog.errors.push(`apple art ${info.name}: ${err.message}`);
      }
      entry.apple = {
        trackId: hit.trackId,
        collectionId: hit.collectionId,
        collection: hit.collectionName,
        artist: hit.artistName,
        url: hit.trackViewUrl,
        releaseDate: hit.releaseDate?.slice(0, 10) ?? null,
        ms: hit.trackTimeMillis ?? null,
        genre: hit.primaryGenreName ?? null,
        preview: hit.previewUrl ?? null,
        artwork: art,
      };
    }
    catalog.extra.push(entry);
    log(`- extra ${info.name}: apple ${hit ? hit.trackViewUrl : 'not found'}`);
  } catch (err) {
    catalog.errors.push(`apple search ${info.name}: ${err.message}`);
  }
}
// The albums those songs come from (such as a series soundtrack), with their full track lists
for (const e of catalog.extra) {
  const id = e.apple?.collectionId;
  if (!id || catalog.soundtracks.some((s) => s.appleId === id)) continue;
  try {
    const results = await itunes({ id: String(id), entity: 'song' });
    const album = results.find((r) => r.wrapperType === 'collection');
    if (!album) continue;
    const slug = slugify(album.collectionName);
    const art = `soundtrack-${slug}.jpg`;
    try {
      await save(big(album.artworkUrl100, 1200, 1200), art);
    } catch (err) {
      catalog.errors.push(`soundtrack art ${album.collectionName}: ${err.message}`);
    }
    catalog.soundtracks.push({
      slug,
      title: album.collectionName,
      artist: album.artistName,
      appleId: album.collectionId,
      appleUrl: album.collectionViewUrl?.split('?')[0] ?? null,
      releaseDate: album.releaseDate?.slice(0, 10) ?? null,
      trackCount: album.trackCount,
      genre: album.primaryGenreName ?? null,
      artwork: art,
      tracks: results
        .filter((r) => r.wrapperType === 'track')
        .map((t) => ({
          title: t.trackName,
          number: t.trackNumber,
          disc: t.discNumber,
          ms: t.trackTimeMillis ?? null,
          artist: t.artistName,
          appleUrl: t.trackViewUrl?.split('&uo')[0] ?? null,
          preview: t.previewUrl ?? null,
        })),
    });
    log(`- soundtrack ${album.collectionName}: ${album.trackCount} tracks`);
  } catch (err) {
    catalog.errors.push(`apple album ${id}: ${err.message}`);
  }
}
// The version of the artist page served to search engines may list the discography
try {
  const res = await fetch(spotifyUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' } });
  const html = await res.text();
  const before = albumIds.size;
  for (const m of html.matchAll(/(?:open\.spotify\.com\/|spotify:)album[/:]([A-Za-z0-9]{22})/g)) albumIds.add(m[1]);
  const metas = [...html.matchAll(/<meta[^>]+>/g)].map((m) => m[0]).filter((t) => /music:|og:/.test(t)).slice(0, 25);
  log(`\n== Spotify artist page for crawlers: ${html.length} chars, new albums ${albumIds.size - before}`);
  for (const t of metas) log(`  ${t}`);
} catch (err) {
  catalog.errors.push(`spotify crawler page: ${err.message}`);
}
const sameTitle = (a, b) => {
  const n = (s) =>
    String(s)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+-\s+(single|ep)$/, '')
      .replace(/\((feat\.|with)[^)]*\)/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '');
  return n(a) === n(b);
};
const appleAlbums = [...catalog.releases, ...catalog.soundtracks];
for (const id of [...albumIds].filter((x) => !catalog.spotify.albums.some((a) => a.id === x)).slice(0, 40)) {
  try {
    const o = await get(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/album/${id}`)}`);
    const album = { id, url: `https://open.spotify.com/album/${id}`, title: o.title, thumbnail: o.thumbnail_url ?? null, tracks: [] };
    let cover = o.thumbnail_url ? o.thumbnail_url.replace('ab67616d00001e02', 'ab67616d0000b273') : null;
    try {
      const { text } = await get(`https://open.spotify.com/embed/album/${id}`, 'text');
      const e = findEntity(nextData(text));
      album.title = e?.name ?? e?.title ?? album.title;
      album.artists = String(e?.subtitle ?? '')
        .split(/,\s*/)
        .map((x) => x.trim())
        .filter(Boolean);
      album.tracks = (e?.trackList ?? []).map((t, i) => ({
        uri: t.uri,
        title: t.title,
        ms: t.duration,
        number: i + 1,
        artists: t.subtitle ?? null,
        preview: t.audioPreview?.url ?? null,
      }));
      album.releaseDate = e?.releaseDate?.isoString?.slice(0, 10) ?? null;
      const sources = e?.coverArt?.sources ?? e?.visualIdentity?.image ?? [];
      const largest = [...sources].sort((x, y) => (y.width ?? 0) - (x.width ?? 0))[0];
      if (largest?.url) cover = largest.url;
    } catch (err) {
      catalog.errors.push(`spotify album embed ${id}: ${err.message}`);
    }
    album.totalTracks = album.tracks.length || null;
    album.type = album.tracks.length === 1 ? 'single' : 'album';
    album.group = SPOTIFY_ALBUMS.includes(id) ? 'linked' : 'found';
    album.onApple = appleAlbums.some((r) => sameTitle(r.title, album.title));
    if (cover) {
      try {
        await save(cover, `spotify-album-${id}.jpg`);
        album.coverFile = `spotify-album-${id}.jpg`;
      } catch (err) {
        catalog.errors.push(`spotify album cover ${id}: ${err.message}`);
      }
    }
    catalog.spotify.albums.push(album);
    log(`- album ${id} | ${album.title} | ${album.artists?.join(', ')} | ${album.tracks.length} tracks | ${album.releaseDate} | on Apple: ${album.onApple}`);
  } catch (err) {
    catalog.errors.push(`spotify album ${id}: ${err.message}`);
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

catalog.releases = catalog.releases.filter((r, i, all) => all.findIndex((x) => x.slug === r.slug) === i);
catalog.releases.sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
// Spotify serves the same image from several CDN hosts at random: use its canonical host
const canonical = (text) => text.replace(/https:\/\/image-cdn-[a-z]+\.spotifycdn\.com\/image\//g, 'https://i.scdn.co/image/');
// keep the previous timestamp when nothing else changed, so a quiet run commits nothing
try {
  const previous = JSON.parse(await fs.readFile(OUT, 'utf8'));
  const strip = (c) => canonical(JSON.stringify({ ...c, fetchedAt: null }));
  if (strip(previous) === strip(catalog)) catalog.fetchedAt = previous.fetchedAt;
} catch {
  /* first run */
}
await fs.writeFile(OUT, `${canonical(JSON.stringify(catalog, null, 2))}\n`);
log(`\nSaved ${catalog.releases.length} releases, ${catalog.soundtracks.length} soundtracks, ${catalog.screen.length} screen posters, ${catalog.spotify.albums.length} Spotify albums.`);
if (catalog.errors.length) log(`Errors:\n- ${catalog.errors.join('\n- ')}`);
