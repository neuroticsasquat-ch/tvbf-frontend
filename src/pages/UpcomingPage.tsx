import { useSearchParams } from "react-router";
import { UpcomingList } from "@/components/home/UpcomingList";
import { UpcomingSeasonsList } from "@/components/home/UpcomingSeasonsList";
import { UpcomingShowsList } from "@/components/home/UpcomingShowsList";
import { cn } from "@/lib/cn";

type Tab = "episodes" | "seasons" | "shows";

const TABS: { key: Tab; label: string }[] = [
  { key: "episodes", label: "Episodes" },
  { key: "seasons", label: "Seasons" },
  { key: "shows", label: "Shows" },
];

function isTab(value: string | null): value is Tab {
  return value === "episodes" || value === "seasons" || value === "shows";
}

export function UpcomingPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const active: Tab = isTab(raw) ? raw : "episodes";

  function selectTab(next: Tab) {
    if (next === "episodes") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    setParams(params, { replace: true });
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Upcoming</h1>

      <div
        role="tablist"
        aria-label="Upcoming sections"
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
        {active === "episodes" && <UpcomingList />}
        {active === "seasons" && <UpcomingSeasonsList />}
        {active === "shows" && <UpcomingShowsList />}
      </div>
    </section>
  );
}
