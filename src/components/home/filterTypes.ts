import type { ShowSummary } from "@/api/types";

export type WatchState = "all" | "watching" | "not_started" | "watched";
export type ShowStatusFilter = "all" | "running" | "ended" | "upcoming" | "tbd";

export const WATCH_STATES: { key: WatchState; label: string }[] = [
  { key: "all", label: "All" },
  { key: "watching", label: "Watching" },
  { key: "not_started", label: "Not Started" },
  { key: "watched", label: "Watched" },
];
export const WATCH_STATE_KEYS = WATCH_STATES.map((s) => s.key);

// Subset for lists where watched shows never appear (Watch Next, Upcoming).
export const ACTIVE_WATCH_STATES = WATCH_STATES.filter((s) => s.key !== "watched");

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
  upcoming_episode_count: number;
};

export function watchStateOf(entry: WatchStateInput): Exclude<WatchState, "all"> {
  if (entry.watched_episode_count === 0) return "not_started";
  if (
    entry.aired_episode_count > 0 &&
    entry.watched_episode_count >= entry.aired_episode_count &&
    entry.upcoming_episode_count === 0
  ) {
    return "watched";
  }
  return "watching";
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
