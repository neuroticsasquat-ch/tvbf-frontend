import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { loadTurnstile } from "@/lib/turnstile";

/** Where the challenge is in its lifecycle. `pending` is the widget drawn and
 * waiting on the visitor; `solved` is the only phase that has a token. */
type Phase = "loading" | "pending" | "solved" | "expired" | "error";

interface TurnstileWidgetProps {
  siteKey: string;
  /** Called with the token the moment the challenge resolves, and with `null`
   * every time it stops being valid — on load failure, on the widget erroring,
   * and on expiry. The caller's submit gate is `token !== null`, so the null
   * calls are what make an expired challenge close the form again rather than
   * leaving a stale token behind. */
  onToken: (token: string | null) => void;
}

/**
 * Cloudflare Turnstile, rendered explicitly (NEU-1166).
 *
 * The component owns the whole widget lifecycle — script load, render, the
 * error and expiry states, and the retry — so the form it sits in only has to
 * hold a token and decide whether to submit. Two things are load-bearing:
 *
 * - **Retry re-runs the effect rather than calling `turnstile.reset`.** A reset
 *   only exists once a widget has been rendered, and the failure most worth
 *   recovering from is the script never loading at all, where there is no
 *   widget id to reset. Re-running covers both from one control.
 * - **A remount is how the caller asks for a fresh challenge.** A Turnstile
 *   token is single-use and is spent by the backend on every attempt it
 *   verifies, so a signup that fails for any reason afterwards — a duplicate
 *   email, say — leaves the visitor holding a token that can never work again.
 *   `SignupPage` changes this component's `key` to force a new one.
 */
export function TurnstileWidget({ siteKey, onToken }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");

  // Kept in a ref so a parent re-render that hands us a new function identity
  // does not tear down and re-draw the challenge underneath the visitor.
  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    onTokenRef.current(null);

    loadTurnstile()
      .then((turnstile) => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        setPhase("pending");
        widgetIdRef.current = turnstile.render(container, {
          sitekey: siteKey,
          callback: (token) => {
            onTokenRef.current(token);
            setPhase("solved");
          },
          "error-callback": () => {
            onTokenRef.current(null);
            setPhase("error");
          },
          "expired-callback": () => {
            onTokenRef.current(null);
            setPhase("expired");
          },
          "timeout-callback": () => {
            onTokenRef.current(null);
            setPhase("expired");
          },
        });
      })
      .catch(() => {
        if (cancelled) return;
        onTokenRef.current(null);
        setPhase("error");
      });

    return () => {
      cancelled = true;
      const id = widgetIdRef.current;
      widgetIdRef.current = null;
      if (id !== null) window.turnstile?.remove(id);
    };
  }, [siteKey, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return (
    <div data-turnstile-widget="">
      <div ref={containerRef} />
      {phase === "loading" ? (
        <p role="status" className="text-xs text-gray-500 mt-1">
          Loading the verification check…
        </p>
      ) : null}
      {phase === "error" || phase === "expired" ? (
        <div role="alert" className="mt-2 space-y-2">
          <p className="text-sm text-red-600">
            {phase === "expired"
              ? "The verification check expired."
              : "The verification check couldn't load."}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={retry}>
            Retry verification
          </Button>
        </div>
      ) : null}
    </div>
  );
}
