import { watchStateOf, type InMyShowsFilter, type WatchState } from "@/components/home/filterTypes";
import { callerHasShow, type CallerLibrary } from "./callerLibrary";

/** Predicate for the caller-relative "My Library" filter (NEU-129). When the
 * filter is `"all"`, every row passes. Otherwise the row passes iff the
 * caller's relationship matches: `"in"` keeps shows in the caller's My Shows,
 * `"not_in"` keeps shows that are not. Self mode normally hides the picker
 * entirely, so the "all" short-circuit covers the no-op case. */
export function matchesCallerMembership(
  showId: number,
  filter: InMyShowsFilter,
  callerLibrary: CallerLibrary | undefined,
): boolean {
  if (filter === "all") return true;
  const has = callerHasShow(callerLibrary, showId);
  return filter === "in" ? has : !has;
}

/** Predicate for the caller-relative "My Watch State" filter (NEU-130).
 * Computes the caller's bucket via the same `watchStateOf` logic as the
 * row-side filter, sourcing watched/aired counts from `callerLibrary` and
 * falling back to the friend row's `aired_episode_count` (which is a
 * property of the show itself, not the user) when the caller has no
 * relationship. With watched=0 the caller is `not_started` — so "Not Started"
 * naturally surfaces shows the caller hasn't touched. */
export function matchesCallerWatchState(
  filter: WatchState,
  entry: {
    show: { id: number; status: string | null };
    aired_episode_count: number;
  },
  callerLibrary: CallerLibrary | undefined,
): boolean {
  if (filter === "all") return true;
  const state = callerLibrary?.get(entry.show.id);
  const watched = state?.watched_episode_count ?? 0;
  const aired = state?.aired_episode_count ?? entry.aired_episode_count;
  const callerState = watchStateOf({
    watched_episode_count: watched,
    aired_episode_count: aired,
    show: { status: entry.show.status },
  });
  return callerState === filter;
}
