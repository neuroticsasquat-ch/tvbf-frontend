import { useMemo, useState } from "react";
import { Link } from "react-router";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { useMyShows } from "@/api/me";
import type { MyShowEntry, WatchedSort } from "@/api/types";
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { cn } from "@/lib/cn";

const SORTS: { key: WatchedSort; label: string }[] = [
  { key: "last_watched_desc", label: "Last Watched" },
  { key: "added_desc", label: "Recently Added" },
  { key: "name_asc", label: "Name A→Z" },
  { key: "name_desc", label: "Name Z→A" },
];

const SORT_KEYS = SORTS.map((s) => s.key);

const nameKey = (s: string) => s.toLowerCase().replace(/^(the|a|an)\s+/i, "");

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(iso: string): string {
  // last_watched_at is a full ISO datetime; take the date portion.
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return DATE_FMT.format(new Date(y, m - 1, d));
}

function isCaughtUp(entry: MyShowEntry): boolean {
  return (
    entry.aired_episode_count > 0 &&
    entry.watched_episode_count >= entry.aired_episode_count
  );
}

function compareEntries(a: MyShowEntry, b: MyShowEntry, sort: WatchedSort): number {
  const tiebreak = nameKey(a.show.name).localeCompare(nameKey(b.show.name));
  const cmpNullable = (av: string | null | undefined, bv: string | null | undefined, desc: boolean) => {
    if (!av && !bv) return tiebreak;
    if (!av) return 1;
    if (!bv) return -1;
    return desc ? bv.localeCompare(av) : av.localeCompare(bv);
  };
  switch (sort) {
    case "last_watched_desc":
      return cmpNullable(a.last_watched_at, b.last_watched_at, true) || tiebreak;
    case "added_desc":
      return cmpNullable(a.added_at, b.added_at, true) || tiebreak;
    case "name_asc":
      return tiebreak;
    case "name_desc":
      return -tiebreak;
  }
}

export function WatchedList() {
  // Use the default `recent_activity` sort upstream — we filter and re-sort here.
  const [sort, setSort] = usePersistedSort<WatchedSort>(
    "watched",
    SORT_KEYS,
    "last_watched_desc",
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data, isLoading } = useMyShows();
  const filteredAndSorted = useMemo(() => {
    if (!data) return data;
    return data.filter(isCaughtUp).sort((a, b) => compareEntries(a, b, sort));
  }, [data, sort]);
  const currentLabel = SORTS.find((s) => s.key === sort)?.label ?? "";

  return (
    <div>
      <div className="flex items-baseline justify-end mb-4">
        <DialogPrimitive.Root open={sheetOpen} onOpenChange={setSheetOpen}>
          <DialogPrimitive.Trigger
            aria-label={`Sort Watched (current: ${currentLabel})`}
            className="text-sm rounded border border-border px-2 py-1 bg-background hover:bg-accent inline-flex items-center gap-1"
          >
            <ArrowDown className="h-4 w-4" aria-hidden />
            <ArrowUp className="h-4 w-4 -ml-2" aria-hidden />
            <span>{currentLabel}</span>
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <DialogPrimitive.Content
              aria-describedby={undefined}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=open]:duration-200 data-[state=closed]:duration-150"
            >
              <DialogPrimitive.Title className="text-base font-semibold mb-3">
                Sort Watched
              </DialogPrimitive.Title>
              <ul className="flex flex-col">
                {SORTS.map((s) => {
                  const active = s.key === sort;
                  return (
                    <li key={s.key}>
                      <button
                        type="button"
                        onClick={() => {
                          setSort(s.key);
                          setSheetOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 text-left rounded px-3 py-3 text-sm hover:bg-accent",
                          active && "font-semibold",
                        )}
                      >
                        <span className="w-4 inline-flex justify-center">
                          {active && <Check className="h-4 w-4" aria-hidden />}
                        </span>
                        <span>{s.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
      {isLoading && <p>Loading…</p>}
      {!isLoading && filteredAndSorted && filteredAndSorted.length === 0 && (
        <p className="text-muted-foreground">
          Nothing here yet — finish a show to see it here.
        </p>
      )}
      {!isLoading && filteredAndSorted && filteredAndSorted.length > 0 && (
        <ul className="space-y-3">
          {filteredAndSorted.map((entry) => (
            <li key={entry.show.id}>
              <Link
                to={`/shows/${entry.show.id}`}
                className="border border-border rounded p-3 flex items-center gap-4 hover:bg-accent"
              >
                {entry.show.image_medium && (
                  <img
                    src={entry.show.image_medium}
                    alt=""
                    className="w-16 aspect-[2/3] object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg mb-1">{entry.show.name}</p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    Caught up
                    {entry.last_watched_at && (
                      <> · last watched {formatDate(entry.last_watched_at)}</>
                    )}
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
