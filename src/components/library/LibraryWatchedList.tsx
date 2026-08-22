import { useMemo } from "react";
import { Link } from "react-router";
import type { MyShowEntry, WatchedEntry } from "@/api/types";
import { MyShowCard } from "@/components/MyShowCard";
import { ShowPoster } from "@/components/ShowPoster";
import { MyShowsButton } from "@/components/MyShowsButton";
import { RemoveWatchHistoryButton } from "@/components/RemoveWatchHistoryButton";
import { WatchProgressBar } from "@/components/WatchProgressBar";
import { ListingToolbar } from "@/components/home/ListingToolbar";
import {
  CallerMembershipFilterPicker,
  CallerWatchStateFilterPicker,
  ClearFiltersButton,
  GenreFilter,
  InMyShowsFilterPicker,
  ShowStatusFilterPicker,
  WatchStateFilter,
} from "@/components/home/FilterPickers";
import {
  IN_MY_SHOWS_KEYS,
  SHOW_STATUS_KEYS,
  WATCH_STATE_KEYS,
  libraryStatusFor,
  matchesGenre,
  matchesStatus,
  watchStateOf,
  type InMyShowsFilter,
  type ShowStatusFilter,
  type WatchState,
} from "@/components/home/filterTypes";
import {
  LIBRARY_SORTS,
  LIBRARY_SORT_KEYS,
  compareLibraryEntries,
  type LibrarySort,
} from "@/components/home/librarySort";
import { useFocusAfterRemoval } from "@/hooks/useFocusAfterRemoval";
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { usePersistedString } from "@/hooks/usePersistedString";
import { usePersistedView } from "@/hooks/usePersistedView";
import { OwnerFacts } from "@/components/OwnerFacts";
import { watchedCallerRelationship, type CallerLibrary } from "./callerLibrary";
import { matchesCallerMembership, matchesCallerWatchState } from "./callerFilters";
import { CallerProgressNote } from "./LibraryRowIndicators";
import { SELF, ratingOwnerFor, type ViewerContext } from "./viewerContext";
import { watchedEmptyMessage } from "./emptyStates";

// Disabled options on All Watched per NEU-121:
// - Watch State: "Not Started" — every entry has at least one watched episode.
// - Sort: "Recently Added" — added_at not exposed on WatchedEntry.
const DISABLED_WATCH_STATES: Partial<Record<WatchState, string>> = {
  not_started: "All shows in watch history have at least one watched episode.",
};
const DISABLED_SORTS: Partial<Record<LibrarySort, string>> = {
  added_desc: "Available on the Active tab.",
};

/** Module scope so it is one stable reference across renders — it lands in
 * `useFocusAfterRemoval`'s effect dependencies. */
const showIdOf = (e: WatchedEntry) => e.show.id;

interface Props {
  data: WatchedEntry[] | undefined;
  isLoading: boolean;
  isError?: boolean;
  /** Whose library this is. Drives action-button shape, indicator visibility,
   * and whether the Watch History trash button is shown. */
  viewerContext?: ViewerContext;
  /** Caller's own library, used by friend mode to drive the action button (NEU-127)
   * and downstream by my-relationship indicators (NEU-128) and filter (NEU-129). */
  callerLibrary?: CallerLibrary;
  /** localStorage key namespace. Defaults to `"watched"` so existing self-library
   * prefs keep working. Friend variants pass e.g. `"friend-watched"`. */
  storagePrefix?: string;
}

