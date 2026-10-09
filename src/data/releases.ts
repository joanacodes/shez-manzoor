/** Releases as SHEZ, newest first. Artwork is designed in CSS until the real covers are added. */

export type Release = {
  slug: string;
  title: string;
  type: 'EP' | 'Single' | 'Release';
  /** Shown on the sleeve and in lists. */
  when: string;
  datePublished?: string;
  label?: string;
  latest?: boolean;
  summary: string;
  body: string[];
  tracks?: { title: string; length?: string }[];
  tracksNote?: string;
  quote?: { text: string; source: string };
  art: 'miscellany' | 'freeze' | 'our-time' | 'rhythm';
  /** Album type for schema.org */
  schemaType: 'EPRelease' | 'SingleRelease' | 'AlbumRelease';
};

export const releases: Release[] = [
  {
    slug: 'miscellany-vol-1',
    title: 'Miscellany (Vol. 1)',
    type: 'EP',
    when: 'Latest release',
    latest: true,
    summary:
      'An instrumental EP reflecting his wide range of influences, inspired by the need to process and channel emotions of hope and rage.',
    body: [
      'Miscellany (Vol. 1) is an instrumental EP by SHEZ. It reflects the wide range of influences in his music, from jazz and soul to classical Indian and Pakistani music.',
      'He describes it as inspired by the need to process and channel emotions of hope and rage.',
    ],
    art: 'miscellany',
    schemaType: 'EPRelease',
  },
  {
    slug: 'freeze',
    title: 'Freeze',
    type: 'Single',
    when: '14 November 2024',
    datePublished: '2024-11-14',
    label: 'Stereofox',
    summary:
      'His first label release: a song about the cold outside and in, with jazzy drums, hazy vocals and lyrics in English and Spanish.',
    body: [
      'Freeze was released on the Stereofox label on 14 November 2024, his first label release.',
      'The song plays with the idea of cold, both outside and inside, and how love is the thing you need most. Jazzy drums, hazy vocals and lyrics in English and Spanish build to a synth solo at the end.',
    ],
    quote: {
      text: '“Freeze” is about feeling desire for a connection with someone during the winter months. The idea of finding warmth in someone and taking shelter within one another.',
      source: 'SHEZ, speaking to Stereofox',
    },
    art: 'freeze',
    schemaType: 'SingleRelease',
  },
  {
    slug: 'our-time',
    title: 'Our Time',
    type: 'EP',
    when: '2022',
    datePublished: '2022',
    label: 'Self-released',
    summary: 'His self-produced debut EP, where guitar, soul and R&B vocals meet jazz harmony.',
    body: [
      'Our Time is the self-produced debut EP by SHEZ, released in 2022.',
      'Built on guitar, it brings raw soul and R&B vocals together with jazz and blues-inspired melody and harmony. He has also performed the title track live, including a session at Engine Rooms.',
    ],
    tracks: [
      { title: '1 of a kind', length: '3:24' },
      { title: 'our time', length: '2:16' },
      { title: 'Struck/Gold', length: '3:56' },
    ],
    tracksNote: 'Tracks include',
    art: 'our-time',
    schemaType: 'EPRelease',
  },
  {
    slug: 'rhythm-section',
    title: 'Rhythm Section',
    type: 'Release',
    when: '2020',
    datePublished: '2020',
    summary: 'His second release, featured by Stereofox in 2020.',
    body: [
      'Rhythm Section was the second release by SHEZ. It was featured on the Stereofox blog in 2020, four years before the label released Freeze.',
    ],
    art: 'rhythm',
    schemaType: 'SingleRelease',
  },
];
