import type { MyShowEntry, WatchedEntry } from "@/api/types";

export type LibrarySort =
  | "name_asc"
  | "last_watched_desc"
  | "last_aired_desc"
  | "premiered_asc"
  | "premiered_desc"
  | "added_desc"
  | "first_watched_desc"
  | "my_rating_desc"
  | "my_rating_asc";

export const LIBRARY_SORTS: { key: LibrarySort; label: string }[] = [
  { key: "name_asc", label: "Show Title" },
  { key: "last_watched_desc", label: "Last Watched" },
  { key: "last_aired_desc", label: "Last Aired" },
  { key: "premiered_asc", label: "Premiered First" },
  { key: "premiered_desc", label: "Premiered Last" },
  { key: "added_desc", label: "Recently Added" },
  { key: "first_watched_desc", label: "First Watched" },
  { key: "my_rating_desc", label: "My Rating, High → Low" },
  { key: "my_rating_asc", label: "My Rating, Low → High" },
];

export const LIBRARY_SORT_KEYS = LIBRARY_SORTS.map((s) => s.key);

/** Union of the row shapes used by MyShows and All Watched. The shared sort
 * comparator works against this and treats fields the row doesn't expose as
 * null (sorts to bottom). */
export type LibraryEntry = MyShowEntry | WatchedEntry;

const nameKey = (s: string) => s.toLowerCase().replace(/^(the|a|an)\s+/i, "");

function fromEntry<K extends string>(entry: LibraryEntry, key: K): unknown {
  return (entry as unknown as Record<K, unknown>)[key];
}

function getString(entry: LibraryEntry, key: string): string | null {
  const v = fromEntry(entry, key);
  return typeof v === "string" ? v : null;
}

function ratingOf(entry: LibraryEntry): number | null {
  // MyShowEntry carries my_rating at the top level (hydrated by /me/shows).
  // WatchedEntry doesn't surface it today — treat as unrated.
  return "my_rating" in entry ? (entry.my_rating ?? null) : null;
}

function compareRating(a: LibraryEntry, b: LibraryEntry, desc: boolean): number {
  const av = ratingOf(a);
  const bv = ratingOf(b);
  // Unrated (null/undefined) rows sink to the bottom in both directions.
  if (av === null && bv === null) return 0;
  if (av === null) return 1;
  if (bv === null) return -1;
  return desc ? bv - av : av - bv;
}

function compareNullable(a: string | null, b: string | null, desc: boolean): number {
  // Null falls to the bottom in either direction.
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return desc ? b.localeCompare(a) : a.localeCompare(b);
}

export function compareLibraryEntries(a: LibraryEntry, b: LibraryEntry, sort: LibrarySort): number {
  const tiebreak = nameKey(a.show.name).localeCompare(nameKey(b.show.name));
  switch (sort) {
    case "name_asc":
      return tiebreak;
    case "last_watched_desc":
      return compareNullable(a.last_watched_at, b.last_watched_at, true) || tiebreak;
    case "last_aired_desc":
      return compareNullable(a.last_aired, b.last_aired, true) || tiebreak;
    case "premiered_asc":
      return compareNullable(a.show.premiered, b.show.premiered, false) || tiebreak;
    case "premiered_desc":
      return compareNullable(a.show.premiered, b.show.premiered, true) || tiebreak;
    case "added_desc":
      return compareNullable(getString(a, "added_at"), getString(b, "added_at"), true) || tiebreak;
    case "first_watched_desc":
      return (
        compareNullable(getString(a, "first_watched_at"), getString(b, "first_watched_at"), true) ||
        tiebreak
      );
    case "my_rating_desc":
      return compareRating(a, b, true) || tiebreak;
    case "my_rating_asc":
      return compareRating(a, b, false) || tiebreak;
  }
}
