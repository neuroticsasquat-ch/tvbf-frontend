import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  listBlocks,
  listConnectionRequests,
  listConnections,
} from "@/api/connections";
import { FindPeople } from "@/components/connections/FindPeople";
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

export function ConnectionsPage() {
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
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Connections</h1>

      <div role="tablist" aria-label="Connections sections" className="flex gap-1 border-b border-border">
        {TABS.map((t) => {
          const selected = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`connections-panel-${t.key}`}
              id={`connections-tab-${t.key}`}
              onClick={() => selectTab(t.key)}
              className={cn(
                "px-3 py-2 text-sm border-b-2 -mb-px",
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

      <div
        role="tabpanel"
        id={`connections-panel-${active}`}
        aria-labelledby={`connections-tab-${active}`}
      >
        {active === "connections" && <ConnectionsTab />}
        {active === "requests" && <RequestsTab />}
        {active === "blocked" && <BlockedTab />}
      </div>
    </section>
  );
}

function ConnectionsTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["connections"],
    queryFn: listConnections,
  });
  return (
    <div className="flex flex-col gap-6">
      <FindPeople />
      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">Failed to load connections.</p>
      )}
      {!isLoading && !isError && (!data || data.length === 0) && (
        <p className="text-sm text-muted-foreground">
          No connections yet. Find people in user search to connect.
        </p>
      )}
      {/* List rendering ships in NEU-82. */}
    </div>
  );
}

function RequestsTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["connection-requests"],
    queryFn: listConnectionRequests,
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (isError) return <p className="text-sm text-destructive">Failed to load requests.</p>;
  const total = (data?.incoming.length ?? 0) + (data?.outgoing.length ?? 0);
  if (total === 0) {
    return <p className="text-sm text-muted-foreground">No pending requests.</p>;
  }
  // Inbox UI ships in NEU-81.
  return null;
}

function BlockedTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["blocks"],
    queryFn: listBlocks,
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (isError) return <p className="text-sm text-destructive">Failed to load blocked users.</p>;
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground">No blocked users.</p>;
  }
  // Block list UI ships in NEU-83.
  return null;
}
