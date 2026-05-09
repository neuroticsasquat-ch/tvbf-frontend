import { useMemo } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUp, Tv } from "lucide-react";
import { useWatchNext } from "@/api/me";
import type { WatchNextSort } from "@/api/types";
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { usePersistedString } from "@/hooks/usePersistedString";
import { EpisodeWatchCheckbox } from "@/components/EpisodeWatchCheckbox";
import { FilterSheet } from "@/components/home/FilterSheet";
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

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatAirdate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return DATE_FMT.format(new Date(y, m - 1, d));
}

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
  const sortLabel = WATCH_NEXT_SORTS.find((s) => s.key === sort)?.label ?? "";

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-2xl font-semibold">Watch Next</h1>
        <FilterSheet
          title="Sort Watch Next"
          triggerLabel={sortLabel}
          triggerIcon={
            <>
              <ArrowDown className="h-4 w-4" aria-hidden />
              <ArrowUp className="h-4 w-4 -ml-2" aria-hidden />
            </>
          }
          ariaLabel={`Sort Watch Next (current: ${sortLabel})`}
          options={WATCH_NEXT_SORTS}
          value={sort}
          onChange={setSort}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
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
      </div>
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
          {filteredAndSorted.map((entry) => {
            const thumbnail = entry.episode.image_medium;
            return (
              <li key={entry.show.id} className="border border-border rounded p-3 hover:bg-accent">
                <div className="flex items-center gap-4">
                  <Link
                    to={`/episodes/${entry.episode.id}`}
                    className="flex min-w-0 flex-1 items-center gap-4"
                  >
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt=""
                        className="w-32 aspect-video object-cover rounded shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        aria-hidden
                        className="w-32 aspect-video rounded shrink-0 bg-muted text-muted-foreground flex items-center justify-center"
                      >
                        <Tv className="h-6 w-6" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-tight truncate">
                        {entry.show.name}
                        {entry.show.premiered && (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            ({entry.show.premiered.slice(0, 4)})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground leading-tight">
                        S{entry.episode.season}E{entry.episode.number}
                      </p>
                      {entry.episode.name && (
                        <p className="text-sm text-foreground leading-tight truncate">
                          {entry.episode.name}
                        </p>
                      )}
                      {(entry.episode.airdate || entry.episode.runtime) && (
                        <p className="text-xs text-muted-foreground leading-tight">
                          {entry.episode.airdate ? formatAirdate(entry.episode.airdate) : ""}
                          {entry.episode.airdate && entry.episode.runtime ? " · " : ""}
                          {entry.episode.runtime ? `${entry.episode.runtime} min` : ""}
                        </p>
                      )}
                    </div>
                  </Link>
                  <div className="ml-auto shrink-0">
                    <EpisodeWatchCheckbox
                      showId={entry.show.id}
                      episodeId={entry.episode.id}
                      watched={entry.episode.watched ?? false}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
