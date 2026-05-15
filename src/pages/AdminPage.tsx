import { Navigate, useSearchParams } from "react-router";
import { useAuth } from "@/components/AuthContext";
import { AdminUsersTab } from "@/components/admin/AdminUsersTab";
import { cn } from "@/lib/cn";

type Section = "users" | "invites";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "users", label: "Users" },
  { key: "invites", label: "Invites" },
];

function isSection(value: string | null): value is Section {
  return value === "users" || value === "invites";
}

export function AdminPage() {
  const { user, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  if (loading) return null;
  if (!user?.is_admin) return <Navigate to="/" replace />;

  const raw = params.get("section");
  const active: Section = isSection(raw) ? raw : "users";

  function selectSection(next: Section) {
    if (next === "users") {
      params.delete("section");
    } else {
      params.set("section", next);
    }
    setParams(params, { replace: true });
  }

  return (
    <section aria-label="Admin" className="space-y-4">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <div
        role="tablist"
        aria-label="Admin sections"
        className="flex gap-1 border-b border-border"
      >
        {SECTIONS.map((s) => {
          const selected = s.key === active;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`admin-panel-${s.key}`}
              id={`admin-tab-${s.key}`}
              onClick={() => selectSection(s.key)}
              className={cn(
                "px-3 py-2 text-sm border-b-2 -mb-px rounded-sm",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`admin-panel-${active}`} aria-labelledby={`admin-tab-${active}`}>
        {active === "users" ? (
          <AdminUsersTab />
        ) : (
          <p className="text-sm text-muted-foreground">Invites coming soon.</p>
        )}
      </div>
    </section>
  );
}
