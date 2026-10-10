/** A photo of him for structured data and profile cards: a plain JPEG, absolute URL. */
import { getImage } from 'astro:assets';
import photo from '../assets/shez-live.webp';

export async function portraitUrl(site: URL | undefined): Promise<string> {
  const image = await getImage({ src: photo, width: 1200, format: 'jpg', quality: 82 });
  // image.src already carries the base path, so resolve it against the origin only
  return new URL(image.src, site ?? 'https://www.shezmanzoormusic.co.uk').toString();
}
