import type { ShowSummary } from "@/api/types";

export type WatchState = "all" | "watching" | "not_started" | "caught_up" | "finished";
export type ShowStatusFilter = "all" | "running" | "ended" | "upcoming" | "tbd";
export type InMyShowsFilter = "all" | "in" | "not_in";

export const WATCH_STATES: { key: WatchState; label: string }[] = [
  { key: "all", label: "All" },
  { key: "watching", label: "Watching" },
  { key: "not_started", label: "Not Started" },
  { key: "caught_up", label: "Caught Up" },
  { key: "finished", label: "Finished" },
];
export const WATCH_STATE_KEYS = WATCH_STATES.map((s) => s.key);

// Subset for lists where finished/caught-up shows are out of scope by
// definition (Watch Next, Upcoming).
export const ACTIVE_WATCH_STATES = WATCH_STATES.filter(
  (s) => s.key !== "caught_up" && s.key !== "finished",
);

export const IN_MY_SHOWS_FILTERS: { key: InMyShowsFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in", label: "In My Shows" },
  { key: "not_in", label: "Not in My Shows" },
];
export const IN_MY_SHOWS_KEYS = IN_MY_SHOWS_FILTERS.map((f) => f.key);

export const SHOW_STATUSES: { key: ShowStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "running", label: "Running" },
  { key: "ended", label: "Ended" },
  { key: "upcoming", label: "In Development" },
  { key: "tbd", label: "To Be Determined" },
];
export const SHOW_STATUS_KEYS = SHOW_STATUSES.map((s) => s.key);

type WatchStateInput = {
  watched_episode_count: number;
  aired_episode_count: number;
  show: { status: string | null };
};

export function watchStateOf(entry: WatchStateInput): Exclude<WatchState, "all"> {
  const watched = entry.watched_episode_count;
  const aired = entry.aired_episode_count;
  if (watched === 0) return "not_started";
  if (aired > 0 && watched >= aired) {
    // Caught up. "Finished" requires the show to be over (NEU-101 decision 2).
    return entry.show.status === "Ended" ? "finished" : "caught_up";
  }
  return "watching";
}

/** The "status pill" shown on a library row: `caught_up`, `finished`, or
 * nothing (still watching, not started). Drives the green pill on both lists. */
export function libraryStatusFor(entry: WatchStateInput): "caught_up" | "finished" | null {
  const state = watchStateOf(entry);
  return state === "caught_up" || state === "finished" ? state : null;
}

export function matchesStatus(show: ShowSummary, filter: ShowStatusFilter): boolean {
  if (filter === "all") return true;
  const showStatus = (show.status ?? "").toLowerCase();
  // "Upcoming" maps to TVMaze's "In Development" status (not yet airing).
  // "To Be Determined" is intentionally excluded — it covers shows already
  // airing whose renewal/cancellation is unsettled, not pre-air shows.
  if (filter === "upcoming") return showStatus === "in development";
  if (filter === "tbd") return showStatus === "to be determined";
  return showStatus === filter;
}

export function matchesGenre(show: ShowSummary, genre: string): boolean {
  if (genre === "all") return true;
  return show.genres.includes(genre);
}

export function genreOptions(genres: { name: string }[] | undefined) {
  const opts: { key: string; label: string }[] = [{ key: "all", label: "All" }];
  for (const g of genres ?? []) opts.push({ key: g.name, label: g.name });
  return opts;
}
