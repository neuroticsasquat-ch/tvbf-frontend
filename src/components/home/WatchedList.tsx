import { Link } from "react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useMyWatched } from "@/api/me";
import type { WatchedSort, WatchedStatusFilter } from "@/api/types";
import { Button } from "@/components/ui/button";
import { FilterSheet } from "@/components/home/FilterSheet";
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { cn } from "@/lib/cn";

const STATUS_FILTERS: { key: WatchedStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "finished", label: "Finished" },
  { key: "in_progress", label: "In progress" },
];
const STATUS_KEYS = STATUS_FILTERS.map((f) => f.key);

const SORTS: { key: WatchedSort; label: string }[] = [
  { key: "last_watched_desc", label: "Last watched" },
  { key: "name_asc", label: "Name A→Z" },
  { key: "name_desc", label: "Name Z→A" },
];
const SORT_KEYS = SORTS.map((s) => s.key);

export function WatchedList({ enabled = true }: { enabled?: boolean }) {
  const [status, setStatus] = usePersistedSort<WatchedStatusFilter>(
    "watched-status",
    STATUS_KEYS,
    "all",
  );
  const [sort, setSort] = usePersistedSort<WatchedSort>(
    "watched-sort",
    SORT_KEYS,
    "last_watched_desc",
  );

  const { data, isLoading, isError } = useMyWatched(status, sort, enabled);
  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? "";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.key}
              type="button"
              size="sm"
              variant={status === f.key ? "default" : "outline"}
              onClick={() => setStatus(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <FilterSheet
          title="Sort Watched"
          triggerLabel={sortLabel}
          triggerIcon={
            <>
              <ArrowDown className="h-4 w-4" aria-hidden />
              <ArrowUp className="h-4 w-4 -ml-2" aria-hidden />
            </>
          }
          ariaLabel={`Sort Watched (current: ${sortLabel})`}
          options={SORTS}
          value={sort}
          onChange={setSort}
        />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {isError && <p className="text-sm text-destructive">Failed to load watch history.</p>}
      {!isLoading && !isError && data && data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {status === "finished"
            ? "Nothing finished yet."
            : status === "in_progress"
              ? "Nothing in progress."
              : "No watch history."}
        </p>
      )}
      {!isLoading && !isError && data && data.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded border border-border">
          {data.map((entry) => (
            <li key={entry.show.id} className="flex items-center gap-3 px-3 py-2">
              <Link to={`/shows/${entry.show.id}`} className="text-sm hover:underline flex-1">
                {entry.show.name}
              </Link>
              <span className="text-xs text-muted-foreground">
                {entry.watched_episode_count}/{entry.aired_episode_count}
              </span>
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded border",
                  entry.status === "finished"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-border text-muted-foreground",
                )}
              >
                {entry.status === "finished" ? "Finished" : "In progress"}
              </span>
              {entry.in_my_shows && (
                <span className="text-xs px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                  In My Shows
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
