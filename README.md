# Shez Manzoor (SHEZ): website

Website for **Shez Manzoor**, London composer for film and TV, who also releases soul and R&B as **SHEZ**.

The concept is **two stage lights on one dark stage**. Purple lights SHEZ the artist, green lights Shez Manzoor the composer, and the site lives in the dark between them. The homepage opens on six strings of light under both lights. Visitors can strum them with a finger or the mouse, and an optional sound toggle makes them play a chord.

## Stack

| Part | Choice | Why |
| --- | --- | --- |
| Framework | [Astro 7](https://astro.build), static output | Every page is plain HTML that search engines and AI assistants read in full. |
| 3D | Plain WebGL in a Web Worker (`src/scripts/stage/`) | About 15 KB instead of 150 KB for three.js, and it never blocks the page. |
| Styling | Plain CSS with design tokens (`src/styles/global.css`) | No framework runtime. CSS is inlined into each page. |
| Fonts | Instrument Serif, Instrument Sans, DM Mono, self-hosted | Served from this site through Astro's font API, with no request to Google. |
| Images | `astro:assets`, AVIF and WebP | The live photo goes from 166 KB to 10–30 KB. |

The page itself ships about 11 KB of JavaScript. The 3D scene loads after the page is ready and only on devices with a real GPU. Visitors with reduced motion, data saver or software rendering see a static version of the same hero.

## Commands

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # static site in dist/
npm run preview   # serve dist/
```

Add `?stage` to the homepage URL to force the 3D scene on machines without a GPU, for testing.

## Editing content

All facts live in `src/data/`. Pages, structured data and `llms.txt` are generated from them.

| File | Holds |
| --- | --- |
| `site.ts` | Biographies, award, links, collaborators, venues, press quote, navigation. |
| `projects.ts` | Film and TV credits. Each one gets a page at `/composition/<slug>/`. |
| `releases.ts` | Releases as SHEZ. Each one gets a page at `/music/<slug>/`. |
| `faq.ts` | Questions and answers, also published as FAQ structured data. |

Release covers and project cards are drawn in CSS until real artwork is supplied (`src/components/Sleeve.astro`, `ProjectCard.astro`).

## Environment variables

| Variable | Default | Use |
| --- | --- | --- |
| `SITE_URL` | `https://www.shezmanzoormusic.co.uk` | Absolute URL for canonical links, sitemap and structured data. Netlify and Vercel set it automatically. |
| `BASE_PATH` | `/` | Sub-path when hosted in a folder, such as GitHub Pages project sites. |
| `INDEXABLE` | `false` | Search engines only index the site when this is `true`. Leave it off for previews. |

## Deploying a preview

**GitHub Pages.** The workflow in `.github/workflows/deploy.yml` builds every push to `main` and `claude/**`. It publishes when Pages is turned on.
1. Pages needs a public repository or a paid GitHub plan.
2. In Settings, open Pages and set Source to GitHub Actions.
3. To publish from a branch other than `main`, open Settings, then Environments, then `github-pages`, and allow that branch.

**Design previews.** Branches listed in `PREVIEWS` in the deploy workflow are built into their own folder next to the live site. For example, `claude/shez-manzoor-stage-design` appears at `/design-2/`. A push to such a branch checks the build, then asks `main` to republish.

**Netlify or Vercel.** Import the repository and keep the detected settings. Both work with private repositories on free plans and give each branch its own preview URL. Netlify reads `netlify.toml`, which also turns the old Squarespace URLs into permanent redirects.

## SEO and AI search

- Real HTML for every word, one `h1` per page, descriptive titles and meta descriptions.
- One page per project and per release, written in plain factual sentences that answers can quote.
- schema.org structured data: one `Person` entity that links SHEZ and Shez Manzoor (`alternateName`, `sameAs`), plus `TVSeries`, `Movie`, `MusicAlbum`, `FAQPage`, `BreadcrumbList` and `ProfilePage`.
- `sitemap-index.xml`, `robots.txt`, and `llms.txt`, a plain summary for AI assistants.
- Open Graph and Twitter cards with a 1200×630 image (`public/og/default.jpg`).
- Redirects from old Squarespace URLs (`/epk/releases`, `/releases`, `/bio`).
- Lighthouse on mobile: 99–100 for performance, 100 for accessibility, best practices and SEO.

## Launch checklist

1. Confirm the facts listed below with Shez.
2. Replace the drawn covers with real artwork, and add photo credits.
3. Add a contact email, if he wants one public.
4. Build with `INDEXABLE=true` on the real domain, then check `robots.txt` and the `noindex` tag are gone.
5. Point `www.shezmanzoormusic.co.uk` at the new host, and keep the old URLs redirecting.
6. Submit the sitemap in Google Search Console and Bing Webmaster Tools.
7. Update the website link on Spotify, Instagram and the agency profile.

## To confirm with Shez

- **Representation.** Manners McDade lists him, and SMA Talent announced his signing. The site currently links to Manners McDade.
- **Clarkson's Farm.** His bio says "compositions for". Public listings credit another composer for the series score, so the site says "Compositions".
- **Miscellany (Vol. 1).** Release date, label and links. Nothing about it is public online yet.
- **Bride or Die.** His exact role and the year.
- **Rhythm Section.** Whether it was a single or an EP.
- **Our Time.** The full tracklist. The site lists the three tracks shown on his current site.
- **Links.** Apple Music, YouTube, SoundCloud, Facebook, IMDb and Bandcamp URLs, to add to the footer and to `sameAs`.
- **Photos.** Photographer credits, and more press photos.
