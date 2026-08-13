import type { ShowSummary } from "@/api/types";

export type WatchState = "all" | "watching" | "not_started" | "caught_up" | "finished";
export type ShowStatusFilter =
  "all" | "returning_series" | "ended" | "canceled" | "in_production" | "planned";
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

export const RATED_FILTER_KEYS = ["all", "rated"] as const;
export type RatedFilter = (typeof RATED_FILTER_KEYS)[number];

/** The catalog status a filter key selects, verbatim as TMDB stores it
 * (NEU-1031 D1: we store TMDB's string and do not translate it). This is both
 * the `?status=` value the browse API exact-matches and the string
 * `matchesStatus` compares client-side — one table so the two cannot drift.
 *
 * The five values are the complete vocabulary, confirmed against 754 resolved
 * shows in NEU-1032's sweep. TV Maze's `To Be Determined` has no counterpart
 * and is gone: it scattered across all five rather than mapping to any one. */
export const SHOW_STATUS_API_VALUE: Record<ShowStatusFilter, string | undefined> = {
  all: undefined,
  returning_series: "Returning Series",
  ended: "Ended",
  canceled: "Canceled",
  in_production: "In Production",
  planned: "Planned",
};

export const SHOW_STATUSES: { key: ShowStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "returning_series", label: "Returning Series" },
  { key: "ended", label: "Ended" },
  { key: "canceled", label: "Canceled" },
  { key: "in_production", label: "In Production" },
  { key: "planned", label: "Planned" },
];
export const SHOW_STATUS_KEYS = SHOW_STATUSES.map((s) => s.key);

/** Whether a show is over. TMDB splits what TV Maze called `Ended` into
 * `Ended` and `Canceled`, so a straight `status === "Ended"` port would read
 * every canceled show as still running — breaking "finished" for exactly the
 * shows most likely to be finished (NEU-1031 D1). Every over-ness test goes
 * through here. */
export function isEndedStatus(status: string | null | undefined): boolean {
  return status === "Ended" || status === "Canceled";
}

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
    return isEndedStatus(entry.show.status) ? "finished" : "caught_up";
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
  // Exact match, not a case-folded one: the catalog stores TMDB's string
  // verbatim and the browse API matches it exactly, so the client-side filter
  // has to agree with the server-side one character for character.
  return show.status === SHOW_STATUS_API_VALUE[filter];
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
