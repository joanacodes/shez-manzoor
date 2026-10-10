# Shez Manzoor (SHEZ): website

Website for **Shez Manzoor**, London composer for film and TV, who also releases soul and R&B as **SHEZ**.

**Design 2: the stage.** This branch is the second design, published at `/design-2/` for comparison. The homepage opens on his name in the dark, like a preloader. Then a light comes on above a stage set with his electric guitar on its stand, a vocal mic and an old TV that plays his film and TV work. The name dims into the backdrop. After 3.5 seconds a ring of covers and posters for everything he has made turns into view in front. Each one opens a panel with the release date, credits, tracklist, and Apple Music and Spotify players. Scrolling down gives the full story, the film and TV credits, the full discography, press, FAQ and contact.

On stage, the TV changes channel when tapped, the guitar strums, and the mic changes the colour of the light. Purple and green, his colours, wash the curtain either side.

## Stack

| Part | Choice | Why |
| --- | --- | --- |
| Framework | [Astro 7](https://astro.build), static output | Every page is plain HTML that search engines and AI assistants read in full. |
| 3D | [three.js](https://threejs.org) (`src/scripts/stage3d/`), every model built in code | No model files to download. The scene (160 KB gzipped) loads only on devices with a real GPU, after the page is ready. |
| Styling | Plain CSS with design tokens (`src/styles/global.css`) | No framework runtime. CSS is inlined into each page. |
| Fonts | Instrument Serif, Instrument Sans, DM Mono, self-hosted | Served from this site through Astro's font API, with no request to Google. |
| Images | `astro:assets`, AVIF and WebP | The live photo goes from 166 KB to 10–30 KB. |

The page itself ships about 12 KB of JavaScript. Visitors with reduced motion, data saver or software rendering see stills rendered from the same scene (`src/assets/stage/`), with the same intro and carousel.

## Commands

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # static site in dist/
npm run preview   # serve dist/
```

Add `?stage` to the homepage URL to force the 3D scene on machines without a GPU, for testing. `?skip` jumps past the intro.

To render new stills after changing the scene, open `/?stage&still&tier=high`, wait for the stage to settle, and save the canvas into `src/assets/stage/`, once per screen shape:

| File | Window | Scale | Used for |
| --- | --- | --- | --- |
| `stage-tall.jpg` | 414×896 | 2 | Phones, 19.5:9 |
| `stage-short.jpg` | 375×667 | 2 | Phones, 16:9 |
| `stage-tablet.jpg` | 768×1024 | 1.5 | Tablets, upright |
| `stage-fourthree.jpg` | 1024×768 | 1.5 | Tablets on their side, 4:3 screens |
| `stage-wide.jpg` | 1600×900 | 1.5 | Laptops and desktops |
| `stage-phoneland.jpg` | 844×390 | 2 | Phones on their side |

The camera frames the set in the space the page leaves between his name and the covers, so the stills line up with the page at those sizes.

## Editing content

All facts live in `src/data/`. Pages, structured data and `llms.txt` are generated from them.

| File | Holds |
| --- | --- |
| `site.ts` | Biographies, award, links, collaborators, venues, press quote, navigation. |
| `projects.ts` | Film and TV credits. Each one gets a page at `/composition/<slug>/`. |
| `releases.ts` | Releases as SHEZ. Each one gets a page at `/music/<slug>/`. |
| `faq.ts` | Questions and answers, also published as FAQ structured data. |
| `catalog.json` | Every release, soundtrack and cover found on Apple Music and Spotify. Written by the fetch job below, not by hand. |
| `work.ts` | Joins the catalog with the credits above into the list the carousel shows. |

**Artwork and release info.** `scripts/fetch-artwork.mjs` reads his Apple Music artist pages (as SHEZ and as Shez Manzoor) through the public iTunes Search API, and his public Spotify player. It saves covers to `src/assets/artwork/` and the facts to `catalog.json`. The `Fetch artwork and release info` workflow runs it on GitHub whenever the script changes, commits the result and republishes the preview. Once the workflow is on `main`, it can also be run by hand from the Actions tab (Run workflow), for example after a new release.

**Spotify albums.** Spotify's public player only lists his top tracks. To link an album exactly, add its ID (the part after `/album/` in a Spotify link) to `SPOTIFY_ALBUMS` in the script: its cover, tracks and player are picked up on the next run.

**TV and cinema clips.** The TV on the stage and the cinema screen above Film & Television show posters until clips arrive. Upload short videos (10–30 seconds, MP4 is safest, under 25 MB each, which is GitHub's limit for uploads in the browser) to `public/clips/` on this branch: [upload page](https://github.com/joanacodes/shez-manzoor/upload/claude/shez-manzoor-stage-design/public/clips). Any file name that contains the title works (`We Are Lady Parts trailer.mp4`, `WALP s2.mp4`, `polite-society.mp4`, `Clarksons Farm.mov`, `Bride or Die.mp4`). Clips always play muted, and both screens fall back to the poster if a clip can't play. They appear at the next build.

**Posters added by hand.** A poster saved as `src/assets/artwork/screen-<slug>.jpg` (or `.png`, `.webp`), for example `screen-clarksons-farm.jpg`, is used for that credit on the cards, in its panel and on the TV.

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
- **Artwork.** Posters for Clarkson's Farm and Bride or Die. They are drawn in CSS until then.
- **Bride or Die.** His exact role and the year.
- **Spotify album links.** Releases whose Spotify album is not known yet link to a Spotify search. Send the album links to add them.
- **Links.** YouTube, Facebook, IMDb and Bandcamp URLs, to add to the footer and to `sameAs`.
- **Photos.** Photographer credits, and more press photos.
