import { useMemo } from "react";
import { useWatchNext } from "@/api/me";
import type { WatchNextSort } from "@/api/types";
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { usePersistedString } from "@/hooks/usePersistedString";
import { EpisodeWatchCheckbox } from "@/components/EpisodeWatchCheckbox";
import { EpisodeRow } from "@/components/home/EpisodeRow";
import { ListingToolbar } from "@/components/home/ListingToolbar";
import {
  ClearFiltersButton,
  GenreFilter,
  ShowStatusFilterPicker,
  WatchStateFilter,
} from "@/components/home/FilterPickers";
import {
  ACTIVE_WATCH_STATES,
  SHOW_STATUS_KEYS,
  matchesGenre,
  matchesStatus,
  watchStateOf,
  type ShowStatusFilter,
  type WatchState,
} from "@/components/home/filterTypes";
import {
  WATCH_NEXT_SORTS,
  WATCH_NEXT_SORT_KEYS,
  compareWatchNextEntries,
} from "@/components/home/watchNextSort";

const ACTIVE_WATCH_STATE_KEYS = ACTIVE_WATCH_STATES.map((s) => s.key);

export function WatchNextList() {
  const [sort, setSort] = usePersistedSort<WatchNextSort>(
    "watch-next",
    WATCH_NEXT_SORT_KEYS,
    "last_aired_desc",
  );
  const [watchState, setWatchState] = usePersistedSort<WatchState>(
    "watch-next-watch-state",
    ACTIVE_WATCH_STATE_KEYS,
    "all",
  );
  const [status, setStatus] = usePersistedSort<ShowStatusFilter>(
    "watch-next-status",
    SHOW_STATUS_KEYS,
    "all",
  );
  const [genre, setGenre] = usePersistedString("watch-next-genre", "all");

  const { data, isLoading } = useWatchNext();
  const filteredAndSorted = useMemo(() => {
    if (!data) return data;
    return data
      .filter((e) => watchState === "all" || watchStateOf(e) === watchState)
      .filter((e) => matchesStatus(e.show, status))
      .filter((e) => matchesGenre(e.show, genre))
      .sort((a, b) => compareWatchNextEntries(a, b, sort));
  }, [data, sort, watchState, status, genre]);

  return (
    <div>
      {/* The `h1` stands alone: the sort control used to hang off it with
        `justify-between`, which is what AC 2 removes. */}
      <h1 className="text-2xl font-semibold mb-4">Watch Next</h1>
      <ListingToolbar
        sort={{
          label: "Watch Next",
          options: WATCH_NEXT_SORTS,
          value: sort,
          onChange: setSort,
        }}
        filters={
          <>
            <WatchStateFilter
              value={watchState}
              onChange={setWatchState}
              options={ACTIVE_WATCH_STATES}
            />
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
          </>
        }
      />
      {isLoading && <p>Loading…</p>}
      {!isLoading && filteredAndSorted && filteredAndSorted.length === 0 && (
        <p className="text-muted-foreground">
          {data && data.length === 0
            ? "You're caught up. Add shows or wait for new episodes."
            : "No shows match the current filters."}
        </p>
      )}
      {!isLoading && filteredAndSorted && filteredAndSorted.length > 0 && (
        <ul className="space-y-3">
          {filteredAndSorted.map((entry) => (
            <EpisodeRow
              key={entry.show.id}
              show={entry.show}
              episode={entry.episode}
              action={
                <EpisodeWatchCheckbox
                  showId={entry.show.id}
                  episodeId={entry.episode.id}
                  watched={entry.episode.watched ?? false}
                />
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
