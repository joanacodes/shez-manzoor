/**
 * Everything he has made, as one list for the carousel: his records (from Apple Music and
 * Spotify, see scripts/fetch-artwork.mjs) merged with the film and TV credits and the
 * notes written for the site.
 */
import catalog from './catalog.json';
import { projects, type Project } from './projects';
import { releases } from './releases';
import { links } from './site';

export type Track = { n: number; title: string; length: string; artist?: string; spotify?: string };
export type WorkItem = {
  id: string;
  kind: 'screen' | 'record';
  /** TV series, Feature film, EP, Single, Soundtrack, Guest vocal… */
  category: string;
  title: string;
  artist: string;
  role: string;
  /** ISO date, when known */
  date?: string;
  year: string;
  image?: ImageMetadata;
  /** A second picture, such as the other series' artwork */
  image2?: ImageMetadata;
  imageAlt: string;
  summary: string;
  body: string[];
  facts: { label: string; value: string }[];
  tracks: Track[];
  genre?: string;
  badge?: string;
  /** Internal page with the full story */
  page?: string;
  /** For film and TV: the soundtrack album, when there is one */
  soundtrack?: { title: string; artist: string; date?: string };
  listen: {
    apple?: { url: string; embed: string; height: number };
    spotify?: { url: string; embed?: string; exact: boolean; label?: string };
    soundcloud?: string;
  };
};

type CatalogRelease = (typeof catalog.releases)[number];

const art = import.meta.glob<{ default: ImageMetadata }>('../assets/artwork/*.jpg', { eager: true });
const image = (file?: string | null) => (file ? art[`../assets/artwork/${file}`]?.default : undefined);

const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/ - (single|ep)$/i, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const length = (ms?: number | null) => {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const formatDate = (iso?: string) =>
  iso
    ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : '';

/* ---------- Spotify: track IDs found in his public player ---------- */
type SpotifyInfo = { name: string; artists: string[]; releaseDate: string | null; album?: string | null; coverFile?: string };
const trackInfo = catalog.spotify.trackInfo as Record<string, SpotifyInfo>;
const spotifyByTitle = new Map<string, string>();
for (const [id, info] of Object.entries(trackInfo)) spotifyByTitle.set(plain(info.name), id);
for (const t of catalog.spotify.topTracks ?? []) {
  const id = String(t.uri).split(':').pop()!;
  if (!spotifyByTitle.has(plain(t.title))) spotifyByTitle.set(plain(t.title), id);
}
type SpotifyAlbum = { id: string; url: string; title: string; tracks?: { uri: string; title: string }[] };
const spotifyAlbums = (catalog.spotify.albums ?? []) as SpotifyAlbum[];
for (const a of spotifyAlbums) for (const t of a.tracks ?? []) spotifyByTitle.set(plain(t.title), String(t.uri).split(':').pop()!);

const spotifyTrack = (id: string) => `https://open.spotify.com/track/${id}`;
const spotifyEmbed = (type: 'track' | 'album', id: string) => `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
/** Player for one track, for the play buttons in a tracklist. */
export const spotifyTrackEmbed = (id: string) => spotifyEmbed('track', id);
const spotifySearch = (q: string) => `https://open.spotify.com/search/${encodeURIComponent(q)}`;
/** Apple links without the iTunes tracking parameter */
const tidy = (url: string) => url.replace(/([?&])uo=\d+&?/, '$1').replace(/[?&]$/, '');
const appleEmbed = (url: string) => tidy(url).replace('://music.apple.com/', '://embed.music.apple.com/').replace('://itunes.apple.com/', '://embed.music.apple.com/');

/* ---------- records ---------- */
function cleanTitle(r: CatalogRelease) {
  return r.title
    .replace(/ - (Single|EP)$/i, '')
    .replace(/ \((feat\.|with) [^)]*\)/i, '')
    .replace(/^Our Time EP$/, 'Our Time')
    .replace(/^Miscellany, Vol\. 1$/, 'Miscellany, Vol. 1');
}

function artistLine(r: CatalogRelease) {
  const feat = r.title.match(/\((feat\.[^)]*)\)/i)?.[1];
  return feat ? `${r.artist} ${feat}` : r.artist;
}

function categoryOf(r: CatalogRelease) {
  if (/soundtrack/i.test(r.title) || /soundtrack/i.test(r.genre ?? '')) return 'Soundtrack';
  const own = /^shez$/i.test(r.artist);
  if (!own) return 'Guest vocal';
  if (/\bEP\b/.test(r.title) || (r.trackCount ?? 0) >= 4) return 'EP';
  return 'Single';
}

