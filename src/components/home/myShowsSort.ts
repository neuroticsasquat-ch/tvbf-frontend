import type { MyShowEntry } from "@/api/types";

export type MyShowsTabSort =
  | "name_asc"
  | "last_watched_desc"
  | "last_aired_desc"
  | "premiered_asc"
  | "premiered_desc"
  | "added_desc";

export const MY_SHOWS_SORTS: { key: MyShowsTabSort; label: string }[] = [
  { key: "name_asc", label: "Show Title" },
  { key: "last_watched_desc", label: "Last Watched" },
  { key: "last_aired_desc", label: "Last Aired" },
  { key: "premiered_asc", label: "Premiered First" },
  { key: "premiered_desc", label: "Premiered Last" },
  { key: "added_desc", label: "Recently Added" },
];

export const MY_SHOWS_SORT_KEYS = MY_SHOWS_SORTS.map((s) => s.key);

const nameKey = (s: string) => s.toLowerCase().replace(/^(the|a|an)\s+/i, "");

export function compareMyShowEntries(
  a: MyShowEntry,
  b: MyShowEntry,
  sort: MyShowsTabSort,
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
    case "name_asc":
      return tiebreak;
    case "last_watched_desc":
      return cmpNullable(a.last_watched_at, b.last_watched_at, true) || tiebreak;
    case "last_aired_desc":
      return cmpNullable(a.last_aired, b.last_aired, true) || tiebreak;
    case "premiered_asc":
      return cmpNullable(a.show.premiered, b.show.premiered, false) || tiebreak;
    case "premiered_desc":
      return cmpNullable(a.show.premiered, b.show.premiered, true) || tiebreak;
    case "added_desc":
      return cmpNullable(a.added_at, b.added_at, true) || tiebreak;
  }
}
