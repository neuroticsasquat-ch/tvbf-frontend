import { useQuery } from "@tanstack/react-query";
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
