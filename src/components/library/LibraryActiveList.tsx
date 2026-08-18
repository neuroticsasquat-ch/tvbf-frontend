import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { useRemoveShow } from "@/api/me";
import type { MyShowEntry } from "@/api/types";
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { usePersistedString } from "@/hooks/usePersistedString";
import { usePersistedView } from "@/hooks/usePersistedView";
import { WatchProgressBar } from "@/components/WatchProgressBar";
import { ViewToggle } from "@/components/ViewToggle";
import { MyShowCard } from "@/components/MyShowCard";
import { ShowPoster } from "@/components/ShowPoster";
import { MyShowsButton } from "@/components/MyShowsButton";
import { Button } from "@/components/ui/button";
import { FilterSheet } from "@/components/home/FilterSheet";
import {
  CallerMembershipFilterPicker,
  CallerWatchStateFilterPicker,
  ClearFiltersButton,
  GenreFilter,
  InMyShowsFilterPicker,
  RatedOnlyFilter,
  ShowStatusFilterPicker,
  WatchStateFilter,
} from "@/components/home/FilterPickers";
import { RatingBadge } from "@/components/RatingBadge";
import {
  IN_MY_SHOWS_KEYS,
  RATED_FILTER_KEYS,
  SHOW_STATUS_KEYS,
  WATCH_STATE_KEYS,
  libraryStatusFor,
  matchesGenre,
  matchesStatus,
  watchStateOf,
  type InMyShowsFilter,
  type RatedFilter,
  type ShowStatusFilter,
  type WatchState,
} from "@/components/home/filterTypes";
import {
  LIBRARY_SORTS,
  LIBRARY_SORT_KEYS,
  compareLibraryEntries,
  type LibrarySort,
} from "@/components/home/librarySort";
import { OwnerFacts } from "@/components/OwnerFacts";
import { callerHasShow, callerPosterMark, type CallerLibrary } from "./callerLibrary";
import { matchesCallerMembership, matchesCallerWatchState } from "./callerFilters";
import { CallerProgressNote } from "./LibraryRowIndicators";
import { SELF, ratingOwnerFor, type ViewerContext } from "./viewerContext";

// On Active tabs the In My Shows filter is inert end-to-end: `In My Shows` is
// a no-op (every Active row is in My Shows by definition) and `Not in My
// Shows` would always be empty. Disable the whole picker (NEU-131).
const IN_MY_SHOWS_DISABLED_REASON = "All Active shows are in My Shows.";

interface Props {
  data: MyShowEntry[] | undefined;
  isLoading: boolean;
  /** Whose library this is. Drives action-button shape and indicator visibility. */
  viewerContext?: ViewerContext;
  /** Caller's own library, used by friend mode to drive the action button (NEU-127)
   * and downstream by my-relationship indicators (NEU-128) and filter (NEU-129). */
  callerLibrary?: CallerLibrary;
  /** localStorage key namespace for sort/filter/view persistence. Defaults to
   * `"my-shows"` so existing self-library prefs keep working. Friend variants
   * pass e.g. `"friend-active"` so they don't collide. */
  storagePrefix?: string;
  /** Fires when the rated-only filter toggles. Self-mode parents can pipe this
   * back into `useMyShows({ ratedOnly })` so the server-side filter kicks in.
   * The list also filters client-side on `my_rating`, so omitting this is safe. */
  onRatedOnlyChange?: (ratedOnly: boolean) => void;
}

