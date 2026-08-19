import { useMemo } from "react";
import { useUpcoming } from "@/api/me";
import type { UpcomingSort } from "@/api/types";
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { usePersistedString } from "@/hooks/usePersistedString";
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

const ACTIVE_WATCH_STATE_KEYS = ACTIVE_WATCH_STATES.map((s) => s.key);

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

  return (
    <div>
      <ListingToolbar
        sort={{ label: "Upcoming", options: SORTS, value: sort, onChange: setSort }}
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
            <EpisodeRow key={entry.show.id} show={entry.show} episode={entry.episode} />
          ))}
        </ul>
      )}
    </div>
  );
}
