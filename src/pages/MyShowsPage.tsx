import { useSearchParams } from "react-router";
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
  const { data, isLoading } = useMyShows();
  return <LibraryActiveList data={data} isLoading={isLoading} />;
}

function WatchedTab() {
  const { data, isLoading, isError } = useMyWatched();
  return <LibraryWatchedList data={data} isLoading={isLoading} isError={isError} />;
}
