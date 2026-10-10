/**
 * Single source of truth for facts about Shez Manzoor.
 * Every page, the structured data and llms.txt read from here.
 * Anything marked TO CONFIRM must be checked with Shez before launch.
 */

export const person = {
  name: 'Shez Manzoor',
  artistName: 'SHEZ',
  location: 'London, United Kingdom',
  origin: 'British-Pakistani',
  /** How he is described everywhere, search included: "film composer" is the term for music written for the screen. */
  roles: ['Music producer', 'Singer-songwriter', 'Film and TV composer'],
  /** One sentence that answers "who is Shez Manzoor?" on its own. */
  oneLiner:
    'Shez Manzoor, also known as SHEZ, is a British-Pakistani music producer, singer-songwriter and film and TV composer based in London, who scored the BAFTA-winning series We Are Lady Parts and releases soul and R&B music as SHEZ.',
  influences: [
    'Soul',
    'R&B',
    'Jazz',
    'Folk',
    'Hip hop',
    'Rock',
    'Electronic',
    'Classical Indian and Pakistani music',
  ],
  collaborators: ['Elaha Soroor', 'anaiis', 'Victoria Port'],
  venues: ['Soho Theatre', 'The Lower Third', 'Notting Hill Arts Club'],
  radio: ['BBC', 'Reprezent Radio', 'Threads Radio'],
} as const;

export const award = {
  name: 'RTS Craft & Design Award',
  year: 2024,
  category: 'Music – Original Score (Scripted)',
  work: 'We Are Lady Parts (Series 2)',
  sharedWith: ['Nida Manzoor', 'Sanya Manzoor', 'Benjamin Fregin'],
  /** Used in schema.org "award" */
  label: 'RTS Craft & Design Award 2024, Music – Original Score (Scripted), We Are Lady Parts',
} as const;

/**
 * Awards, in plain words. Checked in October 2026 against the RTS, Music+Sound Awards and BAFTA
 * listings. We Are Lady Parts won three BAFTA TV Craft Awards in 2022 (writing, costume design and
 * casting), none of them for its music: BAFTA is mentioned as "the BAFTA-winning series", never
 * as his own award.
 * `logo` names an official logo file in src/assets/awards (see the README there).
 */
export const awardsLead = {
  text: 'Composer of the BAFTA-winning series',
  work: 'We Are Lady Parts',
  logo: 'bafta',
} as const;

export const awards = [
  {
    name: 'RTS Craft & Design Awards 2024',
    result: 'Winner',
    category: 'Music – Original Score (Scripted)',
    work: 'We Are Lady Parts, series 2',
    note: 'Shared with Nida Manzoor, Sanya Manzoor and Benjamin Fregin',
    logo: 'rts',
  },
  {
    name: 'Music+Sound Awards 2024',
    result: 'Nominee',
    category: 'Best Original Composition in a Television Programme',
    work: 'We Are Lady Parts, series 2',
    note: '',
    logo: 'music-and-sound',
  },
] as const;

export const links = {
  spotify: 'https://open.spotify.com/artist/3q8Gg6UErCDwopoXFWQwb4',
  spotifyEmbed: 'https://open.spotify.com/embed/artist/3q8Gg6UErCDwopoXFWQwb4?utm_source=generator&theme=0',
  instagram: 'https://www.instagram.com/shezrmusic/',
  appleMusic: 'https://music.apple.com/gb/artist/shez/1484492113',
  /** His composer page on Apple Music (soundtracks are credited to Shez Manzoor) */
  appleMusicComposer: 'https://music.apple.com/gb/artist/shez-manzoor/1477261034',
  soundcloud: 'https://soundcloud.com/shezrmusic',
  imdb: 'https://www.imdb.com/name/nm11798949/',
  linkedin: 'https://www.linkedin.com/in/shez-manzoor-739914160/',
  britishComedyGuide: 'https://www.comedy.co.uk/people/shez_manzoor/',
  stereofox: 'https://label.stereofox.com/?p=3060',
  /** TO CONFIRM: Manners McDade lists him, and SMA Talent announced his signing. Use whichever is current. */
  agent: {
    name: 'Manners McDade',
    url: 'https://www.mannersmcdade.co.uk/composer/shez-manzoor/',
  },
} as const;

