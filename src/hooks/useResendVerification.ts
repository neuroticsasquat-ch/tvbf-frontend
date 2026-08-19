import { useCallback, useState } from "react";
import * as authApi from "@/api/auth";
import { ApiError } from "@/api/client";
import type { ResendStatus } from "@/lib/verification";

/** The one resend state machine, shared by every surface that offers the
 * action (NEU-1167 §3.6).
 *
 * The route is `POST /me/email/verification` — authed, CSRF-required, `202` on
 * success (NEU-1161 §4 corrects the ticket, which names a route that has never
 * existed). Its **429** is the one failure worth distinguishing: the user did
 * the right thing and asked twice, so it earns "try again shortly" rather than
 * a generic failure. */
export function useResendVerification(): {
  status: ResendStatus;
  resend: () => Promise<void>;
} {
  const [status, setStatus] = useState<ResendStatus>("idle");

  const resend = useCallback(async () => {
    setStatus("sending");
    try {
      await authApi.requestEmailVerification();
      setStatus("sent");
    } catch (e) {
      setStatus(e instanceof ApiError && e.status === 429 ? "rate_limited" : "error");
    }
  }, []);

  return { status, resend };
}
