/** Film and television credits. Order here is the order on the site. */

export type Project = {
  slug: string;
  title: string;
  kind: string;
  years?: string;
  where: string;
  role: string;
  badge?: string;
  /** One sentence for cards, meta descriptions and AI answers. */
  summary: string;
  body: string[];
  facts: { label: string; value: string }[];
  /** Pieces of the score or songs worth naming. */
  music?: { heading: string; items: string[]; note?: string };
  /** Decorative card pattern, drawn in CSS. */
  pattern: 'strings' | 'rings' | 'furrows' | 'film';
  schema: {
    type: 'TVSeries' | 'Movie' | 'CreativeWork';
    datePublished?: string;
    numberOfSeasons?: number;
    creator?: string;
    director?: string;
    productionCompany?: string[];
    coComposers?: string[];
  };
};

export const projects: Project[] = [
  {
    slug: 'we-are-lady-parts',
    title: 'We Are Lady Parts',
    kind: 'TV series',
    years: '2021 – 2024',
    where: 'Channel 4 · Peacock',
    role: 'Composer · Original songs',
    badge: 'RTS Award winner',
    summary:
      'Score and original songs for series 1 and 2 of the BAFTA-winning musical comedy about a Muslim punk band in London.',
    body: [
      'We Are Lady Parts follows Lady Parts, a Muslim punk band in London, and the PhD student who becomes their lead guitarist. Created by Nida Manzoor, the series won three BAFTA TV Craft Awards in 2022, including Writer: Comedy.',
      'Shez Manzoor scored series 1 (2021) and series 2 (2024) and co-wrote original songs for the show with its creator.',
      'His music for series 2 won the 2024 RTS Craft & Design Award for Music – Original Score (Scripted), shared with Nida Manzoor, Sanya Manzoor and Benjamin Fregin.',
    ],
    facts: [
      { label: 'Format', value: 'Television series, 2 series' },
      { label: 'Broadcaster', value: 'Channel 4 (UK), Peacock (US)' },
      { label: 'Production', value: 'Working Title Television' },
      { label: 'Created by', value: 'Nida Manzoor' },
      { label: 'Music', value: 'Shez Manzoor' },
      { label: 'Award', value: 'RTS Craft & Design Awards 2024, Music – Original Score (Scripted)' },
    ],
    music: {
      heading: 'Songs from the series',
      items: ['Voldemort Under My Headscarf', 'Bashir With the Good Beard'],
      note: 'Performed by Lady Parts on the series soundtrack.',
    },
    pattern: 'strings',
    schema: {
      type: 'TVSeries',
      datePublished: '2021',
      numberOfSeasons: 2,
      creator: 'Nida Manzoor',
      productionCompany: ['Working Title Television'],
    },
  },
  {
    slug: 'polite-society',
    title: 'Polite Society',
    kind: 'Feature film',
    years: '2023',
    where: 'Focus Features · Working Title',
    role: 'Co-composer, with Tom Howe',
    badge: 'Sundance 2023',
    summary:
      'Score, co-composed with Tom Howe, for Nida Manzoor’s martial-arts action comedy, which premiered at the 2023 Sundance Film Festival.',
    body: [
      'Polite Society is an action comedy about Ria Khan, a London teenager and aspiring stuntwoman who sets out to stop her older sister’s wedding. Written and directed by Nida Manzoor, it premiered in the Midnight section of the 2023 Sundance Film Festival and reached cinemas in April 2023.',
      'Shez Manzoor co-composed the score with Tom Howe.',
    ],
    facts: [
      { label: 'Format', value: 'Feature film' },
      { label: 'Released', value: '2023' },
      { label: 'Studios', value: 'Focus Features, Working Title' },
      { label: 'Written and directed by', value: 'Nida Manzoor' },
      { label: 'Music', value: 'Tom Howe and Shez Manzoor' },
      { label: 'Premiere', value: 'Sundance Film Festival 2023, Midnight section' },
    ],
    music: {
      heading: 'From the score',
      items: ['Garden Kicks', 'Emails & Sneaking Around', 'Ria vs. Kovacs', 'Ria Comes Home'],
      note: 'Polite Society (Original Motion Picture Soundtrack), Tom Howe and Shez Manzoor.',
    },
    pattern: 'rings',
    schema: {
      type: 'Movie',
      datePublished: '2023',
      director: 'Nida Manzoor',
      productionCompany: ['Focus Features', 'Working Title Films'],
      coComposers: ['Tom Howe'],
    },
  },
  {
    slug: 'clarksons-farm',
    title: 'Clarkson’s Farm',
    kind: 'Documentary series',
    where: 'Prime Video',
    role: 'Compositions',
    summary:
      'Compositions for the Prime Video series that follows Jeremy Clarkson as he runs a farm in the Cotswolds.',
    body: [
      'Clarkson’s Farm is the Prime Video documentary series that follows Jeremy Clarkson as he runs Diddly Squat Farm in the Cotswolds.',
      'Shez Manzoor has written compositions for the series.',
    ],
    facts: [
      { label: 'Format', value: 'Documentary series' },
      { label: 'Platform', value: 'Prime Video' },
      { label: 'Contribution', value: 'Compositions' },
    ],
    pattern: 'furrows',
    schema: { type: 'TVSeries' },
  },
  {
    slug: 'bride-or-die',
    title: 'Bride or Die',
    kind: 'Short film',
    where: 'Straight 8 · Moxie Pictures',
    role: 'Music',
    summary: 'Music for a Straight 8 short film by Moxie Pictures, shot on a single cartridge of Super 8.',
    body: [
      'Bride or Die is a short film by Moxie Pictures, made for Straight 8, the challenge where each film is shot on one cartridge of Super 8 and edited in camera, with the soundtrack added separately.',
      'Shez Manzoor composed the music.',
    ],
    facts: [
      { label: 'Format', value: 'Short film, Super 8' },
      { label: 'Made for', value: 'Straight 8' },
      { label: 'Production', value: 'Moxie Pictures' },
      { label: 'Music', value: 'Shez Manzoor' },
    ],
    pattern: 'film',
    schema: { type: 'Movie' },
  },
];
