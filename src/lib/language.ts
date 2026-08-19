/** ISO 639-1 language codes as English display names (NEU-1190 §3).
 *
 * `catalog.show.original_language` has carried an ISO code rather than a name
 * since NEU-1047 repointed browse at TMDB, and `ShowList` printed it verbatim,
 * so a search row read `NBC · Ended · en`.
 *
 * Two things are load-bearing.
 *
 * **The locale is pinned to `"en"`, not the browser's.** The rest of the app is
 * English, so "Coreano" beside an English UI is worse than `ko` — and a pinned
 * locale is what keeps the tests deterministic rather than dependent on
 * whatever the runner's default happens to be.
 *
 * **A code that does not map returns null, so the caller omits the segment.**
 * TMDB emits non-standard values — `cn` for Cantonese is the known one — and
 * `Intl.DisplayNames` hands an unrecognised code straight back under its
 * default `fallback: "code"`, which is precisely the raw code AC 6 forbids
 * reaching a user. `fallback: "none"` is what makes "unmapped ⇒ absent" true
 * for every code rather than for the ones that happened to be tested. A
 * structurally invalid value throws instead of answering, so that is caught to
 * the same answer.
 */
const DISPLAY_NAMES = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" });

export function languageName(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    return DISPLAY_NAMES.of(code) ?? null;
  } catch {
    return null;
  }
}
