import type { WatchNextEntry, WatchNextSort } from "@/api/types";

export const WATCH_NEXT_SORTS: { key: WatchNextSort; label: string }[] = [
  { key: "last_aired_desc", label: "Last Aired" },
  { key: "last_watched_desc", label: "Last Watched" },
  { key: "oldest_unwatched_asc", label: "Oldest Unwatched" },
  { key: "newest_unwatched_desc", label: "Newest Unwatched" },
  { key: "added_desc", label: "Recently Added" },
  { key: "name_asc", label: "Show Title" },
];

export const WATCH_NEXT_SORT_KEYS = WATCH_NEXT_SORTS.map((s) => s.key);

const nameKey = (s: string) => s.toLowerCase().replace(/^(the|a|an)\s+/i, "");

export function compareWatchNextEntries(
  a: WatchNextEntry,
  b: WatchNextEntry,
  sort: WatchNextSort,
): number {
  const tiebreak = nameKey(a.show.name).localeCompare(nameKey(b.show.name));
  const cmpNullable = (
    av: string | null | undefined,
    bv: string | null | undefined,
    desc: boolean,
  ) => {
    if (!av && !bv) return tiebreak;
    if (!av) return 1;
    if (!bv) return -1;
    return desc ? bv.localeCompare(av) : av.localeCompare(bv);
  };
  switch (sort) {
    case "last_aired_desc":
      return cmpNullable(a.last_aired, b.last_aired, true) || tiebreak;
    case "last_watched_desc":
      return cmpNullable(a.last_watched_at, b.last_watched_at, true) || tiebreak;
    case "oldest_unwatched_asc":
      return cmpNullable(a.episode.airdate, b.episode.airdate, false) || tiebreak;
    case "newest_unwatched_desc":
      return cmpNullable(a.episode.airdate, b.episode.airdate, true) || tiebreak;
    case "added_desc":
      return cmpNullable(a.added_at, b.added_at, true) || tiebreak;
    case "name_asc":
      return tiebreak;
  }
}
