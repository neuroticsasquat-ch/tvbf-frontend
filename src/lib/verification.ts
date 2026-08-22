/** The one copy of the "verify your email" sentences, and the one vocabulary
 * for a resend attempt.
 *
 * Three surfaces say this now — the app-shell banner, the Find People notice
 * and `VerifyEmailPage`'s error branch — which is this repo's own extraction
 * threshold (NEU-1193 at the third focus-after-removal, NEU-1057 at the third
 * library mark). The state machine that produces a `ResendStatus` lives in
 * `hooks/useResendVerification.ts`; the words it is rendered as live here.
 *
 * Tone is load-bearing (NEU-1167 §4): this is read by someone who signed up
 * minutes ago and has done nothing wrong, so it says *one more step*, never
 * anything that reads as an accusation or a security warning.
 */

export type ResendStatus = "idle" | "sending" | "sent" | "rate_limited" | "error";

/** Where the app-shell banner records a dismissal. `sessionStorage`, never
 * `localStorage` (NEU-1167 §3.3): the prompt gets out of the way of someone
 * mid-task and comes back on the next visit, so an account that never verifies
 * keeps being told why Connect does nothing. It lives here rather than in the
 * banner because a second surface — Find People's notice, which is deliberately
 * *not* dismissible — is asserted against it. */
export const BANNER_DISMISS_KEY = "tvbf.unverified-banner-dismissed";

/** The banner's sentence, split so the lead can be emphasised. */
export const VERIFY_PROMPT_LEAD = "One more step:";
export const VERIFY_PROMPT_BODY = "verify your email to connect with people and let them find you.";

/** The in-context notice on Find People. "and to let them find you" is the
 * only place the SPA says that an unverified account is excluded from other
 * people's search results (NEU-1161 §3.2) — without it, being undiscoverable
 * is invisible. */
export const VERIFY_NOTICE = "Verify your email to connect with people — and to let them find you.";

/** Shown when a connect attempt is refused — by the button's own guard, or by
 * the backend's 403 `email_not_verified` when a page-load-time state went
 * stale. */
export const VERIFY_BLOCKED =
  "Verify your email first — check your inbox, or resend from the banner at the top.";

export const RESEND_ACTION = "Resend verification email";
export const RESEND_SENDING = "Sending…";
export const DISMISS_ACTION = "Dismiss";

/** The outcome of a resend, or `null` while there is nothing to report. */
export function resendMessage(status: ResendStatus): string | null {
  switch (status) {
    case "sent":
      return "Verification email sent. Check your inbox.";
    case "rate_limited":
      return "You've requested too many emails recently. Try again in a few minutes.";
    case "error":
      return "Couldn't send verification email. Try again.";
    default:
      return null;
  }
}
