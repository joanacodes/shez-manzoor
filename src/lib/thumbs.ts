import { getImage } from 'astro:assets';

/** A small square cover for the mini player and lists. */
export async function thumbOf(src?: ImageMetadata) {
  return src ? (await getImage({ src, width: 120, height: 120, format: 'webp', quality: 70 })).src : undefined;
}
