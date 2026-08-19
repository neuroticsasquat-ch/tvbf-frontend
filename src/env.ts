export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "https://api.tvbf.localhost",
  /** Cloudflare Turnstile's public site key (NEU-1166). Public by definition —
   * it is read by the widget in the browser and by nothing else, which is why
   * it lives here and deliberately not in the backend's config (NEU-1160 §9).
   *
   * Empty means the widget is not configured, and the signup form renders and
   * submits exactly as it did before. That mirrors the backend's
   * `TURNSTILE_ENABLED=False` default: nothing in either repo turns
   * verification on, so a form that demanded a challenge it has no key for
   * would make signup unusable in localdev and in the test suite. */
  turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "",
} as const;
