import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { useShows } from "@/api/shows";
import type { SortKey } from "@/api/types";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Pagination } from "@/components/Pagination";
import { ShowGrid } from "@/components/ShowGrid";
import { ShowList } from "@/components/ShowList";
import { ViewToggle } from "@/components/ViewToggle";
import { FilterSheet } from "@/components/home/FilterSheet";
import {
  ClearFiltersButton,
  GenreFilter,
  ShowStatusFilterPicker,
} from "@/components/home/FilterPickers";
import { SHOW_STATUS_KEYS, type ShowStatusFilter } from "@/components/home/filterTypes";
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { usePersistedString } from "@/hooks/usePersistedString";
import { usePersistedView } from "@/hooks/usePersistedView";

const SEARCH_SORTS: { key: SortKey; label: string }[] = [
  { key: "-last_aired", label: "Last Aired" },
  { key: "premiered", label: "Premiered First" },
  { key: "-premiered", label: "Premiered Last" },
  { key: "name", label: "Show Title" },
];
const SEARCH_SORT_KEYS = SEARCH_SORTS.map((s) => s.key);

const STATUS_API_VALUE: Record<ShowStatusFilter, string | undefined> = {
  all: undefined,
  running: "Running",
  ended: "Ended",
};

const PER_PAGE = 50;

export function SearchOverlay({ search }: { search: string }) {
  const trimmed = search.trim();
  const [view, setView] = usePersistedView("search", "grid");
  const [sort, setSort] = usePersistedSort<SortKey>("search", SEARCH_SORT_KEYS, "-last_aired");
  const [status, setStatus] = usePersistedSort<ShowStatusFilter>(
    "search-status",
    SHOW_STATUS_KEYS,
    "all",
  );
  const [genre, setGenre] = usePersistedString("search-genre", "all");
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever the query or filters change.
  const resetKey = `${trimmed}|${sort}|${status}|${genre}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setPage(1);
  }

  const query = useShows(
    {
      search: trimmed || undefined,
      status: STATUS_API_VALUE[status],
      genre: genre === "all" ? undefined : [genre],
      sort,
      page,
      per_page: PER_PAGE,
    },
    { enabled: trimmed.length > 0 },
  );

  const sortLabel = SEARCH_SORTS.find((s) => s.key === sort)?.label ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
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
        <div className="ml-auto flex items-center gap-2">
          <ViewToggle value={view} onChange={setView} ariaLabel="Display" />
          <FilterSheet
            title="Sort"
            triggerLabel={sortLabel}
            triggerIcon={
              <>
                <ArrowDown className="h-4 w-4" aria-hidden />
                <ArrowUp className="h-4 w-4 -ml-2" aria-hidden />
              </>
            }
            ariaLabel={`Sort results (current: ${sortLabel})`}
            options={SEARCH_SORTS}
            value={sort}
            onChange={setSort}
          />
        </div>
      </div>
      {query.isPending ? (
        <LoadingState rows={12} />
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No shows match "{trimmed}".</p>
      ) : (
        <>
          {view === "grid" ? (
            <ShowGrid shows={query.data.items} />
          ) : (
            <ShowList shows={query.data.items} />
          )}
          <Pagination
            page={query.data.page}
            totalPages={query.data.total_pages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
