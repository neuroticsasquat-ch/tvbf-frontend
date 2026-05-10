import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import { useAddShow, useRemoveFromHistory, useRemoveShow } from "@/api/me";
import type { MyShowEntry, WatchedEntry } from "@/api/types";
import { ConfirmDialog } from "@/components/connections/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { ViewToggle } from "@/components/ViewToggle";
import { MyShowCard } from "@/components/MyShowCard";
import { WatchProgressBar } from "@/components/WatchProgressBar";
import { FilterSheet } from "@/components/home/FilterSheet";
import {
  CallerMembershipFilterPicker,
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
import { cn } from "@/lib/cn";
import type { CallerLibrary } from "./callerLibrary";
import { matchesCallerMembership } from "./callerFilters";
import type { ViewerContext } from "./LibraryActiveList";
import { CallerPosterBadge, CallerProgressNote } from "./LibraryRowIndicators";

// Disabled options on All Watched per NEU-121:
// - Watch State: "Not Started" — every entry has at least one watched episode.
// - Sort: "Recently Added" — added_at not exposed on WatchedEntry.
const DISABLED_WATCH_STATES: Partial<Record<WatchState, string>> = {
  not_started: "All shows in watch history have at least one watched episode.",
};
const DISABLED_SORTS: Partial<Record<LibrarySort, string>> = {
  added_desc: "Available on the Active tab.",
};

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
  viewerContext = "self",
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
      .sort((a, b) => compareLibraryEntries(a, b, sort));
  }, [data, sort, watchState, showStatus, genre, inMyShows, callerMembership, callerLibrary]);

  const sortLabel = LIBRARY_SORTS.find((s) => s.key === sort)?.label ?? "";
  const filtersActive =
    watchState !== "all" ||
    showStatus !== "all" ||
    genre !== "all" ||
    inMyShows !== "all" ||
    callerMembership !== "all";

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
        {viewerContext === "friend" && (
          <CallerMembershipFilterPicker
            value={callerMembership}
            onChange={setCallerMembership}
          />
        )}
        <GenreFilter value={genre} onChange={setGenre} />
        {filtersActive && (
          <ClearFiltersButton
            onClear={() => {
              setWatchState("all");
              setShowStatus("all");
              setInMyShows("all");
              setCallerMembership("all");
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
              <MyShowCard
                key={entry.show.id}
                entry={watchedToMyShowEntry(entry)}
                inMyShows={
                  viewerContext === "friend"
                    ? (callerLibrary?.get(entry.show.id)?.in_my_shows ?? false)
                    : entry.in_my_shows
                }
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
 * WatchedEntry rows in grid view. The card only reads `show`, the watched/aired
 * counts, and `upcoming_episode_count` — which we derive. */
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
  };
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
  // For self, `entry.in_my_shows` is the caller's relationship. For friend, the
  // friend endpoint reports the friend's relationship there — drive the button
  // off `callerLibrary` instead.
  const upstream =
    viewerContext === "friend"
      ? (callerLibrary?.get(entry.show.id)?.in_my_shows ?? false)
      : entry.in_my_shows;

  const [override, setOverride] = useState<boolean | null>(null);
  const [lastUpstream, setLastUpstream] = useState(upstream);
  if (lastUpstream !== upstream) {
    setLastUpstream(upstream);
    setOverride(null);
  }
  const inMyShows = override ?? upstream;

  const add = useAddShow();
  const remove = useRemoveShow();
  const removeHistory = useRemoveFromHistory();
  const [confirmingRemoveHistory, setConfirmingRemoveHistory] = useState(false);

  const status = libraryStatusFor(entry);
  const upcoming = Math.max(0, entry.total_episode_count - entry.aired_episode_count);

  function onAdd() {
    setOverride(true);
    add.mutate(entry.show.id, {
      onError: () => setOverride(false),
    });
  }
  function onRemove() {
    setOverride(false);
    remove.mutate(entry.show.id, {
      onError: () => setOverride(true),
    });
  }

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
        {status !== "finished" && entry.aired_episode_count > 0 && (
          <WatchProgressBar
            watched={entry.watched_episode_count}
            aired={entry.aired_episode_count}
            upcoming={upcoming}
            barOnly
          />
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {status === "finished" ? (
            <span className="px-1.5 py-0.5 rounded border border-emerald-600 text-emerald-700">
              Finished
            </span>
          ) : status === "caught_up" ? (
            <span className="px-1.5 py-0.5 rounded border border-emerald-600 text-emerald-700">
              Caught Up
            </span>
          ) : (
            <span>
              Progress: {entry.watched_episode_count}/{entry.aired_episode_count}
            </span>
          )}
          {entry.last_watched_at && (
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
        {status !== "finished" && upcoming > 0 && (
          <p className="text-xs text-muted-foreground">{upcoming} upcoming</p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <CallerProgressNote
            showId={entry.show.id}
            viewerContext={viewerContext}
            callerLibrary={callerLibrary}
          />
          {inMyShows ? (
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
          )}
          {viewerContext === "self" && (
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
