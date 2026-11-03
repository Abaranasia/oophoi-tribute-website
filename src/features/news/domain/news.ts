// Container-side access to the `news` collection.
import { getCollection, type CollectionEntry } from "astro:content";

export type NewsPost = CollectionEntry<"news">;

/** All posts, newest first. */
export async function getNewsPosts(): Promise<NewsPost[]> {
  const posts = await getCollection("news");
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}
