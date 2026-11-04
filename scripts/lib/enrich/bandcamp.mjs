// Parsers for oophoi.bandcamp.com pages.
import { decodeEntities } from "./normalize.mjs";

export const BANDCAMP_BASE = "https://oophoi.bandcamp.com";

export function parseAlbumLinks(html) {
  const slugs = [...html.matchAll(/href="\/album\/([^"?#/]+)"/g)].map((match) => match[1]);
  return [...new Set(slugs)];
}

// "_0" is the original upload; the art id is zero-padded to ten digits in image URLs.
export function coverUrlForArt(artId) {
  return `https://f4.bcbits.com/img/a${String(artId).padStart(10, "0")}_0.jpg`;
}

function toIsoDate(text) {
  const date = text ? new Date(text) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

export function parseAlbumPage(html, url) {
  const attribute = html.match(/data-tralbum="([^"]*)"/);
  if (!attribute) throw new Error(`No data-tralbum attribute in ${url}`);
  const tralbum = JSON.parse(decodeEntities(attribute[1]));
  const current = tralbum.current ?? {};
  const releaseDate = toIsoDate(current.release_date ?? tralbum.album_release_date);
  return {
    slug: url.split("/album/")[1]?.replace(/[?#].*$/, "") ?? null,
    url,
    title: current.title ?? null,
    artist: tralbum.artist ?? null,
    releaseDate,
    year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
    artId: tralbum.art_id ?? null,
    coverUrl: tralbum.art_id ? coverUrlForArt(tralbum.art_id) : null,
    tracks: (tralbum.trackinfo ?? [])
      .filter((track) => track.title)
      .map((track) => ({ title: String(track.title).trim(), seconds: track.duration })),
    about: current.about ?? null,
  };
}
