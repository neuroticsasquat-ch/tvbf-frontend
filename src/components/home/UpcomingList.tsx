import { useMemo } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUp, Tv } from "lucide-react";
import { useUpcoming } from "@/api/me";
import type { UpcomingSort } from "@/api/types";
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { usePersistedString } from "@/hooks/usePersistedString";
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

const SORTS: { key: UpcomingSort; label: string }[] = [
  { key: "airdate_asc", label: "Next Air Date" },
  { key: "added_desc", label: "Recently Added" },
  { key: "name_asc", label: "Show Title" },
];

const SORT_KEYS = SORTS.map((s) => s.key);

export function UpcomingList() {
  const [sort, setSort] = usePersistedSort<UpcomingSort>("upcoming", SORT_KEYS, "airdate_asc");
  const [watchState, setWatchState] = usePersistedSort<WatchState>(
    "upcoming-watch-state",
    ACTIVE_WATCH_STATE_KEYS,
    "all",
  );
  const [status, setStatus] = usePersistedSort<ShowStatusFilter>(
    "upcoming-status",
    SHOW_STATUS_KEYS,
    "all",
  );
  const [genre, setGenre] = usePersistedString("upcoming-genre", "all");

  const { data, isLoading } = useUpcoming(sort);
  const filtered = useMemo(() => {
    if (!data) return data;
    return data
      .filter((e) => watchState === "all" || watchStateOf(e) === watchState)
      .filter((e) => matchesStatus(e.show, status))
      .filter((e) => matchesGenre(e.show, genre));
  }, [data, watchState, status, genre]);

  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? "";

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <FilterSheet
          title="Sort Upcoming"
          triggerLabel={sortLabel}
          triggerIcon={
            <>
              <ArrowDown className="h-4 w-4" aria-hidden />
              <ArrowUp className="h-4 w-4 -ml-2" aria-hidden />
            </>
          }
          ariaLabel={`Sort Upcoming (current: ${sortLabel})`}
          options={SORTS}
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
      {!isLoading && filtered && filtered.length === 0 && (
        <p className="text-muted-foreground">
          {data && data.length === 0
            ? "No upcoming episodes scheduled for your shows."
            : "No shows match the current filters."}
        </p>
      )}
      {!isLoading && filtered && filtered.length > 0 && (
        <ul className="space-y-3">
          {filtered.map((entry) => (
            <li key={entry.show.id} className="border border-border rounded p-3 hover:bg-accent">
              <div className="flex items-center gap-4">
                <Link
                  to={`/episodes/${entry.episode.id}`}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  {entry.show.image_medium ? (
                    <img
                      src={entry.show.image_medium}
                      alt=""
                      className="w-16 aspect-[210/295] object-cover rounded shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      aria-hidden
                      className="w-16 aspect-[210/295] rounded shrink-0 bg-muted text-muted-foreground flex items-center justify-center"
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
