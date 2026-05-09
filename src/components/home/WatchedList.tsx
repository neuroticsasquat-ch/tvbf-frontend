import { useState } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUp, Check, Plus } from "lucide-react";
import { useAddShow, useMyWatched, useRemoveShow } from "@/api/me";
import type { WatchedEntry, WatchedSort, WatchedStatusFilter } from "@/api/types";
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

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
        <ul className="space-y-3">
          {data.map((entry) => (
            <WatchedRow key={entry.show.id} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}

function WatchedRow({ entry }: { entry: WatchedEntry }) {
  // Local override for optimistic toggle. Reset during render when the
  // upstream value changes (refetch lands) so the badge re-syncs with server
  // truth — the derived-state-reset pattern from React docs.
  const [override, setOverride] = useState<boolean | null>(null);
  const [lastUpstream, setLastUpstream] = useState(entry.in_my_shows);
  if (lastUpstream !== entry.in_my_shows) {
    setLastUpstream(entry.in_my_shows);
    setOverride(null);
  }
  const inMyShows = override ?? entry.in_my_shows;

  const add = useAddShow();
  const remove = useRemoveShow();

  function onAdd() {
    setOverride(true);
    add.mutate(entry.show.id, {
      onError: () => setOverride(false),
    });
  }
  function onRemove() {
    setOverride(false);
    remove.mutate(entry.show.id, {
      onError: () => setOverride(true),
    });
  }

  return (
    <li className="border border-border rounded p-3 flex items-start gap-4">
      <Link to={`/shows/${entry.show.id}`} className="shrink-0" aria-label={entry.show.name}>
        {entry.show.image_medium ? (
          <img
            src={entry.show.image_medium}
            alt=""
            className="w-16 aspect-[210/295] object-cover rounded"
          />
        ) : (
          <div className="w-16 aspect-[210/295] rounded bg-muted" />
        )}
      </Link>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <Link to={`/shows/${entry.show.id}`} className="font-semibold hover:underline truncate">
            {entry.show.name}
          </Link>
          {entry.show.premiered && (
            <span className="text-sm text-muted-foreground">
              ({entry.show.premiered.slice(0, 4)})
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span
            className={cn(
              "px-1.5 py-0.5 rounded border",
              entry.status === "finished" ? "border-emerald-600 text-emerald-700" : "border-border",
            )}
          >
            {entry.status === "finished" ? "Finished" : "In progress"}
          </span>
          <span>
            {entry.watched_episode_count}/{entry.aired_episode_count}
          </span>
          {entry.last_watched_at && <span>Last watched {formatDate(entry.last_watched_at)}</span>}
          {inMyShows && (
            <span className="px-1.5 py-0.5 rounded border border-border">In My Shows</span>
          )}
        </div>
      </div>
      <div className="shrink-0">
        {inMyShows ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRemove}
            disabled={remove.isPending}
          >
            <Check className="h-4 w-4" aria-hidden />
            Remove from My Shows
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={onAdd} disabled={add.isPending}>
            <Plus className="h-4 w-4" aria-hidden />
            Add to My Shows
          </Button>
        )}
      </div>
    </li>
  );
}
