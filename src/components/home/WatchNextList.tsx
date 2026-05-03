import { useMemo } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUp, Tv } from "lucide-react";
import { useWatchNext } from "@/api/me";
import type { WatchNextEntry, WatchNextSort } from "@/api/types";
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

const ACTIVE_WATCH_STATE_KEYS = ACTIVE_WATCH_STATES.map((s) => s.key);

const SORTS: { key: WatchNextSort; label: string }[] = [
  { key: "last_aired_desc", label: "Last Aired" },
  { key: "last_watched_desc", label: "Last Watched" },
  { key: "oldest_unwatched_asc", label: "Oldest Unwatched" },
  { key: "added_desc", label: "Recently Added" },
  { key: "name_asc", label: "Show Title" },
];

const SORT_KEYS = SORTS.map((s) => s.key);

const nameKey = (s: string) => s.toLowerCase().replace(/^(the|a|an)\s+/i, "");

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

function compareEntries(a: WatchNextEntry, b: WatchNextEntry, sort: WatchNextSort): number {
  const tiebreak = nameKey(a.show.name).localeCompare(nameKey(b.show.name));
  const cmpNullable = (av: string | null | undefined, bv: string | null | undefined, desc: boolean) => {
    if (!av && !bv) return tiebreak;
    if (!av) return 1;
    if (!bv) return -1;
    return desc ? bv.localeCompare(av) : av.localeCompare(bv);
  };
  switch (sort) {
    case "oldest_unwatched_asc":
      return cmpNullable(a.episode.airdate, b.episode.airdate, false) || tiebreak;
    case "last_watched_desc":
      return cmpNullable(a.last_watched_at, b.last_watched_at, true) || tiebreak;
    case "last_aired_desc":
      return cmpNullable(a.episode.airdate, b.episode.airdate, true) || tiebreak;
    case "added_desc":
      return cmpNullable(a.added_at, b.added_at, true) || tiebreak;
    case "name_asc":
      return tiebreak;
  }
}

export function WatchNextList() {
  const [sort, setSort] = usePersistedSort<WatchNextSort>(
    "watch-next",
    SORT_KEYS,
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
      .sort((a, b) => compareEntries(a, b, sort));
  }, [data, sort, watchState, status, genre]);
  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? "";

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
                <Link
                  to={`/shows/${entry.show.id}`}
                  className="block font-semibold text-lg mb-2 truncate"
                >
                  {entry.show.name}
                  {entry.show.premiered && (
                    <span className="font-normal text-muted-foreground">
                      {" "}({entry.show.premiered.slice(0, 4)})
                    </span>
                  )}
                </Link>
                <div className="flex items-center gap-4">
                  <Link
                    to={`/episodes/${entry.episode.id}`}
                    className="flex flex-1 min-w-0 items-center gap-4"
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
                      <p className="text-base text-foreground leading-tight truncate">
                        S{entry.episode.season}E{entry.episode.number}
                        {entry.episode.name && (
                          <>
                            {" — "}
                            <span className="font-semibold">{entry.episode.name}</span>
                          </>
                        )}
                      </p>
                      {entry.episode.airdate && (
                        <p className="text-xs text-muted-foreground leading-tight">
                          {formatAirdate(entry.episode.airdate)}
                        </p>
                      )}
                    </div>
                  </Link>
                  <div className="ml-auto shrink-0">
                    <EpisodeWatchCheckbox
                      showId={entry.show.id}
                      episodeId={entry.episode.id}
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
