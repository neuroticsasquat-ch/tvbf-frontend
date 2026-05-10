import { useState } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import {
  useAddShow,
  useMyWatched,
  useRemoveFromHistory,
  useRemoveShow,
} from "@/api/me";
import type { WatchedEntry, WatchedSort, WatchedStatusFilter } from "@/api/types";
import { ConfirmDialog } from "@/components/connections/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { WatchProgressBar } from "@/components/WatchProgressBar";
import { FilterSheet } from "@/components/home/FilterSheet";
import { usePersistedSort } from "@/hooks/usePersistedSort";

const STATUS_FILTERS: { key: WatchedStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "finished", label: "Finished" },
  { key: "in_progress", label: "In progress" },
];
const STATUS_KEYS = STATUS_FILTERS.map((f) => f.key);

// Mirrors MY_SHOWS_SORTS so Active and Watched offer the same options.
// "Recently Added" on Watched maps to first-watched-date (NEU-114 decision).
const SORTS: { key: WatchedSort; label: string }[] = [
  { key: "name_asc", label: "Show Title" },
  { key: "last_watched_desc", label: "Last Watched" },
  { key: "last_aired_desc", label: "Last Aired" },
  { key: "premiered_asc", label: "Premiered First" },
  { key: "premiered_desc", label: "Premiered Last" },
  { key: "first_watched_desc", label: "Recently Added" },
];
const SORT_KEYS = SORTS.map((s) => s.key);

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "";
  // Include the year when the date is more than ~6 months old, so "Last
  // Watched" stays unambiguous regardless of calendar-year boundary.
  const ageDays = (Date.now() - d.getTime()) / 86_400_000;
  const includeYear = ageDays > 180;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
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
  const removeHistory = useRemoveFromHistory();
  const [confirmingRemoveHistory, setConfirmingRemoveHistory] = useState(false);

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
    <li className="border border-border rounded p-3 flex items-start gap-3 sm:gap-4">
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
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <Link
            to={`/shows/${entry.show.id}`}
            className="font-semibold hover:underline min-w-0 break-words"
          >
            {entry.show.name}
          </Link>
          {entry.show.premiered && (
            <span className="text-sm text-muted-foreground">
              ({entry.show.premiered.slice(0, 4)})
            </span>
          )}
        </div>
        {entry.status !== "finished" && entry.aired_episode_count > 0 && (
          <WatchProgressBar
            watched={entry.watched_episode_count}
            aired={entry.aired_episode_count}
            upcoming={entry.total_episode_count - entry.aired_episode_count}
            barOnly
          />
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {entry.status === "finished" ? (
            <span className="px-1.5 py-0.5 rounded border border-emerald-600 text-emerald-700">
              Finished
            </span>
          ) : (
            <span>
              Progress: {entry.watched_episode_count}/{entry.aired_episode_count}
            </span>
          )}
          {entry.last_watched_at && (
            <span aria-hidden className="text-muted-foreground/50">
              ·
            </span>
          )}
          {entry.last_watched_at && (
            <span className="whitespace-nowrap">
              Last Watched: {formatDate(entry.last_watched_at)}
            </span>
          )}
        </div>
        {entry.status !== "finished" &&
          entry.total_episode_count - entry.aired_episode_count > 0 && (
            <p className="text-xs text-muted-foreground">
              {entry.total_episode_count - entry.aired_episode_count} upcoming
            </p>
          )}
        {/* Action row: icon-only on mobile, full labels at sm+. */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {inMyShows ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRemove}
              disabled={remove.isPending}
              aria-label="Remove from My Shows"
              className="h-7 px-2 gap-1 text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              My Shows
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={onAdd}
              disabled={add.isPending}
              aria-label="Add to My Shows"
              className="h-7 px-2 gap-1 text-xs"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              My Shows
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setConfirmingRemoveHistory(true)}
            aria-label={`Remove ${entry.show.name} watch history`}
            className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Watch History
          </Button>
        </div>
      </div>
      {confirmingRemoveHistory && (
        <ConfirmDialog
          title="Remove from history"
          description={`Remove all watch history for ${entry.show.name}? This cannot be undone.`}
          confirmLabel="Confirm"
          destructive
          pending={removeHistory.isPending}
          onConfirm={() => {
            removeHistory.mutate({ showId: entry.show.id });
            setConfirmingRemoveHistory(false);
          }}
          onClose={() => setConfirmingRemoveHistory(false)}
        />
      )}
    </li>
  );
}

