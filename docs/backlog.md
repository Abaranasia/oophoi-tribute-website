# Backlog

Open work for the next slices, most important first.

## Contact form (replaces the owner's email address)

The owner's email is not published anywhere on the site. Add a small, simple contact form instead, used for questions, corrections, photo submissions and memorial tributes.

- Pages: `/about`, plus links to it from `/memorial` (tributes) and `/gallery` (photos).
- Fields: name, email (for the reply), message. Optionally an attachment or link for photos.
- The site is static, so it needs a form backend. Choose one when the hosting is decided:
  - a hosted form service (no server code)
  - the host's built-in forms
  - an Astro server endpoint with an adapter that sends email
- Spam protection: a honeypot field at minimum; add a privacy-friendly captcha if spam appears.
- Accessibility: real labels, error messages tied to their fields, a success state that keeps focus.
- Privacy: say what happens to the data, and keep submissions only as long as needed.

## Email in git history

The owner's email is still in the history of `5d75f4d` (`docs/copy-changes.md`, row 16), which is pushed on `feat/foundation-discography`. Commit `b1fc4ef` removed it from the current files. The owner chose to leave the history as it is for now. Removing it later means rewriting that commit and force-pushing.

## Review follow-ups from slice 2

1. `scripts/lib/staged-swap.mjs:69`: the backup cleanup runs outside the try. If it fails after a successful swap, the script reports "Aborted" and leaves `.backup` folders that block the next run. Report success and warn about the leftover folders instead.
2. `src/features/gallery/components/PhotoGallery.astro`: a click on the dialog's padding closes the lightbox. Move the padding to an inner wrapper.
3. `src/features/shared/config/legacy-redirects.test.ts`: the discography anchors are hardcoded. Import the section ids from `release-groups.ts`.
4. `src/pages/news.astro`: `getReleaseLinks` is called only for its build-time slug check. Make that check explicit.
5. The Discogs artist id `162295` is duplicated in `discogs.ts` and `site.ts`. Keep one source.
6. `release-format.ts` `typeInSentence`: document the lowercasing rule and test more labels.

## Content the owner needs to supply or check

- Photo captions: who is who in `03.jpg`, `Ophoi+concert10.jpg`, and the Tau Ceti and Klaus Wiese photos (`src/content/photos/*.json`).
- Memorial: tributes and messages for the placeholder section.
- "The Dreams Of Shells" or "The Dreaming Of Shells": which title is correct. Databloem sells it as "The Dreaming Of Shells".
- Featured releases on the home page (`src/features/home/featured-releases.ts`).
- Review the copy rewrites in `docs/copy-changes.md`.

## Release enrichment follow-ups

`pnpm enrich` built `docs/enrichment-report.md` from Discogs, Bandcamp and Databloem. `--apply` filled the empty fields and replaced the 90px covers. What is left:

- Conflicts: 21 hand-edited values differ from Discogs (mostly `Album` against `CDr, Album`, plus the tracklists of lightnoise, world-of-shadows and calm-dream). Decide each one in the release JSON.
- Notes: Discogs notes are proposed for 144 releases and were not applied. Copy only the useful ones.
- EP Collection covers (vol. 1–5, 7, 9): the only Discogs images are about 200px, so they still use the legacy thumbnails. Find better scans.
- Missing releases: Penumbra Recollected 1–4, Signals From The Great Beyond 2 and 3, Celestial Geometries 2, The Dreaming Waters and The November Earth are on Bandcamp or Databloem but not on the site.
- Ambiguous matches: Signals From The Great Beyond (vol. 1), and Time Fragments vol. 1 and vol. 3 on Databloem, whose subtitles differ.
- Production domain: set `SITE_URL`.
