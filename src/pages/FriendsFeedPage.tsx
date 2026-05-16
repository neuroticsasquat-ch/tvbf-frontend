import { useSearchParams } from "react-router";
import { ActivityFeed } from "@/components/friends/ActivityFeed";
import { ConnectionsTabs } from "@/components/connections/ConnectionsTabs";
import { useIncomingRequestCount } from "@/api/incomingRequests";
import { cn } from "@/lib/cn";

type Section = "activity" | "connections";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "activity", label: "Activity" },
  { key: "connections", label: "Connections" },
];

function isSection(value: string | null): value is Section {
  return value === "activity" || value === "connections";
}

export function FriendsFeedPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("section");
  const active: Section = isSection(raw) ? raw : "activity";
  const incomingCount = useIncomingRequestCount(true);

  function selectSection(next: Section) {
    if (next === "activity") {
      params.delete("section");
    } else {
      params.set("section", next);
    }
    // Switching top-level sections clears the Connections sub-tab.
    params.delete("tab");
    setParams(params, { replace: true });
  }

  return (
    <section aria-label="Friends" className="space-y-4">
      <h1 className="text-2xl font-semibold">Friends</h1>

      <div
        role="tablist"
        aria-label="Friends sections"
        className="flex gap-1 border-b border-border"
      >
        {SECTIONS.map((s) => {
          const selected = s.key === active;
          const showBadge = s.key === "connections" && incomingCount > 0;
          const label = showBadge ? `${s.label} (${incomingCount})` : s.label;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`friends-panel-${s.key}`}
              id={`friends-tab-${s.key}`}
              onClick={() => selectSection(s.key)}
              className={cn(
                "px-3 py-2 text-sm border-b-2 -mb-px rounded-sm",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`friends-panel-${active}`}
        aria-labelledby={`friends-tab-${active}`}
      >
        {active === "activity" ? <ActivityFeed /> : <ConnectionsTabs />}
      </div>
    </section>
  );
}