export function LibraryWatchedList({
  data,
  isLoading,
  isError,
  viewerContext = SELF,
  callerLibrary,
  storagePrefix = "watched",
}: Props) {
  const [sort, setSort] = usePersistedSort<LibrarySort>(
    `${storagePrefix}-sort`,
    LIBRARY_SORT_KEYS,
    "last_watched_desc",
  );
  const [watchState, setWatchState] = usePersistedSort<WatchState>(
    `${storagePrefix}-watch-state`,
    WATCH_STATE_KEYS,
    "all",
  );
  const [showStatus, setShowStatus] = usePersistedSort<ShowStatusFilter>(
    `${storagePrefix}-show-status`,
    SHOW_STATUS_KEYS,
    "all",
  );
  const [inMyShows, setInMyShows] = usePersistedSort<InMyShowsFilter>(
    `${storagePrefix}-in-my-shows`,
    IN_MY_SHOWS_KEYS,
    "all",
  );
  const [callerMembership, setCallerMembership] = usePersistedSort<InMyShowsFilter>(
    `${storagePrefix}-caller-membership`,
    IN_MY_SHOWS_KEYS,
    "all",
  );
  const [callerWatchState, setCallerWatchState] = usePersistedSort<WatchState>(
    `${storagePrefix}-caller-watch-state`,
    WATCH_STATE_KEYS,
    "all",
  );
  const [genre, setGenre] = usePersistedString(`${storagePrefix}-genre`, "all");
  const [view, setView] = usePersistedView(storagePrefix, "list");

  const filteredAndSorted = useMemo(() => {
    if (!data) return data;
    return data
      .filter((e) => watchState === "all" || watchStateOf(e) === watchState)
      .filter((e) => matchesStatus(e.show, showStatus))
      .filter((e) => matchesGenre(e.show, genre))
      .filter((e) => {
        if (inMyShows === "all") return true;
        if (inMyShows === "in") return e.in_my_shows;
        return !e.in_my_shows;
      })
      .filter((e) => matchesCallerMembership(e.show.id, callerMembership, callerLibrary))
      .filter((e) => matchesCallerWatchState(callerWatchState, e, callerLibrary))
      .sort((a, b) => compareLibraryEntries(a, b, sort));
  }, [
    data,
    sort,
    watchState,
    showStatus,
    genre,
    inMyShows,
    callerMembership,
    callerWatchState,
    callerLibrary,
  ]);

  // Focus after a watch-history removal unmounts a row or card (NEU-1193).
  // `useRemoveFromHistory` filters the entry out of every `["my-watched"]`
  // query in `onMutate`, so the control is gone before the request settles and
  // focus falls to `<body>` — three histories in a sitting meant three trips
  // back through the page from the top. Same hook as the Active tab and the
  // recommendations grid, and no empty selector: when the last entry goes, the
  // results container itself takes focus.
  const { containerRef: resultsRef, onRemoved } = useFocusAfterRemoval<
    WatchedEntry,
    HTMLDivElement
  >(filteredAndSorted, showIdOf, "[data-remove-watch-history]");

  const filtersActive =
    watchState !== "all" ||
    showStatus !== "all" ||
    genre !== "all" ||
    inMyShows !== "all" ||
    callerMembership !== "all" ||
    callerWatchState !== "all";

  return (
    <div>
      <ListingToolbar
        view={{ value: view, onChange: setView, ariaLabel: "Watched display" }}
        sort={{
          label: "Watched",
          options: LIBRARY_SORTS.map((o) => ({ ...o, disabledReason: DISABLED_SORTS[o.key] })),
          value: sort,
          onChange: setSort,
        }}
        filters={
          <>
            <WatchStateFilter
              value={watchState}
              onChange={setWatchState}
              disabledOptions={DISABLED_WATCH_STATES}
            />
            <ShowStatusFilterPicker value={showStatus} onChange={setShowStatus} />
            <InMyShowsFilterPicker value={inMyShows} onChange={setInMyShows} />
            {viewerContext.kind === "friend" && (
              <>
                <CallerMembershipFilterPicker
                  value={callerMembership}
                  onChange={setCallerMembership}
                />
                <CallerWatchStateFilterPicker
                  value={callerWatchState}
                  onChange={setCallerWatchState}
                />
              </>
            )}
            <GenreFilter value={genre} onChange={setGenre} />
            {filtersActive && (
              <ClearFiltersButton
                onClear={() => {
                  setWatchState("all");
                  setShowStatus("all");
                  setInMyShows("all");
                  setCallerMembership("all");
                  setCallerWatchState("all");
                  setGenre("all");
                }}
              />
            )}
          </>
        }
      />
      {/* One focusable container across both views, so the post-removal focus
        move has somewhere to land when the last entry goes — and one query root
        for the controls. `tabIndex={-1}` keeps it out of the tab order. Same
        shape as the Active tab's. */}
      <div ref={resultsRef} tabIndex={-1} className="outline-none">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {isError && <p className="text-sm text-destructive">Failed to load watch history.</p>}
        {!isLoading && !isError && filteredAndSorted && filteredAndSorted.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {watchedEmptyMessage(viewerContext, data?.length === 0)}
          </p>
        )}
        {!isLoading &&
          !isError &&
          filteredAndSorted &&
          filteredAndSorted.length > 0 &&
          view === "grid" && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
              {filteredAndSorted.map((entry) => (
                <WatchedCard
                  key={entry.show.id}
                  entry={entry}
                  viewerContext={viewerContext}
                  callerLibrary={callerLibrary}
                  onRemoved={onRemoved}
                />
              ))}
            </div>
          )}
        {!isLoading &&
          !isError &&
          filteredAndSorted &&
          filteredAndSorted.length > 0 &&
          view === "list" && (
            <ul className="space-y-3">
              {filteredAndSorted.map((entry) => (
                <WatchedRow
                  key={entry.show.id}
                  entry={entry}
                  viewerContext={viewerContext}
                  callerLibrary={callerLibrary}
                  onRemoved={onRemoved}
                />
              ))}
            </ul>
          )}
      </div>
    </div>
  );
}

