import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "./client";
import type { AdminUserRow } from "./types";

export function fetchAdminUsers(): Promise<AdminUserRow[]> {
  return apiFetch<AdminUserRow[]>("/admin/users");
}

export function useAdminUsers(enabled = true) {
  return useQuery<AdminUserRow[]>({
    queryKey: ["admin-users"],
    queryFn: fetchAdminUsers,
    enabled,
  });
}

export function patchAdminFlag(userId: string, isAdmin: boolean): Promise<AdminUserRow> {
  return apiFetch<AdminUserRow>(`/admin/users/${userId}/admin`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_admin: isAdmin }),
  });
}

export function useToggleAdminFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) =>
      patchAdminFlag(userId, isAdmin),
    onMutate: async ({ userId, isAdmin }) => {
      await qc.cancelQueries({ queryKey: ["admin-users"] });
      const prev = qc.getQueryData<AdminUserRow[]>(["admin-users"]);
      qc.setQueryData<AdminUserRow[]>(["admin-users"], (cur) =>
        cur?.map((u) => (u.id === userId ? { ...u, is_admin: isAdmin } : u)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["admin-users"], ctx.prev);
      toast.error("Could not update admin status.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

export function patchAdminDisabled(userId: string, disabled: boolean): Promise<AdminUserRow> {
  return apiFetch<AdminUserRow>(`/admin/users/${userId}/disabled`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disabled }),
  });
}

/** Set or clear a user's `disabled_at` (NEU-1168 §4.4).
 *
 * **Deliberately not optimistic, unlike `useToggleAdminFlag` above.**
 * `is_admin` is a boolean the client already knows the next value of;
 * `disabled_at` is a timestamp the *server* chooses, so an optimistic update
 * would have to invent one and then be corrected. Writing the returned row on
 * success makes the update exact rather than approximate — the route answers
 * with the full `AdminUserOut`, so there is nothing left to guess and no
 * refetch to spend.
 *
 * `onError` invalidates rather than rolling back: a `403 cannot_disable_self`
 * or a `404 user_not_found` here means the list the admin is reading is stale,
 * and there is no optimistic write to undo. */
export function useToggleDisabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, disabled }: { userId: string; disabled: boolean }) =>
      patchAdminDisabled(userId, disabled),
    onSuccess: (row) => {
      qc.setQueryData<AdminUserRow[]>(["admin-users"], (cur) =>
        cur?.map((u) => (u.id === row.id ? row : u)),
      );
    },
    onError: () => {
      toast.error("Could not update account status.");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}
