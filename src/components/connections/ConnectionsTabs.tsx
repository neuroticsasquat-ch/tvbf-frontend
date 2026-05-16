import { useSearchParams } from "react-router";
import { useIncomingRequestCount } from "@/api/incomingRequests";
import { BlockedList } from "@/components/connections/BlockedList";
import { ConnectionsList } from "@/components/connections/ConnectionsList";
import { FindPeople } from "@/components/connections/FindPeople";
import { RequestsInbox } from "@/components/connections/RequestsInbox";
import { cn } from "@/lib/cn";

type Tab = "connections" | "requests" | "blocked";

const TABS: { key: Tab; label: string }[] = [
  { key: "connections", label: "Connections" },
  { key: "requests", label: "Requests" },
  { key: "blocked", label: "Blocked" },
];

function isTab(value: string | null): value is Tab {
  return value === "connections" || value === "requests" || value === "blocked";
}

export function ConnectionsTabs() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const active: Tab = isTab(raw) ? raw : "connections";

  function selectTab(next: Tab) {
    if (next === "connections") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    setParams(params, { replace: true });
  }

  return (
    <div className="flex flex-col gap-4">
      <TabBar active={active} onSelect={selectTab} />
      <div
        role="tabpanel"
        id={`connections-panel-${active}`}
        aria-labelledby={`connections-tab-${active}`}
      >
        {active === "connections" && <ConnectionsTab />}
        {active === "requests" && <RequestsTab />}
        {active === "blocked" && <BlockedTab />}
      </div>
    </div>
  );
}

function TabBar({ active, onSelect }: { active: Tab; onSelect: (next: Tab) => void }) {
  const incomingCount = useIncomingRequestCount(true);

  return (
    <div
      role="tablist"
      aria-label="Connections sections"
      className="flex gap-1 border-b border-border"
    >
      {TABS.map((t) => {
        const selected = t.key === active;
        const showBadge = t.key === "requests" && incomingCount > 0;
        const label = showBadge ? `${t.label} (${incomingCount})` : t.label;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`connections-panel-${t.key}`}
            id={`connections-tab-${t.key}`}
            onClick={() => onSelect(t.key)}
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
  );
}

function ConnectionsTab() {
  return (
    <div className="flex flex-col gap-6">
      <FindPeople />
      <ConnectionsList />
    </div>
  );
}

function RequestsTab() {
  return <RequestsInbox />;
}

function BlockedTab() {
  return <BlockedList />;
}
