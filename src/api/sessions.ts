import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";

export interface SessionSummary {
  id: string;
  device_label: string;
  ip: string | null;
  last_seen_at: string;
  created_at: string;
  is_current: boolean;
}

export const fetchMySessions = () => apiFetch<SessionSummary[]>("/me/sessions");

export function useMySessions(enabled = true) {
  return useQuery<SessionSummary[]>({
    queryKey: ["my-sessions"],
    queryFn: fetchMySessions,
    enabled,
  });
}

export const revokeSession = (id: string) =>
  apiFetch<void>(`/me/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeSession,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["my-sessions"] });
      const prev = qc.getQueryData<SessionSummary[]>(["my-sessions"]);
      qc.setQueryData<SessionSummary[]>(["my-sessions"], (cur) =>
        cur ? cur.filter((s) => s.id !== id) : cur,
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["my-sessions"], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["my-sessions"] });
    },
  });
}

export const revokeOtherSessions = () =>
  apiFetch<{ revoked: number }>("/me/sessions/revoke-others", { method: "POST" });

export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-sessions"] });
    },
  });
}
