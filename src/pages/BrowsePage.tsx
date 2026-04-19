import { useShows } from "@/api/shows";
import { useShowFiltersUrlState } from "@/hooks/useUrlState";
import { Filters } from "@/components/Filters";
import { ShowGrid } from "@/components/ShowGrid";
import { Pagination } from "@/components/Pagination";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";

export function BrowsePage() {
  const [filters, setFilters] = useShowFiltersUrlState();
  const query = useShows({ ...filters, page: filters.page ?? 1, per_page: 50 });

  return (
    <div className="space-y-6">
      <Filters filters={filters} onChange={setFilters} />
      {query.isPending ? (
        <LoadingState rows={12} />
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      ) : (
        <>
          <ShowGrid shows={query.data.items} />
          <Pagination
            page={query.data.page}
            totalPages={query.data.total_pages}
            onPageChange={(page) => setFilters({ page })}
          />
        </>
      )}
    </div>
  );
}
