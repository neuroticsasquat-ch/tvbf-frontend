import { env } from "@/env";

/** Register `public/sw.js` (NEU-1483). Unconditional wherever the API exists —
 * a registered worker is part of what makes the app installable — and it never
 * asks for notification permission, which only a click in Settings may do
 * (push-notifications project spec §6.1, §6.2).
 *
 * The worker is plain JS served as-is and cannot read Vite's env, so the API
 * base rides on the script URL for its one re-subscribe request. A failure is
 * logged and nothing else: the app works the same without a worker. */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  const url = `/sw.js?api=${encodeURIComponent(env.apiBaseUrl)}`;
  navigator.serviceWorker.register(url).catch((err: unknown) => {
    console.warn("Service worker registration failed", err);
  });
}
