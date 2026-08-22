/** Loading Cloudflare's Turnstile script, once per page.
 *
 * The widget is drawn by a script served from Cloudflare rather than by
 * anything we ship, so this module is the one place that reaches the network
 * for it. Two properties matter to the callers:
 *
 * - **An already-present `window.turnstile` short-circuits the load.** That is
 *   what keeps the test suite offline: `src/test/setup.ts` installs a fake
 *   before any test runs, so no `<script>` is ever appended and nothing can
 *   reach Cloudflare by accident.
 * - **A failed load is not cached.** The in-flight promise is cleared on
 *   error, so the retry the widget offers (NEU-1166 AC 4) genuinely re-attempts
 *   rather than replaying the rejection forever.
 */

/** The subset of the render options this app sets. Cloudflare's own names,
 * hyphens and all — they are wire keys, not ours to tidy. */
export interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  "timeout-callback": () => void;
}

export interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
  /** Present on the real script, absent on the test fake. With explicit
   * rendering Cloudflare asks callers to wait for it before calling `render`. */
  ready?: (callback: () => void) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** `render=explicit` stops the script auto-rendering any `.cf-turnstile`
 * element it finds, which would race the component's own `render` call. */
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let pending: Promise<TurnstileApi> | null = null;

export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (pending) return pending;

  pending = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const api = window.turnstile;
      if (!api) {
        pending = null;
        script.remove();
        reject(new Error("Turnstile script loaded without defining window.turnstile"));
        return;
      }
      if (typeof api.ready === "function") api.ready(() => resolve(api));
      else resolve(api);
    };
    script.onerror = () => {
      pending = null;
      script.remove();
      reject(new Error("Failed to load the Turnstile script"));
    };
    document.head.appendChild(script);
  });

  return pending;
}

/** Test seam: drops the memoised in-flight load. Production never needs this —
 * the script is loaded once per page — but a test that exercises the loader
 * twice would otherwise get the first attempt's promise back. */
export function resetTurnstileLoaderForTests(): void {
  pending = null;
}
