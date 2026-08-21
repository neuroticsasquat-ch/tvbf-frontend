import { useMemo, useState } from "react";
import { useAdminUsers, useToggleAdminFlag, useToggleDisabled } from "@/api/admin";
import type { AdminUserRow } from "@/api/types";
import { useAuth } from "@/components/AuthContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { UserIdentity } from "@/components/UserIdentity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { nameWithHandle } from "@/lib/userLabel";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function AdminUsersTab() {
  const { user: viewer } = useAuth();
  const { data, isLoading, isError } = useAdminUsers();
  const toggle = useToggleAdminFlag();
  const disable = useToggleDisabled();
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<AdminUserRow | null>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.display_name.toLowerCase().includes(q) ||
        // The handle is the one label a moderator can be handed verbatim in a
        // report, so the box that finds a person has to match on it.
        u.handle.includes(q),
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

  // No reordering and no "Disabled only" filter (§4.1). Floating disabled rows
  // to the top abandons the `created_at` order the backend returns and re-sorts
  // under the admin the moment they act; a filter is speculative at today's
  // user count, where the search box above already answers "find this person"
  // and NEU-1197's report queue is what will really answer "who needs
  // attention".
  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        placeholder="Filter by name, handle or email"
        aria-label="Filter users"
        className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users match "{query}".</p>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((u) => {
            const isSelf = u.id === viewer?.id;
            const disabled = u.disabled_at !== null;
            return (
              <li
                key={u.id}
                className="flex items-center gap-3 py-3 text-sm"
                data-testid="admin-user-row"
              >
                <div className="min-w-0 flex-1">
                  {/* A div, not a p: `Badge` renders a div, which is invalid
                      nesting inside a paragraph. */}
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <UserIdentity displayName={u.display_name} handle={u.handle} />
                    {disabled ? <Badge variant="destructive">Disabled</Badge> : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Joined {formatDate(u.created_at)}
                    {/* The date is shown because `disabled_at` is the *only*
                        record the act leaves anywhere — there is no
                        `disabled_by` and no `disabled_reason` (NEU-1162 §1.1). */}
                    {u.disabled_at ? ` · Disabled ${formatDate(u.disabled_at)}` : ""}
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">Admin</span>
                  <input
                    type="checkbox"
                    role="switch"
                    // Both labels, because this switch repeats down every row:
                    // with `display_name` alone a screen reader user moving
                    // through the list hears the *same* accessible name on two
                    // different switches, one of which grants admin to the
                    // wrong person (§4.3).
                    aria-label={`Admin status for ${nameWithHandle(u)}`}
                    checked={u.is_admin}
                    disabled={isSelf || toggle.isPending}
                    onChange={(e) =>
                      toggle.mutate({ userId: u.id, isAdmin: e.currentTarget.checked })
                    }
                  />
                </label>
                {/* Not rendered on the viewer's own row (§4.3): a control that
                    exists only to be dead is worse than an absent one, and the
                    row carries the viewer's own email, so it needs no label to
                    be recognised. The route's `403 cannot_disable_self` stays
                    as a backstop for a stale list. A **button**, not a switch —
                    a switch reads as a preference, and this is an act on a
                    person. */}
                {isSelf ? null : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => setConfirming(u)}
                    // Scoped to the row being acted on. A bare
                    // `disable.isPending` would grey out every button in the
                    // list while one account's toggle is in flight — one
                    // mutation hook serves every row, so its pending flag says
                    // nothing about the others.
                    disabled={disable.isPending && disable.variables?.userId === u.id}
                  >
                    {disabled ? "Enable" : "Disable"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Both directions confirm (§4.2). Re-admitting an account you disabled
          for abuse is a real decision — arguably heavier than disabling, since
          the person on the other side is one you already judged — and an
          accidental click should not silently reopen the door.

          No typed confirmation. That is the ceremony this app spends on
          irreversibility (`DeleteAccountDialog` spends a password on it), and
          spending it here teaches the admin that disable ≈ delete, which is the
          confusion AC 2 exists to prevent. The dialog naming the person buys
          most of what a typed string would. */}
      {confirming &&
        (confirming.disabled_at === null ? (
          <ConfirmDialog
            title={`Disable ${nameWithHandle(confirming)}`}
            description={`They will be signed out everywhere and cannot log in. Their watch history is kept, and you can re-enable them at any time. This is not account deletion.`}
            confirmLabel="Disable account"
            destructive
            pending={disable.isPending}
            onConfirm={() => {
              disable.mutate({ userId: confirming.id, disabled: true });
              setConfirming(null);
            }}
            onClose={() => setConfirming(null)}
          />
        ) : (
          <ConfirmDialog
            title={`Enable ${nameWithHandle(confirming)}`}
            description={`They will be able to log in again. Their sessions ended when they were disabled, so they will need to sign in.`}
            confirmLabel="Enable account"
            pending={disable.isPending}
            onConfirm={() => {
              disable.mutate({ userId: confirming.id, disabled: false });
              setConfirming(null);
            }}
            onClose={() => setConfirming(null)}
          />
        ))}
    </div>
  );
}
