import { useState } from "react";
import { Mail } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useResendVerification } from "@/hooks/useResendVerification";
import {
  BANNER_DISMISS_KEY,
  DISMISS_ACTION,
  RESEND_ACTION,
  RESEND_SENDING,
  VERIFY_PROMPT_BODY,
  VERIFY_PROMPT_LEAD,
  resendMessage,
} from "@/lib/verification";

/** Renders above the main content while a logged-in user has not yet verified
 * their email. Disappears as soon as `me.email_verified_at` flips non-null.
 *
 * It is the *dismissible* half of the explanation; the Find People notice is
 * the floor its dismissal cannot go below. */
export function UnverifiedEmailBanner() {
  const { user } = useAuth();
  const { status, resend } = useResendVerification();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(BANNER_DISMISS_KEY) !== null,
  );

  if (!user || user.email_verified_at !== null || dismissed) return null;

  function dismiss() {
    sessionStorage.setItem(BANNER_DISMISS_KEY, "1");
    setDismissed(true);
  }

  const outcome = resendMessage(status);

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
        <Mail className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex-1">
          {outcome ?? (
            <>
              <strong className="font-semibold">{VERIFY_PROMPT_LEAD}</strong> {VERIFY_PROMPT_BODY}
            </>
          )}
        </span>
        {status !== "sent" && (
          <button
            type="button"
            onClick={resend}
            disabled={status === "sending"}
            className="rounded border border-amber-400 px-2 py-1 text-xs font-medium hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:hover:bg-amber-900"
          >
            {status === "sending" ? RESEND_SENDING : RESEND_ACTION}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="rounded border border-transparent px-2 py-1 text-xs font-medium underline hover:bg-amber-100 dark:hover:bg-amber-900"
        >
          {DISMISS_ACTION}
        </button>
      </div>
    </div>
  );
}
