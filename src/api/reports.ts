import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { ApiError } from "./client";

export type ReportInput = { reportedUserId: string; reason: string };

/** `POST /reports` — one user reports another (NEU-1162 §7.2).
 *
 * Its own module rather than a second `/me` route in `api/me.ts`: the path is
 * top-level and the subject is a third party, which is the same reason
 * `connections.ts` and `admin.ts` are separate from it.
 *
 * The route is **204 on success and carries no body**, because the row is
 * committed before the notification is even attempted — the reporter is told
 * "received" exactly when it has genuinely been received. It invalidates
 * nothing: a report changes no cache the SPA holds, and there is no read route
 * for reports at all yet (NEU-1197). */
export function submitReport({ reportedUserId, reason }: ReportInput): Promise<void> {
  return apiFetch<void>("/reports", {
    method: "POST",
    body: JSON.stringify({ reported_user_id: reportedUserId, reason }),
  });
}

export function useSubmitReport() {
  return useMutation<void, ApiError, ReportInput>({ mutationFn: submitReport });
}
