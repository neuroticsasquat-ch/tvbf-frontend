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
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-muted-foreground">
          <th className="py-2 pr-3 font-medium">Name</th>
          <th className="py-2 pr-3 font-medium">Email</th>
          <th className="py-2 pr-3 font-medium">Joined</th>
          <th className="py-2 pr-3 font-medium">Admin</th>
        </tr>
      </thead>
      <tbody>
        {data.map((u) => {
          const isSelf = u.id === viewer?.id;
          return (
            <tr key={u.id} className="border-b border-border last:border-b-0">
              <td className="py-2 pr-3">{u.display_name}</td>
              <td className="py-2 pr-3 text-muted-foreground">{u.email}</td>
              <td className="py-2 pr-3 text-muted-foreground">{formatDate(u.created_at)}</td>
              <td className="py-2 pr-3">
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
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
