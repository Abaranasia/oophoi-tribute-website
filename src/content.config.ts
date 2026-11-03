import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { RELEASE_TYPES } from "./features/discography/domain/release-types";
import { PHOTO_GROUP_IDS } from "./features/gallery/domain/photo-groups";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// m:ss, mm:ss or h:mm:ss
const durationRegex = /^(?:\d{1,2}:)?\d{1,2}:\d{2}$/;

// One JSON file per release. These files are edited by hand and are the source of truth;
// they were imported once from the legacy site (see README).
const releasesCollection = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/releases" }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1),
      slug: z.string().regex(slugRegex),
      type: z.enum(RELEASE_TYPES),
      // Main credited artist; Klaus Wiese for the KW remasters.
      artist: z.string().default("Oöphoi"),
      year: z.number().int().min(1990).max(2030),
      labels: z
        .array(
          z.object({
            name: z.string().min(1),
            discogsUrl: z.url().optional(),
          }),
        )
        .default([]),
      catalogNo: z.string().optional(),
      format: z.string().optional(),
      credit: z
        .object({
          alias: z.string().optional(),
          with: z.array(z.string()).default([]),
        })
        .default({ with: [] }),
      discogs: z.object({
        kind: z.enum(["master", "release"]),
        id: z.number().int().positive(),
        versions: z.number().int().positive().optional(),
      }),
      cover: image().optional(),
      tracks: z
        .array(
          z.object({
            title: z.string().min(1),
            duration: z.string().regex(durationRegex).optional(),
            with: z.array(z.string()).optional(),
          }),
        )
        .optional(),
      note: z.string().optional(),
      // Slugs of other releases; unknown slugs are ignored at render time.
      relatedTo: z.array(z.string().regex(slugRegex)).optional(),
      hidden: z.boolean().default(false),
    }),
});

// News posts carried over from the legacy site, one Markdown file per post.
const newsCollection = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/news" }),
  schema: z.object({
    title: z.string().min(1),
    // The legacy posts give a month only; it is stored as the first day of that month.
    date: z.coerce.date(),
    summary: z.string().min(1),
    // Release pages linked under the post; unknown slugs fail the build.
    releases: z.array(z.string().regex(slugRegex)).default([]),
  }),
});

// One JSON file per gallery photo.
const photosCollection = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/photos" }),
  schema: ({ image }) =>
    z.object({
      src: image(),
      alt: z.string().min(1),
      caption: z.string().min(1),
      // Who is in the photo, as credited on the legacy site.
      people: z.array(z.string().min(1)).default([]),
      group: z.enum(PHOTO_GROUP_IDS),
      // Position inside its group.
      order: z.number().int().positive(),
      // File name on the 2013 site, for provenance.
      legacyFile: z.string().optional(),
    }),
});

export const collections = {
  releases: releasesCollection,
  news: newsCollection,
  photos: photosCollection,
};
