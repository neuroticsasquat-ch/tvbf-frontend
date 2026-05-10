import type { InMyShowsFilter } from "@/components/home/filterTypes";
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
