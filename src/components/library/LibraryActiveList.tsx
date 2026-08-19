import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { MyShowEntry } from "@/api/types";
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { usePersistedString } from "@/hooks/usePersistedString";
import { usePersistedView } from "@/hooks/usePersistedView";
import { WatchProgressBar } from "@/components/WatchProgressBar";
import { ViewToggle } from "@/components/ViewToggle";
import { MyShowCard } from "@/components/MyShowCard";
import { ShowPoster } from "@/components/ShowPoster";
import { MyShowsButton } from "@/components/MyShowsButton";
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

  // Focus after a removal unmounts a card (NEU-1187 §3.5). `useRemoveShow`
  // filters the entry out of every `["my-shows"]` query in `onMutate`, so the
  // card is gone by the time the click settles and focus falls to `<body>` —
  // on the one surface where removing several shows in a sitting is the
  // expected use. Mirrors `RecommendedForYou` (NEU-1179 §3.4), including the
  // part that is easy to get wrong: the effect waits until the id has actually
  // left the list before moving focus, rather than running on the callback
  // alone, which keeps it correct if the list changed meanwhile.
  const resultsRef = useRef<HTMLDivElement>(null);
  const [removed, setRemoved] = useState<{ showId: number; index: number } | null>(null);

  // One reference for every card and row; the control hands its own id back.
  const onRemoved = useCallback(
    (showId: number) => {
      const index = filteredAndSorted?.findIndex((e) => e.show.id === showId) ?? -1;
      setRemoved({ showId, index: index < 0 ? 0 : index });
    },
    [filteredAndSorted],
  );

  useEffect(() => {
    if (!removed) return;
    if (filteredAndSorted?.some((e) => e.show.id === removed.showId)) return;
    const root = resultsRef.current;
    setRemoved(null);
    if (!root) return;
    const chips = root.querySelectorAll<HTMLElement>("[data-remove-from-my-shows]");
    if (chips.length > 0) {
      chips[Math.min(removed.index, chips.length - 1)].focus();
      return;
    }
    root.focus();
  }, [removed, filteredAndSorted]);

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
      {/* The results region is one focusable container across both views, so
        the post-removal focus move has somewhere to land when the last row
        goes — and one query root for the chips. `tabIndex={-1}` keeps it out
        of the tab order. */}
      <div ref={resultsRef} tabIndex={-1} className="outline-none">
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
                // The same helper the list row asks, so both views ask one
                // question (NEU-1187 §3.4). It answers `false` for self mode,
                // where this passed a literal `true` and the mark could only
                // ever be true — the always-true badge finding 2.3 names.
                inMyShows={callerPosterMark(entry.show.id, viewerContext, callerLibrary)}
                removable={viewerContext.kind === "self"}
                onRemoved={onRemoved}
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
                onRemoved={onRemoved}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** One Active row.
 *
 * **Self mode has no action row at all** (NEU-1187 §3.4). Every row on this tab
 * is in My Shows by definition, so the labelled "✓ My Shows" chip could only
 * ever say one thing while costing a full line of the tallest rows in the app.
 * Its replacement is the compact chip in the poster's bottom-right corner — the
 * position that *means* remove-only (§3.1) — and the viewer's own rating moves
 * to the poster's top-right, matching `MyShowCard` exactly. Moving the rating is
 * what makes the height drop true for a rated row too, and it is NEU-1183's
 * last holdout: grid and list disagreed about where that fact lives.
 *
 * Friend mode keeps the action row, because adding is possible there: the row
 * is the friend's, the button reflects the *caller's* relationship, and
 * clicking it leaves the row standing (it is still on the friend's list).
 */
function ActiveRow({
  entry,
  viewerContext,
  callerLibrary,
  onRemoved,
}: {
  entry: MyShowEntry;
  viewerContext: ViewerContext;
  callerLibrary?: CallerLibrary;
  onRemoved?: (showId: number) => void;
}) {
  const status = libraryStatusFor(entry);
  const owner = ratingOwnerFor(viewerContext);
  const isSelf = viewerContext.kind === "self";

  return (
    <li className="border border-border rounded p-3 flex items-start gap-3 sm:gap-4">
      <ShowPoster
        to={`/shows/${entry.show.id}`}
        src={entry.show.image_medium}
        linkLabel={entry.show.name}
        size="row"
        inMyShows={callerPosterMark(entry.show.id, viewerContext, callerLibrary)}
        // Only the viewer's own rating may occupy a poster corner; a friend's
        // stays in the group that carries their name (NEU-1182 §3.5).
        ownRating={owner.kind === "own" ? entry.my_rating : null}
        control={
          isSelf ? (
            // `true` because this row came out of the viewer's own My Shows —
            // the caller supplies the answer, per `MyShowsButton`'s contract.
            <MyShowsButton
              showId={entry.show.id}
              showName={entry.show.name}
              inMyShows
              variant="compact"
              onRemoved={onRemoved}
            />
          ) : undefined
        }
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
          // hydrates it for the friend's user id. In self mode it now sits on
          // the poster above; in friend mode it belongs to the group that
          // carries their name (NEU-1181 §6.2).
          rating={owner.kind === "own" ? null : entry.my_rating}
          lastWatchedAt={entry.last_watched_at}
        />
        {status !== "finished" && entry.upcoming_episode_count > 0 && (
          <p className="text-xs text-muted-foreground">{entry.upcoming_episode_count} upcoming</p>
        )}
        {!isSelf && (
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <CallerProgressNote
              showId={entry.show.id}
              viewerContext={viewerContext}
              callerLibrary={callerLibrary}
            />
            {/* Deriving `upstream` stays here, because the button takes the
              answer, not the sources (NEU-1176). */}
            <MyShowsButton
              showId={entry.show.id}
              showName={entry.show.name}
              inMyShows={callerHasShow(callerLibrary, entry.show.id)}
            />
          </div>
        )}
      </div>
    </li>
  );
}
