/**
 * The visitor's answer to "Do you accept cookies?", kept in this browser (local storage).
 * The site sets no cookies of its own. A "no" keeps the Spotify and Apple Music players from
 * loading on the page: pressing play opens the song on their site instead. Answering, here
 * or on the legal page, sends a "consent" event on the document.
 */
export type Consent = 'yes' | 'no';
const KEY = 'cookies';
// when the browser keeps nothing (some private windows), the answer lasts for this page
let memory: Consent | null = null;

export function consent(): Consent | null {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'yes' || v === 'no') return v;
  } catch {
    /* storage blocked */
  }
  return memory;
}

export function setConsent(v: Consent) {
  memory = v;
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* storage blocked */
  }
  document.documentElement.dataset.cookies = v;
  document.dispatchEvent(new CustomEvent('consent', { detail: v }));
}

/** The page on Spotify or Apple Music that an embedded player comes from. */
export const playerPage = (embed: string) =>
  embed.replace('://open.spotify.com/embed/', '://open.spotify.com/').replace('://embed.music.apple.com/', '://music.apple.com/');

/** True when a player from another site may load here; otherwise its song opens on that site. */
export function mayEmbed(embed: string) {
  if (consent() !== 'no') return true;
  window.open(playerPage(embed), '_blank', 'noopener');
  return false;
}
