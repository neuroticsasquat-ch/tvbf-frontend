import { useEffect, useState } from "react";
import { useSearchParams, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { listConnections } from "@/api/connections";
import { useMyShows, useMyWatched } from "@/api/me";
import { LibraryActiveList } from "@/components/library/LibraryActiveList";
import { LibraryWatchedList } from "@/components/library/LibraryWatchedList";
import { cn } from "@/lib/cn";

type Tab = "active" | "watched";

const TABS: { key: Tab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "watched", label: "All Watched" },
];

function isTab(value: string | null): value is Tab {
  return value === "active" || value === "watched";
}

/** Ephemeral toast for an invited signup — shown once on first arrival.
 * Reads `location.state.invited`, fires the toast after `listConnections`
 * resolves, and clears the nav state so a cold reload does not repeat it. */
function InvitedToast() {
  const location = useLocation();
  const invited = (location.state as { invited?: boolean } | null)?.invited;
  const { data: connections } = useQuery({
    queryKey: ["connections"],
    queryFn: listConnections,
    enabled: !!invited,
  });

  useEffect(() => {
    if (invited && connections && connections.length > 0) {
      toast(`You're now connected with @${connections[0].user.handle}.`, { duration: 5000 });
      // Clear the nav state so a cold reload does not repeat the toast.
      window.history.replaceState({}, "");
    }
  }, [invited, connections]);

  return null;
}

export function MyShowsPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const active: Tab = isTab(raw) ? raw : "active";

  function selectTab(next: Tab) {
    if (next === "active") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    setParams(params, { replace: true });
  }

  return (
    <section className="flex flex-col gap-4">
      <InvitedToast />
      <h1 className="text-2xl font-semibold">My Shows</h1>

      <div
        role="tablist"
        aria-label="My Shows sections"
        className="flex gap-1 border-b border-border"
      >
        {TABS.map((t) => {
          const selected = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => selectTab(t.key)}
              className={cn(
                "px-3 py-2 text-sm border-b-2 -mb-px rounded-sm",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {active === "active" && <ActiveTab />}
        {active === "watched" && <WatchedTab />}
      </div>
    </section>
  );
}

function ActiveTab() {
  const [ratedOnly, setRatedOnly] = useState(false);
  const { data, isLoading } = useMyShows("recent_activity", { ratedOnly });
  return <LibraryActiveList data={data} isLoading={isLoading} onRatedOnlyChange={setRatedOnly} />;
}

function WatchedTab() {
  const { data, isLoading, isError } = useMyWatched();
  return <LibraryWatchedList data={data} isLoading={isLoading} isError={isError} />;
}
