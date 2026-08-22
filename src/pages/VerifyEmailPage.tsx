import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import * as authApi from "@/api/auth";
import { ApiError } from "@/api/client";
import { useAuth } from "@/components/AuthContext";
import { useResendVerification } from "@/hooks/useResendVerification";
import { RESEND_ACTION, RESEND_SENDING, resendMessage } from "@/lib/verification";

type State =
  | { kind: "verifying" }
  | { kind: "success" }
  | { kind: "missing_token" }
  | { kind: "error"; message: string };

/** /verify-email?token=... — consumes the token from the email link. */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const { user, refresh } = useAuth();

  const [state, setState] = useState<State>(
    token ? { kind: "verifying" } : { kind: "missing_token" },
  );
  // Strict-mode-safe single-fire: guarantees we only call the API once for a
  // given token, even though React runs effects twice in dev.
  const consumedRef = useRef<string | null>(null);
  // The same resend the banner and the Find People notice offer, including the
  // 429 mapping — one state machine, one set of words (NEU-1167 §3.6).
  const { status: resendStatus, resend } = useResendVerification();
  const resendOutcome = resendMessage(resendStatus);

  useEffect(() => {
    if (!token) return;
    if (consumedRef.current === token) return;
    consumedRef.current = token;
    (async () => {
      try {
        await authApi.verifyEmail({ token });
        // Refresh `me` so the banner disappears for already-signed-in users.
        await refresh();
        setState({ kind: "success" });
      } catch (e) {
        const message =
          e instanceof ApiError && e.status === 400
            ? "This verification link is invalid or has expired."
            : "Something went wrong verifying your email. Try again.";
        setState({ kind: "error", message });
      }
    })();
  }, [token, refresh]);

  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center space-y-4">
      <h1 className="text-2xl font-semibold">Verify your email</h1>

      {state.kind === "verifying" && (
        <p role="status" aria-live="polite">
          Verifying your email…
        </p>
      )}

      {state.kind === "missing_token" && <p role="alert">No verification token in this link.</p>}

      {state.kind === "success" && (
        <>
          <p>Your email is verified. Thanks!</p>
          <Link to="/" className="inline-block underline">
            Back to TV BingeFriend
          </Link>
        </>
      )}

      {state.kind === "error" && (
        <>
          <p role="alert">{state.message}</p>
          {user && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={resend}
                disabled={resendStatus === "sending"}
                className="rounded bg-foreground text-background px-3 py-1 disabled:opacity-50"
              >
                {resendStatus === "sending" ? RESEND_SENDING : RESEND_ACTION}
              </button>
              {resendOutcome && (
                <p
                  className={
                    resendStatus === "error"
                      ? "text-sm text-red-600"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {resendOutcome}
                </p>
              )}
            </div>
          )}
          {!user && (
            <p className="text-sm text-muted-foreground">
              <Link to="/login" className="underline">
                Log in
              </Link>{" "}
              to request a new verification email.
            </p>
          )}
        </>
      )}
    </div>
  );
}
