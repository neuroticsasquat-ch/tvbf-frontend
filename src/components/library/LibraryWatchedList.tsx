import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useRemoveFromHistory } from "@/api/me";
import type { MyShowEntry, WatchedEntry } from "@/api/types";
import { ConfirmDialog } from "@/components/connections/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { ViewToggle } from "@/components/ViewToggle";
import { MyShowCard } from "@/components/MyShowCard";
import { ShowPoster } from "@/components/ShowPoster";
import { MyShowsButton } from "@/components/MyShowsButton";
import { WatchProgressBar } from "@/components/WatchProgressBar";
import { FilterSheet } from "@/components/home/FilterSheet";
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
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { usePersistedString } from "@/hooks/usePersistedString";
import { usePersistedView } from "@/hooks/usePersistedView";
import { OwnerFacts } from "@/components/OwnerFacts";
import { watchedCallerRelationship, type CallerLibrary } from "./callerLibrary";
import { matchesCallerMembership, matchesCallerWatchState } from "./callerFilters";
import { CallerProgressNote } from "./LibraryRowIndicators";
import { SELF, ratingOwnerFor, type ViewerContext } from "./viewerContext";

// Disabled options on All Watched per NEU-121:
// - Watch State: "Not Started" — every entry has at least one watched episode.
// - Sort: "Recently Added" — added_at not exposed on WatchedEntry.
const DISABLED_WATCH_STATES: Partial<Record<WatchState, string>> = {
  not_started: "All shows in watch history have at least one watched episode.",
};
const DISABLED_SORTS: Partial<Record<LibrarySort, string>> = {
  added_desc: "Available on the Active tab.",
};

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

  const sortLabel = LIBRARY_SORTS.find((s) => s.key === sort)?.label ?? "";
  const filtersActive =
    watchState !== "all" ||
    showStatus !== "all" ||
    genre !== "all" ||
    inMyShows !== "all" ||
    callerMembership !== "all" ||
    callerWatchState !== "all";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <ViewToggle value={view} onChange={setView} ariaLabel="Watched display" />
        <FilterSheet
          title="Sort Watched"
          triggerLabel={sortLabel}
          triggerIcon={
            <>
              <ArrowDown className="h-4 w-4" aria-hidden />
              <ArrowUp className="h-4 w-4 -ml-2" aria-hidden />
            </>
          }
          ariaLabel={`Sort Watched (current: ${sortLabel})`}
          options={LIBRARY_SORTS.map((o) => ({
            ...o,
            disabledReason: DISABLED_SORTS[o.key],
          }))}
          value={sort}
          onChange={setSort}
        />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <WatchStateFilter
          value={watchState}
          onChange={setWatchState}
          disabledOptions={DISABLED_WATCH_STATES}
        />
        <ShowStatusFilterPicker value={showStatus} onChange={setShowStatus} />
        <InMyShowsFilterPicker value={inMyShows} onChange={setInMyShows} />
        {viewerContext.kind === "friend" && (
          <>
            <CallerMembershipFilterPicker value={callerMembership} onChange={setCallerMembership} />
            <CallerWatchStateFilterPicker value={callerWatchState} onChange={setCallerWatchState} />
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
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load watch history.</p>}
      {!isLoading && !isError && filteredAndSorted && filteredAndSorted.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {data && data.length === 0
            ? "No watch history yet."
            : "No matches in your watch history."}
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
              />
            ))}
          </ul>
        )}
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
 * **One deliberate asymmetry remains**, and it is not this rule weakening: the
 * list row's "Watch History" removal has no counterpart here. It is a
 * destructive control behind a confirm dialog, and the ~97px card has no room
 * for a third labelled affordance — drawing an icon-only one would be a fifth
 * treatment of an act NEU-1187 spent a ticket unifying, with no placement rule
 * to put it under (`ShowPoster` exposes one control slot). NEU-1193 already
 * owns that removal path; it is the ticket to give it a card drawing.
 */
function WatchedCard({
  entry,
  viewerContext,
  callerLibrary,
}: {
  entry: WatchedEntry;
  viewerContext: ViewerContext;
  callerLibrary?: CallerLibrary;
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
    />
  );
}

function WatchedRow({
  entry,
  viewerContext,
  callerLibrary,
}: {
  entry: WatchedEntry;
  viewerContext: ViewerContext;
  callerLibrary?: CallerLibrary;
}) {
  // The same resolver the grid card asks (NEU-1188). For self,
  // `entry.in_my_shows` is the viewer's own relationship; for friend the
  // endpoint reports the *friend's* there, so the viewer's comes from their own
  // library. `MyShowsButton` takes that answer rather than the sources.
  const caller = watchedCallerRelationship(entry, viewerContext, callerLibrary);
  const owner = ratingOwnerFor(viewerContext);

  const removeHistory = useRemoveFromHistory();
  const [confirmingRemoveHistory, setConfirmingRemoveHistory] = useState(false);

  const status = libraryStatusFor(entry);
  const upcoming = Math.max(0, entry.total_episode_count - entry.aired_episode_count);

  return (
    <li className="border border-border rounded p-3 flex items-start gap-3 sm:gap-4">
      <ShowPoster
        to={`/shows/${entry.show.id}`}
        src={entry.show.image_medium}
        linkLabel={entry.show.name}
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
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmingRemoveHistory(true)}
              aria-label={`Remove ${entry.show.name} watch history`}
              className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Watch History
            </Button>
          )}
        </div>
      </div>
      {confirmingRemoveHistory && (
        <ConfirmDialog
          title="Remove from history"
          description={`Remove all watch history for ${entry.show.name}? This cannot be undone.`}
          confirmLabel="Confirm"
          destructive
          pending={removeHistory.isPending}
          onConfirm={() => {
            removeHistory.mutate({ showId: entry.show.id });
            setConfirmingRemoveHistory(false);
          }}
          onClose={() => setConfirmingRemoveHistory(false)}
        />
      )}
    </li>
  );
}
