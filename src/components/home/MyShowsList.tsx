import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { useMyShows, useRemoveShow } from "@/api/me";
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
  ClearFiltersButton,
  GenreFilter,
  ShowStatusFilterPicker,
  WatchStateFilter,
} from "@/components/home/FilterPickers";
import {
  SHOW_STATUS_KEYS,
  WATCH_STATE_KEYS,
  matchesGenre,
  matchesStatus,
  watchStateOf,
  type ShowStatusFilter,
  type WatchState,
} from "@/components/home/filterTypes";
import {
  MY_SHOWS_SORTS,
  MY_SHOWS_SORT_KEYS,
  compareMyShowEntries,
  type MyShowsTabSort,
} from "@/components/home/myShowsSort";

export function MyShowsList() {
  const [sort, setSort] = usePersistedSort<MyShowsTabSort>(
    "my-shows",
    MY_SHOWS_SORT_KEYS,
    "name_asc",
  );
  const [watchState, setWatchState] = usePersistedSort<WatchState>(
    "my-shows-watch-state",
    WATCH_STATE_KEYS,
    "all",
  );
  const [status, setStatus] = usePersistedSort<ShowStatusFilter>(
    "my-shows-status",
    SHOW_STATUS_KEYS,
    "all",
  );
  const [genre, setGenre] = usePersistedString("my-shows-genre", "all");
  const [view, setView] = usePersistedView("my-shows", "list");

  const { data, isLoading } = useMyShows();
  const filteredAndSorted = useMemo(() => {
    if (!data) return data;
    return data
      .filter((e) => watchState === "all" || watchStateOf(e) === watchState)
      .filter((e) => matchesStatus(e.show, status))
      .filter((e) => matchesGenre(e.show, genre))
      .sort((a, b) => compareMyShowEntries(a, b, sort));
  }, [data, sort, watchState, status, genre]);

  const sortLabel = MY_SHOWS_SORTS.find((s) => s.key === sort)?.label ?? "";

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
          options={MY_SHOWS_SORTS}
          value={sort}
          onChange={setSort}
        />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <WatchStateFilter value={watchState} onChange={setWatchState} />
        <ShowStatusFilterPicker value={status} onChange={setStatus} />
        <GenreFilter value={genre} onChange={setGenre} />
        {(watchState !== "all" || status !== "all" || genre !== "all") && (
          <ClearFiltersButton
            onClear={() => {
              setWatchState("all");
              setStatus("all");
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
            <MyShowCard key={entry.show.id} entry={entry} />
          ))}
        </div>
      )}
      {!isLoading && filteredAndSorted && filteredAndSorted.length > 0 && view === "list" && (
        <ul className="space-y-3">
          {filteredAndSorted.map((entry) => (
            <MyShowsRow key={entry.show.id} entry={entry} />
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

function MyShowsRow({ entry }: { entry: MyShowEntry }) {
  const remove = useRemoveShow();
  // Local override so the row visually reflects "removed" the moment the user
  // clicks, even before the server round trip lands.
  const [removed, setRemoved] = useState(false);
  if (removed) return null;

  // Mirrors the Watched view's "finished" predicate (NEU-101 decision 2):
  // show is over AND user is fully caught up.
  const isFinished =
    entry.aired_episode_count > 0 &&
    entry.watched_episode_count >= entry.aired_episode_count &&
    (entry.show.status ?? "") === "Ended";

  function onRemove() {
    setRemoved(true);
    remove.mutate(entry.show.id, {
      onError: () => setRemoved(false),
    });
  }

  return (
    <li className="border border-border rounded p-3 flex items-start gap-3 sm:gap-4">
      <Link
        to={`/shows/${entry.show.id}`}
        className="shrink-0"
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
        {isFinished ? (
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
              {entry.aired_episode_count > 0 && (
                <span>
                  Progress: {entry.watched_episode_count}/{entry.aired_episode_count}
                </span>
              )}
              {entry.aired_episode_count > 0 && entry.last_watched_at && (
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
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRemove}
            disabled={remove.isPending}
            aria-label="Remove from My Shows"
            className="h-7 px-2 gap-1 text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            My Shows
          </Button>
        </div>
      </div>
    </li>
  );
}
