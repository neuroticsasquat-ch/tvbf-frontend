import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import { useShows } from "@/api/shows";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Pagination } from "@/components/Pagination";
import { ShowGrid } from "@/components/ShowGrid";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PER_PAGE = 50;

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";
  const page = Number.parseInt(params.get("page") ?? "1", 10) || 1;

  const [draft, setDraft] = useState(search);

  // Reflect URL → input when navigating back/forward.
  useEffect(() => {
    setDraft(search);
  }, [search]);

  // Debounce typing → URL.
  useEffect(() => {
    const handle = setTimeout(() => {
      if (draft === search) return;
      const next = new URLSearchParams(params);
      if (draft) next.set("search", draft);
      else next.delete("search");
      next.delete("page");
      setParams(next, { replace: false });
    }, 300);
    return () => clearTimeout(handle);
  }, [draft, search, params, setParams]);

  function setPage(nextPage: number) {
    const next = new URLSearchParams(params);
    if (nextPage > 1) next.set("page", String(nextPage));
    else next.delete("page");
    setParams(next, { replace: false });
  }

  const trimmed = search.trim();
  const hasSearch = trimmed.length > 0;
  const query = useShows(
    {
      search: trimmed || undefined,
      sort: "-tvmaze_updated",
      page,
      per_page: PER_PAGE,
    },
    { enabled: hasSearch },
  );

  return (
    <div className="space-y-6">
      <div className="max-w-md">
        <Label htmlFor="search">Search</Label>
        <Input
          id="search"
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Show name"
          autoFocus
        />
      </div>
      {!hasSearch ? (
        <p className="text-sm text-muted-foreground">Type a show name to search.</p>
      ) : query.isPending ? (
        <LoadingState rows={12} />
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No shows match "{trimmed}".</p>
      ) : (
        <>
          <ShowGrid shows={query.data.items} />
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
