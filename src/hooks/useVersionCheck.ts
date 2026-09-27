import { useEffect } from "react";
import { toast } from "sonner";
import { decideVersionAction, parseDeployedVersion } from "@/lib/versionCheck";

declare const __APP_VERSION__: string | undefined;

/** This build's id, compiled in by `vite build` (see `vite.config.ts`), which
 * also writes it to `dist/version.json`. Null under `vite` dev and in tests,
 * where there is no `version.json` to compare against. */
export const APP_VERSION: string | null =
  typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : null;

/** At most one `version.json` fetch per this long, so switching apps back and
 * forth doesn't turn into a request per switch. */
export const VERSION_CHECK_THROTTLE_MS = 5 * 60 * 1000;

const TOAST_ID = "new-version";

// Module scope, so the default argument is one stable reference: a fresh arrow
// per render would re-run the effect and reset the throttle with it.
const reloadPage = () => window.location.reload();

async function fetchDeployedVersion(): Promise<string | null> {
  try {
    // A same-origin static file, not an API call, so not through api/client.
    const res = await fetch(`${window.location.origin}/version.json`, { cache: "no-store" });
    if (!res.ok) return null;
    return parseDeployedVersion(await res.json());
  } catch {
    return null;
  }
}

/** On returning to the foreground, picks up a new deploy (NEU-1504): reloads
 * after a long absence, otherwise offers a reload once per new version. Call
 * once, near the root. Every failure is silent. */
export function useVersionCheck(
  currentVersion: string | null = APP_VERSION,
  reload: () => void = reloadPage,
) {
  useEffect(() => {
    if (!currentVersion) return;
    const current = currentVersion;

    let hiddenAt = document.visibilityState === "hidden" ? Date.now() : null;
    let lastCheckAt: number | null = null;
    let promptedVersion: string | null = null;
    let active = true;

    async function onVisibilityChange() {
      const now = Date.now();
      if (document.visibilityState === "hidden") {
        hiddenAt = now;
        return;
      }
      if (document.visibilityState !== "visible") return;
      const hiddenMs = hiddenAt === null ? 0 : now - hiddenAt;
      hiddenAt = null;
      if (lastCheckAt !== null && now - lastCheckAt < VERSION_CHECK_THROTTLE_MS) return;
      lastCheckAt = now;

      const deployed = await fetchDeployedVersion();
      if (!active || deployed === null) return;
      const action = decideVersionAction({ current, deployed, hiddenMs, promptedVersion });
      if (action === "reload") {
        reload();
      } else if (action === "prompt") {
        promptedVersion = deployed;
        toast("A new version is available", {
          id: TOAST_ID,
          duration: Infinity,
          action: { label: "Reload", onClick: () => reload() },
        });
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [currentVersion, reload]);
}
