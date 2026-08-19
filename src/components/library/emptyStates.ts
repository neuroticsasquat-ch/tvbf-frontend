import type { ViewerContext } from "./viewerContext";

/** What a library tab says when it has nothing to show (NEU-1190 §2).
 *
 * `LibraryActiveList` rendered one sentence for two different states — "No
 * shows match the current filters." both when filters excluded everything and
 * when the library is simply empty, including on a friend's page with every
 * picker reading "All", where it is straightforwardly false. It was the sole
 * holdout: five other lists already split the two.
 *
 * Three things are load-bearing.
 *
 * **Empty means the *unfiltered* data is empty**, `data.length === 0` — the
 * test `LibraryWatchedList` already used — not `filtersActive === false`. A
 * list can be empty *with* filters active, and the honest message there is the
 * one about the library.
 *
 * **A friend's library is attributed by name**, following NEU-1181/1182:
 * `OwnerFacts` already renders "Jeanne's rating" rather than "their rating",
 * and `viewerContext` carries the name for exactly this reason. No list was
 * viewer-aware before this, so a friend's empty Watched tab read "No watch
 * history yet." without saying whose.
 *
 * **Only the sentences that claim something about whose library it is take the
 * name.** Active's filtered message does not: the filters are the viewer's own
 * and it asserts nothing about the owner. Watched's does, because "your watch
 * history" is a false statement on a friend's page.
 *
 * Both tabs' copy lives here rather than inline in each list, because it is one
 * table across the two tabs of one page — fixing one and leaving the other
 * ambiguous one tab over is the exact inconsistency this milestone is named
 * for.
 */
export function activeEmptyMessage(viewerContext: ViewerContext, isEmpty: boolean): string {
  if (!isEmpty) return "No shows match the current filters.";
  return viewerContext.kind === "friend"
    ? `${viewerContext.name} isn't tracking any shows.`
    : "You're not tracking any shows yet.";
}

export function watchedEmptyMessage(viewerContext: ViewerContext, isEmpty: boolean): string {
  if (viewerContext.kind === "friend") {
    return isEmpty
      ? `${viewerContext.name} has no watch history yet.`
      : `No matches in ${viewerContext.name}'s watch history.`;
  }
  return isEmpty ? "No watch history yet." : "No matches in your watch history.";
}