/** His own inbox. The contact window links to it, and its form is delivered there by FormSubmit. */
export const email = 'shez.r.music@gmail.com';

/**
 * Film and TV representation, shown in the contact window.
 * TO CONFIRM: SMA Talent announced his signing (the address is Carolynne Wyper's, who leads their
 * composers); Manners McDade, now part of Manners Faber, is the earlier agency, to be removed.
 * Manners McDade publishes no email address for him, so it links to his page there.
 */
export const agents: { agency: string; email?: string; url: string }[] = [
  { agency: 'SMA Talent', email: 'carolynne@smatalent.com', url: 'https://smatalent.com/' },
  { agency: 'Manners McDade', url: links.agent.url },
];

/** Profiles that describe the same person. Feeds schema.org sameAs for search and AI answers. */
export const sameAs = [
  links.spotify,
  links.appleMusic,
  links.appleMusicComposer,
  links.soundcloud,
  links.instagram,
  links.imdb,
  links.linkedin,
  links.agent.url,
  links.britishComedyGuide,
];

export const bios = {
  short:
    'Shez Manzoor (SHEZ) is a British-Pakistani music producer, singer-songwriter and composer for film and television, based in London. He scored series 1 and 2 of the BAFTA-winning comedy We Are Lady Parts, winning an RTS Craft & Design Award, and co-composed the feature film Polite Society.',
  medium:
    'Shez Manzoor, aka SHEZ, is an award-winning British-Pakistani music producer, singer-songwriter, composer and multi-instrumentalist based in London. With a background in vocal and guitar performance and jazz, he draws on folk, soul, hip hop, rock and electronic music as well as classical Indian and Pakistani music. He scored and wrote original music for series 1 and 2 of the BAFTA-winning musical comedy We Are Lady Parts, winning the 2024 RTS Craft & Design Award for Music – Original Score (Scripted), and co-composed the score for Polite Society with Tom Howe. As SHEZ, he released his self-produced debut EP Our Time in 2022 and the single Freeze on Stereofox in 2024.',
  long: [
    'Shez Manzoor, aka SHEZ, is an award-winning British-Pakistani music producer, singer-songwriter, composer and multi-instrumentalist based in London.',
    'With a background in vocal and guitar performance and jazz, his musical influences come from a variety of genres including folk, soul, hip hop, rock and electronic music, as well as classical Indian and Pakistani music.',
    'His work for film and television includes compositions for Clarkson’s Farm and the score and original music for series 1 and 2 of the BAFTA-winning musical comedy We Are Lady Parts, which won him the 2024 RTS Craft & Design Award for Music – Original Score (Scripted). He also co-composed, with Tom Howe, the score for the Focus Features action comedy Polite Society, which premiered at the 2023 Sundance Film Festival.',
    'As SHEZ, he released his self-produced debut EP Our Time in 2022, and his songs have been played on national radio by the BBC, Reprezent Radio and Threads. His first label release, the single Freeze, came out on Stereofox in November 2024. He has collaborated with artists including Elaha Soroor, anaiis and Victoria Port, and performed at London venues such as Soho Theatre, The Lower Third and Notting Hill Arts Club.',
    'His latest release, Miscellany (Vol. 1), is an instrumental EP reflecting his wide range of influences, inspired by the need to process and channel emotions of hope and rage.',
  ],
} as const;

export const pressQuote = {
  text: '…such a unique style… blending r&b, jazz & soul in the most majestic way.',
  source: 'Stereofox',
  url: links.stereofox,
} as const;

export const nav = [
  { href: '/composition/', label: 'Composition', light: 'green' },
  { href: '/music/', label: 'Music', light: 'purple' },
  { href: '/about/', label: 'About' },
  { href: '/epk/', label: 'Press kit' },
  { href: '/contact/', label: 'Contact' },
] as const;
