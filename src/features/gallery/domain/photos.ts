// Container-side access to the `photos` collection; grouping lives in photo-groups.ts.
import { getCollection, type CollectionEntry } from "astro:content";
import { groupPhotos, type PhotoGroup } from "./photo-groups";

export type Photo = CollectionEntry<"photos">["data"] & { id: string };

export async function getPhotoGroups(): Promise<PhotoGroup<Photo>[]> {
  const entries = await getCollection("photos");
  return groupPhotos(entries.map(({ id, data }) => ({ ...data, id })));
}
