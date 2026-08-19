import { useMemo } from "react";
import { Link } from "react-router";
import { useUpcomingShows } from "@/api/me";
import type { UpcomingSort } from "@/api/types";
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { usePersistedString } from "@/hooks/usePersistedString";
import { ShowPoster } from "@/components/ShowPoster";
import { ListingToolbar } from "@/components/home/ListingToolbar";
import {
  ClearFiltersButton,
  GenreFilter,
  ShowStatusFilterPicker,
} from "@/components/home/FilterPickers";
import {
  SHOW_STATUS_KEYS,
  matchesGenre,
  matchesStatus,
  type ShowStatusFilter,
} from "@/components/home/filterTypes";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatPremiere(iso: string | null): string {
  if (!iso) return "TBA";
  const [y, m, d] = iso.split("-").map(Number);
  return DATE_FMT.format(new Date(y, m - 1, d));
}

const SORTS: { key: UpcomingSort; label: string }[] = [
  { key: "airdate_asc", label: "Next Premiere" },
  { key: "added_desc", label: "Recently Added" },
  { key: "name_asc", label: "Show Title" },
];

const SORT_KEYS = SORTS.map((s) => s.key);

export function UpcomingShowsList() {
  const [sort, setSort] = usePersistedSort<UpcomingSort>(
    "upcoming-shows",
    SORT_KEYS,
    "airdate_asc",
  );
  const [status, setStatus] = usePersistedSort<ShowStatusFilter>(
    "upcoming-shows-status",
    SHOW_STATUS_KEYS,
    "all",
  );
  const [genre, setGenre] = usePersistedString("upcoming-shows-genre", "all");

  const { data, isLoading } = useUpcomingShows(sort);
  const filtered = useMemo(() => {
    if (!data) return data;
    return data
      .filter((e) => matchesStatus(e.show, status))
      .filter((e) => matchesGenre(e.show, genre));
  }, [data, status, genre]);

  return (
    <div>
      <ListingToolbar
        sort={{ label: "Upcoming Shows", options: SORTS, value: sort, onChange: setSort }}
        filters={
          <>
            <ShowStatusFilterPicker value={status} onChange={setStatus} />
            <GenreFilter value={genre} onChange={setGenre} />
            {(status !== "all" || genre !== "all") && (
              <ClearFiltersButton
                onClear={() => {
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
            ? "No upcoming shows in your library."
            : "No shows match the current filters."}
        </p>
      )}
      {!isLoading && filtered && filtered.length > 0 && (
        <ul className="space-y-3">
          {filtered.map((entry) => (
            <li
              key={entry.show.id}
              className="border border-border rounded p-3 flex items-center gap-3 sm:gap-4 hover:bg-accent"
            >
              <ShowPoster
                to={`/shows/${entry.show.id}`}
                src={entry.show.image_medium}
                linkLabel={entry.show.name}
                size="row"
              />
              <Link to={`/shows/${entry.show.id}`} className="min-w-0 flex-1">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight truncate">
                    {entry.show.name}
                  </p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    {formatPremiere(entry.premiere_date)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
