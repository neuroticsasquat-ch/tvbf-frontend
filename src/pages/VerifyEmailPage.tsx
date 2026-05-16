import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import * as authApi from "@/api/auth";
import { ApiError } from "@/api/client";
import { useAuth } from "@/components/AuthContext";

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
  const [resendStatus, setResendStatus] = useState<
    "idle" | "sending" | "sent" | "rate_limited" | "error"
  >("idle");

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

  async function resendVerification() {
    setResendStatus("sending");
    try {
      await authApi.requestEmailVerification();
      setResendStatus("sent");
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) setResendStatus("rate_limited");
      else setResendStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center space-y-4">
      <h1 className="text-2xl font-semibold">Verify your email</h1>

      {state.kind === "verifying" && (
        <p role="status" aria-live="polite">
          Verifying your email…
        </p>
      )}

      {state.kind === "missing_token" && (
        <p role="alert">No verification token in this link.</p>
      )}

      {state.kind === "success" && (
        <>
          <p>Your email is verified. Thanks!</p>
          <Link to="/" className="inline-block underline">
            Back to TV Binge Friend
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
                onClick={resendVerification}
                disabled={resendStatus === "sending"}
                className="rounded bg-foreground text-background px-3 py-1 disabled:opacity-50"
              >
                {resendStatus === "sending"
                  ? "Sending…"
                  : "Send a new verification email"}
              </button>
              {resendStatus === "sent" && (
                <p className="text-sm text-muted-foreground">
                  Sent. Check your inbox.
                </p>
              )}
              {resendStatus === "rate_limited" && (
                <p className="text-sm text-muted-foreground">
                  Too many requests. Try again in a few minutes.
                </p>
              )}
              {resendStatus === "error" && (
                <p className="text-sm text-red-600">
                  Couldn't send a new email. Try again.
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
