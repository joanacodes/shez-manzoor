/** schema.org builders. One Person entity is referenced by @id everywhere so search engines merge SHEZ and Shez Manzoor. */
import { award, bios, person, sameAs } from '../data/site';
import type { Project } from '../data/projects';
import type { Release } from '../data/releases';
import { absolute } from './url';

type Json = Record<string, unknown>;

export const ids = (site: URL | undefined) => ({
  person: `${absolute('/', site)}#person`,
  website: `${absolute('/', site)}#website`,
});

export function personSchema(site: URL | undefined, image?: string): Json {
  return {
    '@type': 'Person',
    '@id': ids(site).person,
    name: person.name,
    alternateName: [person.artistName, 'Shez'],
    description: bios.short,
    url: absolute('/', site),
    ...(image ? { image } : {}),
    jobTitle: [...person.roles],
    knowsAbout: ['Film scoring', 'Television music', 'Songwriting', 'Guitar', ...person.influences],
    homeLocation: { '@type': 'Place', name: person.location },
    award: [award.label],
    sameAs,
  };
}

export function websiteSchema(site: URL | undefined): Json {
  return {
    '@type': 'WebSite',
    '@id': ids(site).website,
    url: absolute('/', site),
    name: 'Shez Manzoor',
    alternateName: 'SHEZ',
    inLanguage: 'en-GB',
    about: { '@id': ids(site).person },
    publisher: { '@id': ids(site).person },
  };
}

export function projectSchema(p: Project, site: URL | undefined): Json {
  const music = [
    { '@id': ids(site).person },
    ...(p.schema.coComposers ?? []).map((name) => ({ '@type': 'Person', name })),
  ];
  return {
    '@type': p.schema.type,
    name: p.title.replace('’', "'"),
    url: absolute(`/composition/${p.slug}/`, site),
    description: p.summary,
    musicBy: music,
    ...(p.schema.datePublished ? { datePublished: p.schema.datePublished } : {}),
    ...(p.schema.numberOfSeasons ? { numberOfSeasons: p.schema.numberOfSeasons } : {}),
    ...(p.schema.creator ? { creator: { '@type': 'Person', name: p.schema.creator } } : {}),
    ...(p.schema.director ? { director: { '@type': 'Person', name: p.schema.director } } : {}),
    ...(p.schema.productionCompany
      ? { productionCompany: p.schema.productionCompany.map((name) => ({ '@type': 'Organization', name })) }
      : {}),
  };
}

export function releaseSchema(r: Release, site: URL | undefined): Json {
  return {
    '@type': 'MusicAlbum',
    name: r.title,
    url: absolute(`/music/${r.slug}/`, site),
    description: r.summary,
    albumReleaseType: `https://schema.org/${r.schemaType}`,
    albumProductionType: 'https://schema.org/StudioAlbum',
    byArtist: { '@id': ids(site).person },
    ...(r.datePublished ? { datePublished: r.datePublished } : {}),
    ...(r.label && r.label !== 'Self-released' ? { recordLabel: { '@type': 'Organization', name: r.label } } : {}),
    ...(r.tracks
      ? {
          track: r.tracks.map((t, i) => ({
            '@type': 'MusicRecording',
            name: t.title,
            position: i + 1,
            byArtist: { '@id': ids(site).person },
          })),
        }
      : {}),
  };
}

export function faqSchema(items: readonly { q: string; a: string }[]): Json {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

export function breadcrumbSchema(trail: { name: string; path: string }[], site: URL | undefined): Json {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: step.name,
      item: absolute(step.path, site),
    })),
  };
}

/** Wraps nodes in one @graph document. */
export function graph(nodes: Json[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c');
}
