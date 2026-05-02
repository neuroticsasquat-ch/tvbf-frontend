import { useState } from "react";
import { Link } from "react-router";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { useUpcoming } from "@/api/me";
import type { UpcomingSort } from "@/api/types";
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { cn } from "@/lib/cn";
import { WatchProgressBar } from "@/components/WatchProgressBar";

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

const SORTS: { key: UpcomingSort; label: string }[] = [
  { key: "airdate_asc", label: "Next Air Date" },
  { key: "added_desc", label: "Recently Added" },
  { key: "name_asc", label: "Show Title" },
];

const SORT_KEYS = SORTS.map((s) => s.key);

export function UpcomingList() {
  const [sort, setSort] = usePersistedSort<UpcomingSort>("upcoming", SORT_KEYS, "airdate_asc");
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data, isLoading } = useUpcoming(sort);
  const currentLabel = SORTS.find((s) => s.key === sort)?.label ?? "";

  return (
    <div>
      <div className="flex items-baseline justify-end mb-4">
        <DialogPrimitive.Root open={sheetOpen} onOpenChange={setSheetOpen}>
          <DialogPrimitive.Trigger
            aria-label={`Sort Upcoming (current: ${currentLabel})`}
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
                Sort Upcoming
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
      {!isLoading && data && data.length === 0 && (
        <p className="text-muted-foreground">No upcoming episodes scheduled for your shows.</p>
      )}
      {!isLoading && data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((entry) => (
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
                  <div className="text-xs text-muted-foreground leading-tight">
                    <p><em>Upcoming:</em></p>
                    <p>
                      S{entry.episode.season}E{entry.episode.number}
                      {entry.episode.name && (
                        <>
                          {" — "}
                          <span className="font-semibold">{entry.episode.name}</span>
                        </>
                      )}
                    </p>
                    {entry.episode.airdate && <p>{formatAirdate(entry.episode.airdate)}</p>}
                  </div>
                  <WatchProgressBar
                    watched={entry.watched_episode_count}
                    aired={entry.aired_episode_count}
                    upcoming={entry.upcoming_episode_count}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
