import { useState } from "react";
import { Mail } from "lucide-react";
import { useAuth } from "./AuthContext";
import * as authApi from "@/api/auth";
import { ApiError } from "@/api/client";

type Status = "idle" | "sending" | "sent" | "rate_limited" | "error";

/** Renders above the main content while a logged-in user has not yet verified
 * their email. Disappears as soon as `me.email_verified_at` flips non-null. */
export function UnverifiedEmailBanner() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>("idle");

  if (!user || user.email_verified_at !== null) return null;

  async function resend() {
    setStatus("sending");
    try {
      await authApi.requestEmailVerification();
      setStatus("sent");
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) setStatus("rate_limited");
      else setStatus("error");
    }
  }

  const message =
    status === "sent"
      ? "Verification email sent. Check your inbox."
      : status === "rate_limited"
        ? "You've requested too many emails recently. Try again in a few minutes."
        : status === "error"
          ? "Couldn't send verification email. Try again."
          : "Please verify your email address to keep your account secure.";

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
        <Mail className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex-1">{message}</span>
        {status !== "sent" && (
          <button
            type="button"
            onClick={resend}
            disabled={status === "sending"}
            className="rounded border border-amber-400 px-2 py-1 text-xs font-medium hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:hover:bg-amber-900"
          >
            {status === "sending" ? "Sending…" : "Resend verification email"}
          </button>
        )}
      </div>
    </div>
  );
}
