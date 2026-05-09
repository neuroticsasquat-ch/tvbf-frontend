import { useMemo } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useMyShows } from "@/api/me";
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { usePersistedString } from "@/hooks/usePersistedString";
import { usePersistedView } from "@/hooks/usePersistedView";
import { WatchProgressBar } from "@/components/WatchProgressBar";
import { ViewToggle } from "@/components/ViewToggle";
import { MyShowCard } from "@/components/MyShowCard";
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
      <div className="flex items-center justify-end gap-2 mb-4">
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
            <li key={entry.show.id}>
              <Link
                to={`/shows/${entry.show.id}`}
                className="border border-border rounded p-3 flex items-center gap-4 hover:bg-accent"
              >
                {entry.show.image_medium && (
                  <img
                    src={entry.show.image_medium}
                    alt=""
                    className="w-16 aspect-[210/295] object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg mb-1 truncate">
                    {entry.show.name}
                    {entry.show.premiered && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        ({entry.show.premiered.slice(0, 4)})
                      </span>
                    )}
                  </p>
                  <WatchProgressBar
                    watched={entry.watched_episode_count}
                    aired={entry.aired_episode_count}
                    upcoming={entry.upcoming_episode_count}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