export function LibraryActiveList({
  data,
  isLoading,
  viewerContext = SELF,
  callerLibrary,
  storagePrefix = "my-shows",
  onRatedOnlyChange,
}: Props) {
  const [sort, setSort] = usePersistedSort<LibrarySort>(
    storagePrefix,
    LIBRARY_SORT_KEYS,
    "name_asc",
  );
  const [watchState, setWatchState] = usePersistedSort<WatchState>(
    `${storagePrefix}-watch-state`,
    WATCH_STATE_KEYS,
    "all",
  );
  const [status, setStatus] = usePersistedSort<ShowStatusFilter>(
    `${storagePrefix}-status`,
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
  const [rated, setRated] = usePersistedSort<RatedFilter>(
    `${storagePrefix}-rated`,
    RATED_FILTER_KEYS,
    "all",
  );
  const [genre, setGenre] = usePersistedString(`${storagePrefix}-genre`, "all");
  const [view, setView] = usePersistedView(storagePrefix, "list");

  // Notify the parent so it can pass `ratedOnly` to `useMyShows`. The list
  // also applies the filter client-side below, so this is purely an
  // optimization (server-side filter shrinks the payload).
  useEffect(() => {
    onRatedOnlyChange?.(rated === "rated");
  }, [rated, onRatedOnlyChange]);

  const filteredAndSorted = useMemo(() => {
    if (!data) return data;
    return data
      .filter((e) => watchState === "all" || watchStateOf(e) === watchState)
      .filter((e) => matchesStatus(e.show, status))
      .filter((e) => matchesGenre(e.show, genre))
      .filter((e) => matchesCallerMembership(e.show.id, callerMembership, callerLibrary))
      .filter((e) => matchesCallerWatchState(callerWatchState, e, callerLibrary))
      .filter((e) => rated === "all" || (e.my_rating != null && e.my_rating > 0))
      .sort((a, b) => compareLibraryEntries(a, b, sort));
  }, [
    data,
    sort,
    watchState,
    status,
    genre,
    callerMembership,
    callerWatchState,
    callerLibrary,
    rated,
  ]);

  const sortLabel = LIBRARY_SORTS.find((s) => s.key === sort)?.label ?? "";
  const filtersActive =
    watchState !== "all" ||
    status !== "all" ||
    genre !== "all" ||
    inMyShows !== "all" ||
    callerMembership !== "all" ||
    callerWatchState !== "all" ||
    rated !== "all";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <ViewToggle value={view} onChange={setView} ariaLabel="My Shows display" />
        <FilterSheet
          title="Sort My Shows"
          triggerLabel={sortLabel}
          triggerIcon={
            <>
              <ArrowDown className="h-4 w-4" aria-hidden />
              <ArrowUp className="h-4 w-4 -ml-2" aria-hidden />
            </>
          }
          ariaLabel={`Sort My Shows (current: ${sortLabel})`}
          options={LIBRARY_SORTS}
          value={sort}
          onChange={setSort}
        />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <WatchStateFilter value={watchState} onChange={setWatchState} />
        <ShowStatusFilterPicker value={status} onChange={setStatus} />
        <InMyShowsFilterPicker
          value={inMyShows}
          onChange={setInMyShows}
          disabledReason={IN_MY_SHOWS_DISABLED_REASON}
        />
        {viewerContext.kind === "friend" && (
          <>
            <CallerMembershipFilterPicker value={callerMembership} onChange={setCallerMembership} />
            <CallerWatchStateFilterPicker value={callerWatchState} onChange={setCallerWatchState} />
          </>
        )}
        {viewerContext.kind === "self" && <RatedOnlyFilter value={rated} onChange={setRated} />}
        <GenreFilter value={genre} onChange={setGenre} />
        {filtersActive && (
          <ClearFiltersButton
            onClear={() => {
              setWatchState("all");
              setStatus("all");
              setInMyShows("all");
              setCallerMembership("all");
              setCallerWatchState("all");
              setGenre("all");
              setRated("all");
            }}
          />
        )}
      </div>
      {isLoading && <p>Loading…</p>}
      {!isLoading && filteredAndSorted && filteredAndSorted.length === 0 && (
        <p className="text-muted-foreground">No shows match the current filters.</p>
      )}
      {!isLoading && filteredAndSorted && filteredAndSorted.length > 0 && view === "grid" && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {filteredAndSorted.map((entry) => (
            <MyShowCard
              key={entry.show.id}
              entry={entry}
              ratingOwner={ratingOwnerFor(viewerContext)}
              inMyShows={
                viewerContext.kind === "friend" ? callerHasShow(callerLibrary, entry.show.id) : true
              }
            />
          ))}
        </div>
      )}
      {!isLoading && filteredAndSorted && filteredAndSorted.length > 0 && view === "list" && (
        <ul className="space-y-3">
          {filteredAndSorted.map((entry) => (
            <ActiveRow
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

function ActiveRow({
  entry,
  viewerContext,
  callerLibrary,
}: {
  entry: MyShowEntry;
  viewerContext: ViewerContext;
  callerLibrary?: CallerLibrary;
}) {
  const status = libraryStatusFor(entry);
  const owner = ratingOwnerFor(viewerContext);
  const action = (
    <ActionButton entry={entry} viewerContext={viewerContext} callerLibrary={callerLibrary} />
  );

  return (
    <li className="border border-border rounded p-3 flex items-start gap-3 sm:gap-4">
      <ShowPoster
        to={`/shows/${entry.show.id}`}
        src={entry.show.image_medium}
        linkLabel={entry.show.name}
        size="row"
        inMyShows={callerPosterMark(entry.show.id, viewerContext, callerLibrary)}
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
            upcoming={entry.upcoming_episode_count}
            barOnly
          />
        )}
        <OwnerFacts
          owner={owner}
          layout="inline"
          status={status}
          progress={
            status === null && entry.aired_episode_count > 0
              ? { watched: entry.watched_episode_count, aired: entry.aired_episode_count }
              : null
          }
          // `my_rating` is the *row owner's* rating — the friend endpoint
          // hydrates it for the friend's user id. In self mode it keeps its
          // established home in the action row below; in friend mode it belongs
          // to the group that carries their name (NEU-1181 §6.2).
          rating={owner.kind === "own" ? null : entry.my_rating}
          lastWatchedAt={entry.last_watched_at}
        />
        {status !== "finished" && entry.upcoming_episode_count > 0 && (
          <p className="text-xs text-muted-foreground">{entry.upcoming_episode_count} upcoming</p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {owner.kind === "own" && <RatingBadge kind="own" value={entry.my_rating} />}
          <CallerProgressNote
            showId={entry.show.id}
            viewerContext={viewerContext}
            callerLibrary={callerLibrary}
          />
          {action}
        </div>
      </div>
    </li>
  );
}

/** Add/Remove My Shows button. Behaves differently for self vs friend:
 * - self: row represents one of the caller's own My Shows, so the button is
 *   always Remove and clicking it optimistically hides the row. That is why
 *   this mode keeps its own copy of the markup rather than using
 *   `MyShowsButton`: what the click updates is the *row*, and handing a row's
 *   lifecycle out through the button's interface would route the revert path —
 *   the one nobody exercises by hand — through two components instead of one.
 * - friend: row represents the friend's library; the button reflects the
 *   *caller's* relationship via `callerLibrary`. Clicking add/removes from
 *   the caller's library; the row stays visible (it's still on the friend's).
 *   That is `MyShowsButton` (NEU-1176) — deriving `upstream` stays here,
 *   because the button takes the answer, not the sources. */
function ActionButton({
  entry,
  viewerContext,
  callerLibrary,
}: {
  entry: MyShowEntry;
  viewerContext: ViewerContext;
  callerLibrary?: CallerLibrary;
}) {
  const remove = useRemoveShow();

  // self mode: optimistic row removal on click.
  const [removed, setRemoved] = useState(false);

  if (viewerContext.kind === "self") {
    if (removed) return null;
    function onRemoveSelf() {
      setRemoved(true);
      remove.mutate(entry.show.id, { onError: () => setRemoved(false) });
    }
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onRemoveSelf}
        disabled={remove.isPending}
        aria-label="Remove from My Shows"
        className="h-7 px-2 gap-1 text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
      >
        <Check className="h-3.5 w-3.5" aria-hidden />
        My Shows
      </Button>
    );
  }

  // friend mode
  const upstream = callerLibrary?.get(entry.show.id)?.in_my_shows ?? false;
  return <MyShowsButton showId={entry.show.id} inMyShows={upstream} />;
}
