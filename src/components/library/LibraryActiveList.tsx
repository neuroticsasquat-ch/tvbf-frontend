import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUp, Check, Plus } from "lucide-react";
import { useAddShow, useRemoveShow } from "@/api/me";
import type { MyShowEntry } from "@/api/types";
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { usePersistedString } from "@/hooks/usePersistedString";
import { usePersistedView } from "@/hooks/usePersistedView";
import { WatchProgressBar } from "@/components/WatchProgressBar";
import { ViewToggle } from "@/components/ViewToggle";
import { MyShowCard } from "@/components/MyShowCard";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/cn";
import { callerHasShow, type CallerLibrary } from "./callerLibrary";
import { matchesCallerMembership, matchesCallerWatchState } from "./callerFilters";
import { CallerPosterBadge, CallerProgressNote } from "./LibraryRowIndicators";

// On Active tabs the In My Shows filter is inert end-to-end: `In My Shows` is
// a no-op (every Active row is in My Shows by definition) and `Not in My
// Shows` would always be empty. Disable the whole picker (NEU-131).
const IN_MY_SHOWS_DISABLED_REASON = "All Active shows are in My Shows.";

export type ViewerContext = "self" | "friend";

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
}

export function LibraryActiveList({
  data,
  isLoading,
  viewerContext = "self",
  callerLibrary,
  storagePrefix = "my-shows",
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
  const [genre, setGenre] = usePersistedString(`${storagePrefix}-genre`, "all");
  const [view, setView] = usePersistedView(storagePrefix, "list");

  const filteredAndSorted = useMemo(() => {
    if (!data) return data;
    return data
      .filter((e) => watchState === "all" || watchStateOf(e) === watchState)
      .filter((e) => matchesStatus(e.show, status))
      .filter((e) => matchesGenre(e.show, genre))
      .filter((e) => matchesCallerMembership(e.show.id, callerMembership, callerLibrary))
      .filter((e) => matchesCallerWatchState(callerWatchState, e, callerLibrary))
      .sort((a, b) => compareLibraryEntries(a, b, sort));
  }, [data, sort, watchState, status, genre, callerMembership, callerWatchState, callerLibrary]);

  const sortLabel = LIBRARY_SORTS.find((s) => s.key === sort)?.label ?? "";
  const filtersActive =
    watchState !== "all" ||
    status !== "all" ||
    genre !== "all" ||
    inMyShows !== "all" ||
    callerMembership !== "all" ||
    callerWatchState !== "all";

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
        {viewerContext === "friend" && (
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
              setStatus("all");
              setInMyShows("all");
              setCallerMembership("all");
              setCallerWatchState("all");
              setGenre("all");
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
              inMyShows={
                viewerContext === "friend" ? callerHasShow(callerLibrary, entry.show.id) : true
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

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "";
  const ageDays = (Date.now() - d.getTime()) / 86_400_000;
  const includeYear = ageDays > 180;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  });
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
  const action = (
    <ActionButton entry={entry} viewerContext={viewerContext} callerLibrary={callerLibrary} />
  );

  return (
    <li className="border border-border rounded p-3 flex items-start gap-3 sm:gap-4">
      <Link
        to={`/shows/${entry.show.id}`}
        className="shrink-0 relative"
        aria-label={entry.show.name}
      >
        {entry.show.image_medium ? (
          <img
            src={entry.show.image_medium}
            alt=""
            className="w-16 aspect-[210/295] object-cover rounded"
          />
        ) : (
          <div className="w-16 aspect-[210/295] rounded bg-muted" />
        )}
        <CallerPosterBadge
          showId={entry.show.id}
          viewerContext={viewerContext}
          callerLibrary={callerLibrary}
        />
      </Link>
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
        {status === "finished" ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="px-1.5 py-0.5 rounded border border-emerald-600 text-emerald-700">
              Finished
            </span>
            {entry.last_watched_at && (
              <span className="whitespace-nowrap">
                Last Watched: {formatDate(entry.last_watched_at)}
              </span>
            )}
          </div>
        ) : (
          <>
            {entry.aired_episode_count > 0 && (
              <WatchProgressBar
                watched={entry.watched_episode_count}
                aired={entry.aired_episode_count}
                upcoming={entry.upcoming_episode_count}
                barOnly
              />
            )}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {status === "caught_up" ? (
                <span className="px-1.5 py-0.5 rounded border border-emerald-600 text-emerald-700">
                  Caught Up
                </span>
              ) : entry.aired_episode_count > 0 ? (
                <span>
                  Progress: {entry.watched_episode_count}/{entry.aired_episode_count}
                </span>
              ) : null}
              {(status === "caught_up" || entry.aired_episode_count > 0) &&
                entry.last_watched_at && (
                  <span aria-hidden className="text-muted-foreground/50">
                    ·
                  </span>
                )}
              {entry.last_watched_at && (
                <span className="whitespace-nowrap">
                  Last Watched: {formatDate(entry.last_watched_at)}
                </span>
              )}
            </div>
            {entry.upcoming_episode_count > 0 && (
              <p className="text-xs text-muted-foreground">
                {entry.upcoming_episode_count} upcoming
              </p>
            )}
          </>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
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
 *   always Remove and clicking it optimistically hides the row.
 * - friend: row represents the friend's library; the button reflects the
 *   *caller's* relationship via `callerLibrary`. Clicking add/removes from
 *   the caller's library; the row stays visible (it's still on the friend's). */
function ActionButton({
  entry,
  viewerContext,
  callerLibrary,
}: {
  entry: MyShowEntry;
  viewerContext: ViewerContext;
  callerLibrary?: CallerLibrary;
}) {
  const add = useAddShow();
  const remove = useRemoveShow();

  // self mode: optimistic row removal on click.
  const [removed, setRemoved] = useState(false);

  // friend mode: optimistic toggle of the caller's relationship.
  const upstream = callerLibrary?.get(entry.show.id)?.in_my_shows ?? false;
  const [override, setOverride] = useState<boolean | null>(null);
  const [lastUpstream, setLastUpstream] = useState(upstream);
  if (lastUpstream !== upstream) {
    setLastUpstream(upstream);
    setOverride(null);
  }

  if (viewerContext === "self") {
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
  const inMyShows = override ?? upstream;
  function onAdd() {
    setOverride(true);
    add.mutate(entry.show.id, { onError: () => setOverride(false) });
  }
  function onRemove() {
    setOverride(false);
    remove.mutate(entry.show.id, { onError: () => setOverride(true) });
  }
  return inMyShows ? (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onRemove}
      disabled={remove.isPending}
      aria-label="Remove from My Shows"
      className={cn(
        "h-7 px-2 gap-1 text-xs",
        "border-emerald-600 text-emerald-700 hover:bg-emerald-50",
        "dark:text-emerald-400 dark:hover:bg-emerald-950/40",
      )}
    >
      <Check className="h-3.5 w-3.5" aria-hidden />
      My Shows
    </Button>
  ) : (
    <Button
      type="button"
      size="sm"
      onClick={onAdd}
      disabled={add.isPending}
      aria-label="Add to My Shows"
      className="h-7 px-2 gap-1 text-xs"
    >
      <Plus className="h-3.5 w-3.5" aria-hidden />
      My Shows
    </Button>
  );
}