/** Adapter so the existing `MyShowCard` (built for MyShowEntry) can render
 * WatchedEntry rows in grid view.
 *
 * It is a **pass-through**, and stayed one: `my_rating` was hard-coded `null`
 * here, which was an honest statement about a field the server did not send
 * until NEU-1191 added it to `WatchedEntry` as a top-level field with the same
 * meaning `MyShowEntry.my_rating` has — **the row owner's** rating, so a
 * friend's on a friend's library. Both payloads being structurally identical is
 * what keeps this a copy rather than a translation layer (NEU-1188 AC 4). */
function watchedToMyShowEntry(e: WatchedEntry): MyShowEntry {
  const upcoming = Math.max(0, e.total_episode_count - e.aired_episode_count);
  return {
    show: e.show,
    watched_episode_count: e.watched_episode_count,
    total_episode_count: e.total_episode_count,
    aired_episode_count: e.aired_episode_count,
    upcoming_episode_count: upcoming,
    last_aired: e.last_aired,
    last_watched_at: e.last_watched_at,
    first_watched_at: e.first_watched_at,
    next_episode: null,
    added_at: e.first_watched_at ?? new Date(0).toISOString(),
    my_rating: e.my_rating,
  };
}

/** One Watched grid card.
 *
 * Its own component rather than an inline `MyShowCard`, because the card now
 * needs the same two resolved answers `WatchedRow` needs and deriving them
 * twice is what let the two views disagree: the grid could not add a show to My
 * Shows at all, and the list never drew the library mark (NEU-1188 AC 2/6).
 *
 * **The one asymmetry NEU-1188 left open is closed here** (NEU-1193): the list
 * row's "Watch History" removal now has a counterpart, as the compact variant
 * in the poster's bottom-right corner. That is the position NEU-1187 §3.1
 * reserves for a control that can only remove, which this act always is — there
 * is no "add watch history" — so it needed a variant rather than the fifth
 * ad-hoc treatment NEU-1188 declined to invent.
 */
