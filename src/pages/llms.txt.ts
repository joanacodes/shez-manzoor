/**
 * llms.txt: a plain summary for AI assistants and answer engines (https://llmstxt.org).
 * Generated from the same data as the pages, so it never drifts.
 */
import type { APIRoute } from 'astro';
import { award, bios, links, person } from '../data/site';
import { projects } from '../data/projects';
import { releases } from '../data/releases';
import { faq } from '../data/faq';
import { formatDate, work } from '../data/work';
import { absolute } from '../lib/url';

export const GET: APIRoute = ({ site }) => {
  const url = (p: string) => absolute(p, site);
  const lines = [
    `# ${person.name} (${person.artistName})`,
    '',
    `> ${person.oneLiner}`,
    '',
    bios.medium,
    '',
    '## Key facts',
    `- Name: ${person.name}. Artist name: ${person.artistName}.`,
    `- Based in ${person.location}. ${person.origin}.`,
    `- Work: ${person.roles.join(', ')}.`,
    `- Award: ${award.name} ${award.year}, ${award.category}, for ${award.work}, shared with ${award.sharedWith.join(', ')}.`,
    `- Influences: ${person.influences.join(', ')}.`,
    `- Collaborations: ${person.collaborators.join(', ')}.`,
    `- Representation for film and TV: ${links.agent.name} (${links.agent.url}).`,
    '',
    '## Film and television',
    ...projects.map((p) => `- [${p.title}](${url(`/composition/${p.slug}/`)}): ${p.kind}${p.years ? `, ${p.years}` : ''}, ${p.where}. Role: ${p.role}. ${p.summary}`),
    '',
    '## Releases as SHEZ',
    ...releases.map((r) => `- [${r.title}](${url(`/music/${r.slug}/`)}): ${r.type}, ${r.when}${r.label ? `, ${r.label}` : ''}. ${r.summary}`),
    '',
    '## Full discography (newest first)',
    ...work
      .filter((w) => w.kind === 'record' || w.tracks.length)
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
      .map((w) => {
        const where = [w.listen.apple && `Apple Music: ${w.listen.apple.url}`, w.listen.spotify?.exact && `Spotify: ${w.listen.spotify.url}`].filter(Boolean).join('. ');
        const title = w.soundtrack?.title ?? w.title;
        const artist = w.soundtrack?.artist ?? w.artist;
        const kind = w.soundtrack ? `Soundtrack of ${w.title}` : w.category;
        return `- ${title}, ${artist}. ${kind}, released ${formatDate(w.date)}${w.tracks.length > 1 ? `, ${w.tracks.length} tracks` : ''}.${where ? ` ${where}.` : ''}`;
      }),
    '',
    '## Questions',
    ...faq.flatMap((f) => [`### ${f.q}`, f.a, '']),
    '## Pages',
    `- [Home](${url('/')})`,
    `- [Composition](${url('/composition/')})`,
    `- [Music](${url('/music/')})`,
    `- [About](${url('/about/')})`,
    `- [Press kit](${url('/epk/')})`,
    `- [Contact](${url('/contact/')})`,
    '',
    '## Profiles',
    `- Spotify: ${links.spotify}`,
    `- Apple Music: ${links.appleMusic} (as SHEZ), ${links.appleMusicComposer} (as Shez Manzoor)`,
    `- SoundCloud: ${links.soundcloud}`,
    `- Instagram: ${links.instagram}`,
    `- British Comedy Guide: ${links.britishComedyGuide}`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
