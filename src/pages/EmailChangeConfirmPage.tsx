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

/** /email-change/confirm?token=... — completes a pending email change. */
export function EmailChangeConfirmPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const { refresh } = useAuth();

  const [state, setState] = useState<State>(
    token ? { kind: "verifying" } : { kind: "missing_token" },
  );
  const consumedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token) return;
    if (consumedRef.current === token) return;
    consumedRef.current = token;
    (async () => {
      try {
        await authApi.confirmEmailChange({ token });
        await refresh();
        setState({ kind: "success" });
      } catch (e) {
        let message = "Something went wrong. Try again.";
        if (e instanceof ApiError) {
          if (e.status === 400)
            message = "This confirmation link is invalid or has expired.";
          else if (e.status === 409)
            message =
              "That email is already in use by another account. Pick a different one and try again.";
        }
        setState({ kind: "error", message });
      }
    })();
  }, [token, refresh]);

  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center space-y-4">
      <h1 className="text-2xl font-semibold">Confirm email change</h1>

      {state.kind === "verifying" && (
        <p role="status" aria-live="polite">
          Confirming your new email…
        </p>
      )}

      {state.kind === "missing_token" && (
        <p role="alert">No confirmation token in this link.</p>
      )}

      {state.kind === "success" && (
        <>
          <p>Your email address has been updated.</p>
          <Link to="/settings" className="inline-block underline">
            Back to settings
          </Link>
        </>
      )}

      {state.kind === "error" && (
        <>
          <p role="alert">{state.message}</p>
          <Link to="/settings" className="inline-block underline">
            Back to settings
          </Link>
        </>
      )}
    </div>
  );
}
