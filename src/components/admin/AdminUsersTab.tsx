import { useMemo, useState } from "react";
import { useAdminUsers, useToggleAdminFlag } from "@/api/admin";
import { useAuth } from "@/components/AuthContext";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function AdminUsersTab() {
  const { user: viewer } = useAuth();
  const { data, isLoading, isError } = useAdminUsers();
  const toggle = useToggleAdminFlag();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (u) => u.email.toLowerCase().includes(q) || u.display_name.toLowerCase().includes(q),
    );
  }, [data, query]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading users…</p>;
  if (isError || !data) {
    return (
      <p className="text-sm text-red-600" role="alert">
        Failed to load users.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        placeholder="Filter by name or email"
        aria-label="Filter users"
        className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users match "{query}".</p>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((u) => {
            const isSelf = u.id === viewer?.id;
            return (
              <li
                key={u.id}
                className="flex items-center gap-3 py-3 text-sm"
                data-testid="admin-user-row"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{u.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  <p className="text-xs text-muted-foreground">Joined {formatDate(u.created_at)}</p>
                </div>
                <label className="inline-flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">Admin</span>
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={`Admin status for ${u.display_name}`}
                    checked={u.is_admin}
                    disabled={isSelf || toggle.isPending}
                    onChange={(e) =>
                      toggle.mutate({ userId: u.id, isAdmin: e.currentTarget.checked })
                    }
                  />
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
