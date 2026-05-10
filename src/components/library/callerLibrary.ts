import type { MyShowEntry, WatchedEntry } from "@/api/types";

/** Per-show caller-relative state, keyed in `CallerLibrary` by show id.
 * Used by the friend library views (NEU-120) to render the action button,
 * the my-relationship indicator (NEU-128), and the my-relationship filter
 * (NEU-129). For NEU-127 only `in_my_shows` is consumed; the watched counts
 * are populated for downstream tickets. */
export interface CallerShowState {
  in_my_shows: boolean;
  watched_episode_count?: number;
  aired_episode_count?: number;
}

export type CallerLibrary = Map<number, CallerShowState>;

/** Build a lookup of the caller's own relationship to each show, sourced from
 * `useMyShows()` and (optionally) `useMyWatched()`. Either source may be
 * missing while still loading; the result reflects what's known. */
export function buildCallerLibrary(
  myShows?: MyShowEntry[],
  myWatched?: WatchedEntry[],
): CallerLibrary {
  const map: CallerLibrary = new Map();
  for (const e of myShows ?? []) {
    map.set(e.show.id, {
      in_my_shows: true,
      watched_episode_count: e.watched_episode_count,
      aired_episode_count: e.aired_episode_count,
    });
  }
  for (const e of myWatched ?? []) {
    // myShows is canonical for `in_my_shows` — don't overwrite it from the
    // watched feed (which carries the friend's `in_my_shows` for friend rows).
    if (map.has(e.show.id)) continue;
    map.set(e.show.id, {
      in_my_shows: e.in_my_shows,
      watched_episode_count: e.watched_episode_count,
      aired_episode_count: e.aired_episode_count,
    });
  }
  return map;
}
