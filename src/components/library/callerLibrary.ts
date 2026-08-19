import type { MyShowEntry, WatchedEntry } from "@/api/types";
import type { ViewerContext } from "./viewerContext";

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

/** Whether the caller has this show in their own My Shows. False when no
 * relationship is known. */
export function callerHasShow(library: CallerLibrary | undefined, showId: number): boolean {
  return library?.get(showId)?.in_my_shows ?? false;
}

/** The caller's "You: x/y" affordance for a friend row: rendered whenever the
 * caller has watched at least one episode of this show, regardless of whether
 * they also have it in their own My Shows. Showing it alongside the green ✓
 * gives a direct vs-the-friend progress comparison ("they're 10/10, I'm 3/10
 * — spoiler risk"). Returns null when the caller has no progress to report. */
export function callerProgress(
  library: CallerLibrary | undefined,
  showId: number,
): { watched: number; aired: number } | null {
  const state = library?.get(showId);
  if (!state) return null;
  const watched = state.watched_episode_count ?? 0;
  if (watched <= 0) return null;
  return { watched, aired: state.aired_episode_count ?? 0 };
}

/** Whether a list-view poster carries the "in My Shows" mark: friend mode, and
 * the caller actually has the show in their own My Shows. Suppressed for self
 * mode (their own library already implies tracking) or when no caller
 * relationship exists.
 *
 * It **answers with a boolean rather than drawing the mark**, which it did
 * until NEU-1183. The mark is `InMyShowsBadge` either way — it used to be a
 * green ✓ drawn here, one of the three separate definitions NEU-1057 unified —
 * but its *corner* is now `ShowPoster`'s to assign, so the gating logic that
 * belongs to the friend surfaces stays here and the placement that belongs to
 * every surface stays there.
 */
export function callerPosterMark(
  showId: number,
  viewerContext: ViewerContext,
  callerLibrary?: CallerLibrary,
): boolean {
  if (viewerContext.kind !== "friend") return false;
  return callerHasShow(callerLibrary, showId);
}

/** **The viewer's own** relationship to one row of a library — resolved, so the
 * card and the row take an answer rather than the sources (NEU-1176's seam,
 * which `MyShowCard` already applies to `ratingOwner`).
 *
 * It exists because NEU-1188 made a grid card carry the same controls its list
 * row does, and the two were computing that relationship separately: the
 * Watched grid inlined the `viewerContext`/`callerLibrary` pick that `WatchedRow`
 * also inlined, and the Active grid computed nothing at all, which is why its
 * friend mode had neither the button nor the comparison. One function per tab
 * rather than one shared one, because the two tabs answer *membership* from
 * different places — see each below.
 */
export interface CallerRelationship {
  /** Whether the **viewer** tracks this show. Never the row owner's membership. */
  inMyShows: boolean;
  /** The viewer's own progress, for the `You: x/y` comparison. Null on the
   * viewer's own library, where there is nobody to compare against. */
  progress: { watched: number; aired: number } | null;
}

/** The Active tab's answer — **null in self mode**, and that is the whole
 * shape of the tab: every Active row is in My Shows by definition, so there is
 * no add to offer and no comparison to draw. Its one control is the compact
 * remove chip on the poster (NEU-1187 §3.1), which both views already carry.
 * Friend mode is where adding is possible, so it gets the labelled button and
 * the comparison — in both views, which is what NEU-1188 AC 3 fixes.
 */
export function activeCallerRelationship(
  showId: number,
  viewerContext: ViewerContext,
  callerLibrary?: CallerLibrary,
): CallerRelationship | null {
  if (viewerContext.kind !== "friend") return null;
  return {
    inMyShows: callerHasShow(callerLibrary, showId),
    progress: callerProgress(callerLibrary, showId),
  };
}

/** The Watched tab's answer — **never null**, because membership genuinely
 * varies there in both modes: a show in your watch history need not be in your
 * My Shows, which is the whole reason `WatchedEntry` carries `in_my_shows` and
 * the tab offers an In-My-Shows filter.
 *
 * Self mode reads `entry.in_my_shows`, which is the caller's own relationship.
 * Friend mode must *not*: the friend endpoint reports the friend's relationship
 * in that field, so the viewer's comes from their own library instead.
 *
 * The same boolean drives the poster mark and the button, which is what makes
 * them incapable of contradicting each other — and it is why the mark now
 * appears on Watched in both views (NEU-1188 AC 6) where `callerPosterMark`
 * hard-returned `false` in self mode. That suppression is right on Active, for
 * the reason above, and wrong here.
 */
export function watchedCallerRelationship(
  entry: WatchedEntry,
  viewerContext: ViewerContext,
  callerLibrary?: CallerLibrary,
): CallerRelationship {
  if (viewerContext.kind !== "friend") {
    return { inMyShows: entry.in_my_shows, progress: null };
  }
  return {
    inMyShows: callerHasShow(callerLibrary, entry.show.id),
    progress: callerProgress(callerLibrary, entry.show.id),
  };
}
