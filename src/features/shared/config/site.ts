export const site = {
  title: "Oöphoi — A Tribute",
  name: "Oöphoi",
  description:
    "An unofficial, non-commercial tribute to the Italian ambient musician Oöphoi (Gianluigi Gasparetti, 1958–2013): biography, discography and memorial.",
  locale: "en_US",
  themeColor: "#0e0d0b",
} as const;

export interface NavItem {
  label: string;
  href: string;
}

export const mainNavigation: readonly NavItem[] = [
  { label: "Biography", href: "/biography/" },
  { label: "Discography", href: "/discography/" },
  { label: "News", href: "/news/" },
  { label: "Gallery", href: "/gallery/" },
  { label: "Memorial", href: "/memorial/" },
  { label: "About", href: "/about/" },
];

/** Oöphoi's own labels, linked from the footer. */
export const labelNavigation: readonly NavItem[] = [
  { label: "Umbra", href: "/labels/umbra/" },
  { label: "Penumbra", href: "/labels/penumbra/" },
];

/** Oöphoi's Discogs artist id, the single source for every link to his Discogs page. */
export const OOPHOI_DISCOGS_ARTIST_ID = 162295;

/** External sources, archived where the original is offline. */
export const externalLinks = {
  deepListenings: "https://web.archive.org/web/20250904043656/https://digilander.libero.it/ducaeconte/pages/INDICE.htm",
  obituary:
    "https://web.archive.org/web/20220902123916/https://hypnos.com/wordpress/2013/04/12/oophoi-gianluigi-gasparetti-has-passed-away/",
  tributeBroadcast:
    "https://web.archive.org/web/20220902123920/https://hypnos.com/wordpress/2013/04/17/oophoi-tribute-on-sunday-evening-sinewaves/",
  forumThread: "https://web.archive.org/web/20230323090826/http://www.hypnos.com/smf/index.php?topic=5949.0",
  wikipedia: "https://en.wikipedia.org/wiki/O%C3%B6phoi",
  discogsArtist: `https://www.discogs.com/artist/${OOPHOI_DISCOGS_ARTIST_ID}-O%C3%B6phoi`,
  siteAuthor: "https://www.rankirlian.com/",
} as const;
