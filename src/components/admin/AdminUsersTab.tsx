import { useAdminUsers, useToggleAdminFlag } from "@/api/admin";
import { useAuth } from "@/components/AuthContext";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function AdminUsersTab() {
  const { user: viewer } = useAuth();
  const { data, isLoading, isError } = useAdminUsers();
  const toggle = useToggleAdminFlag();

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading users…</p>;
  if (isError || !data) {
    return (
      <p className="text-sm text-red-600" role="alert">
        Failed to load users.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {data.map((u) => {
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
  );
}
