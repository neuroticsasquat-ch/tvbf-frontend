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