function WatchedCard({
  entry,
  viewerContext,
  callerLibrary,
  onRemoved,
}: {
  entry: WatchedEntry;
  viewerContext: ViewerContext;
  callerLibrary?: CallerLibrary;
  onRemoved?: (showId: number) => void;
}) {
  const caller = watchedCallerRelationship(entry, viewerContext, callerLibrary);
  return (
    <MyShowCard
      entry={watchedToMyShowEntry(entry)}
      ratingOwner={ratingOwnerFor(viewerContext)}
      // The viewer's own membership, which on this tab genuinely varies in both
      // modes — the mark and the button therefore read one boolean and cannot
      // contradict each other.
      inMyShows={caller.inMyShows}
      callerRelationship={caller}
      // Self mode only, the same guard the row applies: a friend's watch
      // history is not the viewer's to delete. The card re-checks it against
      // `ratingOwner`, so passing it in friend mode would still draw nothing.
      historyRemovable={viewerContext.kind === "self"}
      onRemoved={onRemoved}
    />
  );
}

function WatchedRow({
  entry,
  viewerContext,
  callerLibrary,
  onRemoved,
}: {
  entry: WatchedEntry;
  viewerContext: ViewerContext;
  callerLibrary?: CallerLibrary;
  onRemoved?: (showId: number) => void;
}) {
  // The same resolver the grid card asks (NEU-1188). For self,
  // `entry.in_my_shows` is the viewer's own relationship; for friend the
  // endpoint reports the *friend's* there, so the viewer's comes from their own
  // library. `MyShowsButton` takes that answer rather than the sources.
  const caller = watchedCallerRelationship(entry, viewerContext, callerLibrary);
  const owner = ratingOwnerFor(viewerContext);

  const status = libraryStatusFor(entry);
  const upcoming = Math.max(0, entry.total_episode_count - entry.aired_episode_count);

  return (
    <li className="border border-border rounded p-3 flex items-start gap-3 sm:gap-4">
      {/* Presentational — the show's name below is the row's one link
        (NEU-1190 §1). */}
      <ShowPoster
        src={entry.show.image_medium}
        size="row"
        // The viewer's own membership, not `callerPosterMark` — which
        // hard-returns `false` in self mode, correctly on Active where every
        // row is tracked by definition and wrongly here, where membership
        // varies and the tab offers a filter on it (NEU-1188 AC 6).
        inMyShows={caller.inMyShows}
        // Only the viewer's own rating may occupy a poster corner; a friend's
        // stays in the group that carries their name (NEU-1182 §3.5).
        ownRating={owner.kind === "own" ? entry.my_rating : null}
      />
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <Link
            to={`/shows/${entry.show.id}`}
            className="font-semibold hover:underline min-w-0 break-words"
          >
            {entry.show.name}
          </Link>
          {entry.show.premiered && (
            <span className="text-sm text-muted-foreground">
              ({entry.show.premiered.slice(0, 4)})
            </span>
          )}
        </div>
        {status !== "finished" && entry.aired_episode_count > 0 && (
          <WatchProgressBar
            watched={entry.watched_episode_count}
            aired={entry.aired_episode_count}
            upcoming={upcoming}
            barOnly
          />
        )}
        <OwnerFacts
          owner={owner}
          layout="inline"
          status={status}
          progress={
            status === null
              ? { watched: entry.watched_episode_count, aired: entry.aired_episode_count }
              : null
          }
          // `my_rating` is the *row owner's* rating (NEU-1191). In self mode it
          // sits on the poster above; in friend mode it belongs to the group
          // that carries their name (NEU-1181 §6.2).
          rating={owner.kind === "own" ? null : entry.my_rating}
          lastWatchedAt={entry.last_watched_at}
        />
        {status !== "finished" && upcoming > 0 && (
          <p className="text-xs text-muted-foreground">{upcoming} upcoming</p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <CallerProgressNote progress={caller.progress} />
          <MyShowsButton
            showId={entry.show.id}
            showName={entry.show.name}
            inMyShows={caller.inMyShows}
          />
          {viewerContext.kind === "self" && (
            // The labelled variant, unchanged from where this control has
            // always been: adding is possible in this action row (the My Shows
            // button beside it), so the row keeps its text (NEU-1187 §3.1).
            <RemoveWatchHistoryButton
              showId={entry.show.id}
              showName={entry.show.name}
              onRemoved={onRemoved}
            />
          )}
        </div>
      </div>
    </li>
  );
}