const curated = new Map(releases.map((r) => [r.slug, r]));
const curatedFor = (slug: string) => curated.get(slug) ?? curated.get(slug.replace(/-ep$/, '')) ?? null;

function spotifyFor(title: string, artist: string, tracks: Track[]): WorkItem['listen']['spotify'] {
  const album = spotifyAlbums.find((a) => plain(a.title) === plain(title));
  if (album) return { url: album.url, embed: spotifyEmbed('album', album.id), exact: true };
  const first = tracks.find((t) => t.spotify);
  if (first) {
    return {
      url: spotifyTrack(first.spotify!),
      embed: spotifyEmbed('track', first.spotify!),
      exact: tracks.length === 1,
      label: tracks.length > 1 ? first.title : undefined,
    };
  }
  return { url: spotifySearch(`${title} ${artist.replace(/ feat\..*$/i, '')}`), exact: false };
}

function recordFrom(r: CatalogRelease): WorkItem {
  const title = cleanTitle(r);
  const category = categoryOf(r);
  const artist = artistLine(r);
  const tracks: Track[] = (r.tracks ?? []).map((t) => ({
    n: t.number,
    title: t.title.replace(/ - Single$/i, ''),
    length: length(t.ms),
    artist: t.artist && t.artist !== r.artist ? t.artist : undefined,
    spotify: spotifyByTitle.get(plain(t.title)),
  }));
  const notes = curatedFor(r.slug);
  const own = category === 'Single' || category === 'EP';
  const single = (r.tracks ?? []).length === 1 ? r.tracks[0] : null;
  const apple = r.appleUrl
    ? single?.appleUrl
      ? { url: tidy(r.appleUrl), embed: appleEmbed(single.appleUrl), height: 175 }
      : { url: tidy(r.appleUrl), embed: appleEmbed(r.appleUrl), height: Math.min(450, 160 + tracks.length * 44) }
    : undefined;
  const summary =
    notes?.summary ??
    (category === 'Guest vocal'
      ? `${title}, a ${r.genre ? `${r.genre.toLowerCase()} ` : ''}single by ${r.artist} featuring SHEZ.`
      : category === 'Soundtrack'
        ? `${title}, by ${r.artist}.`
        : `${title}, ${category === 'EP' ? 'an EP' : 'a single'} by SHEZ${r.genre ? ` (${r.genre})` : ''}.`);
  return {
    id: r.slug,
    kind: 'record',
    category,
    title,
    artist,
    role: own ? 'Written and performed by SHEZ' : category === 'Guest vocal' ? 'Featured artist' : 'Music by Tom Howe and Shez Manzoor',
    date: r.releaseDate ?? undefined,
    year: (r.releaseDate ?? '').slice(0, 4),
    image: image(r.artwork),
    imageAlt: `Cover of ${title} by ${r.artist}`,
    summary,
    body: notes?.body ?? [],
    facts: [
      { label: 'Released', value: formatDate(r.releaseDate ?? undefined) },
      { label: 'Format', value: category === 'Guest vocal' ? 'Single' : category },
      ...(tracks.length > 1 ? [{ label: 'Tracks', value: String(tracks.length) }] : []),
      ...(r.genre ? [{ label: 'Genre', value: r.genre }] : []),
      ...(notes?.label ? [{ label: 'Label', value: notes.label }] : []),
    ],
    tracks,
    genre: r.genre ?? undefined,
    badge: notes?.latest ? 'Latest release' : notes?.label ? `${notes.label} release` : undefined,
    page: notes ? `/music/${notes.slug}/` : undefined,
    listen: { apple, spotify: spotifyFor(title, artist, tracks), soundcloud: links.soundcloud },
  };
}

