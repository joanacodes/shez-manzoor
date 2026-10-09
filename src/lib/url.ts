/**
 * Every internal link goes through `href` so the site works both at a domain root
 * and under a sub-path such as GitHub Pages (/shez-manzoor/).
 */
const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

export function href(path = '/'): string {
  if (/^(https?:|mailto:|tel:|#)/.test(path)) return path;
  return base + path.replace(/^\//, '');
}

/** Absolute URL for canonical links, Open Graph and structured data. */
export function absolute(path: string, site: URL | undefined): string {
  const origin = site ?? new URL('https://www.shezmanzoormusic.co.uk');
  return new URL(href(path), origin).toString();
}

/** True when `current` is `path` or a page below it. */
export function isActive(current: string, path: string): boolean {
  const target = href(path);
  if (target === base) return current === base;
  return current.startsWith(target);
}
