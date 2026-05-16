import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "./client";
import type { InviteRow } from "./types";

export function fetchInvites(): Promise<InviteRow[]> {
  return apiFetch<InviteRow[]>("/admin/invites/cookie");
}

export function useInvites(enabled = true) {
  return useQuery<InviteRow[]>({
    queryKey: ["admin-invites"],
    queryFn: fetchInvites,
    enabled,
  });
}

export function sendInvite(email: string): Promise<InviteRow> {
  return apiFetch<InviteRow>("/admin/invites/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export function useSendInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendInvite,
    onSuccess: (row) => {
      qc.setQueryData<InviteRow[]>(["admin-invites"], (cur) =>
        cur ? [row, ...cur] : [row],
      );
      toast.success(`Invite sent to ${row.email_hint ?? "—"}.`);
    },
    onError: () => {
      toast.error("Could not send the invite.");
    },
  });
}