/** Songs he features on that live on other artists' pages (found through Spotify). */
type Extra = {
  spotifyId: string;
  slug: string;
  title: string;
  artists: string[];
  releaseDate: string | null;
  spotifyCover: string | null;
  apple: null | { url: string; collection: string; artist: string; releaseDate: string | null; ms: number | null; genre: string | null; artwork: string };
};
function extraFrom(e: Extra): WorkItem {
  const artist = e.artists.length > 1 ? `${e.artists.slice(0, -1).join(', ')} & ${e.artists.at(-1)}` : (e.artists[0] ?? '');
  const date = e.releaseDate ?? e.apple?.releaseDate ?? undefined;
  return {
    id: e.slug,
    kind: 'record',
    category: 'Collaboration',
    title: e.title,
    artist,
    role: 'Featured artist',
    date,
    year: (date ?? '').slice(0, 4),
    image: image(e.apple?.artwork) ?? image(e.spotifyCover),
    imageAlt: `Cover of ${e.title}`,
    summary: e.apple?.collection
      ? `A song from ${e.apple.collection.replace(/ - Seasons 1 & 2\)/, ')')}, by ${e.artists.join(', ')}.`
      : `${e.title}, a collaboration between ${e.artists.join(', ')}.`,
    body: [],
    facts: [
      { label: 'Released', value: formatDate(date) },
      { label: 'Artists', value: e.artists.join(', ') },
      ...(e.apple?.genre ? [{ label: 'Genre', value: e.apple.genre }] : []),
    ],
    tracks: [{ n: 1, title: e.title, length: length(e.apple?.ms), spotify: e.spotifyId }],
    listen: {
      apple: e.apple ? { url: tidy(e.apple.url), embed: appleEmbed(e.apple.url), height: 175 } : undefined,
      spotify: { url: spotifyTrack(e.spotifyId), embed: spotifyEmbed('track', e.spotifyId), exact: true },
      soundcloud: links.soundcloud,
    },
  };
}

/* ---------- film and television ---------- */
const screenArt = catalog.screen as { slug: string; artwork: string | null; seasonArtwork?: { season: number; file: string }[] }[];
const soundtrackSlug = 'polite-society-original-motion-picture-soundtrack';

function screenFrom(p: Project): WorkItem {
  const fetched = screenArt.find((s) => s.slug === p.slug);
  const seasons = fetched?.seasonArtwork ?? [];
  const latestSeason = seasons.find((s) => s.season === 2)?.file ?? fetched?.artwork;
  const firstSeason = seasons.find((s) => s.season === 1)?.file;
  const ost =
    p.slug === 'polite-society'
      ? catalog.releases.find((r) => r.slug === soundtrackSlug)
      : (catalog.soundtracks.find((t) => plain(t.title).startsWith(plain(p.title))) as unknown as CatalogRelease | undefined);
  const ostItem = ost ? recordFrom(ost) : undefined;
  return {
    id: p.slug,
    kind: 'screen',
    category: p.kind,
    title: p.title,
    artist: p.where,
    role: p.role,
    date: ost?.releaseDate ?? undefined,
    year: p.years ?? '',
    image: image(latestSeason) ?? ostItem?.image,
    image2: image(firstSeason),
    imageAlt: ost ? `Poster artwork for ${p.title}` : `Artwork for ${p.title}`,
    summary: p.summary,
    body: p.body,
    facts: p.facts,
    tracks: ostItem?.tracks ?? [],
    badge: p.badge,
    page: `/composition/${p.slug}/`,
    soundtrack: ost ? { title: ost.title, artist: ost.artist, date: ost.releaseDate ?? undefined } : undefined,
    listen: ostItem ? ostItem.listen : {},
  };
}

/* ---------- the list ---------- */
const records = catalog.releases.filter((r) => r.slug !== soundtrackSlug).map(recordFrom);
const extras = ((catalog as { extra?: Extra[] }).extra ?? []).filter((e) => !records.some((r) => plain(r.title) === plain(e.title))).map(extraFrom);
const screen = projects.map(screenFrom);

// lead with the highlights, then everything else, newest first
const lead = ['miscellany-vol-1', 'we-are-lady-parts', 'freeze', 'polite-society'];
const rest = [...records, ...extras, ...screen].filter((w) => !lead.includes(w.id));
rest.sort((a, b) => (b.date ?? b.year ?? '').localeCompare(a.date ?? a.year ?? ''));
const all = [...records, ...extras, ...screen];
export const work: WorkItem[] = [...lead.map((id) => all.find((w) => w.id === id)!).filter(Boolean), ...rest];

/** Song titles for the setlist taped to the stage floor. */
export const setlistTitles = ['Freeze', 'Let Go', 'HEY', 'Rhythm Section', 'Our.Time', 'ANTIGONE', 'Come.What.May', '1 Of a Kind', 'Falling'];

/** What the old TV shows: his film and TV work (clips go in public/clips/<slug>.mp4). */
export const tvChannels = screen.map((s) => ({ id: s.id, title: s.title, kind: s.category, image: s.image, image2: s.image2 }));
