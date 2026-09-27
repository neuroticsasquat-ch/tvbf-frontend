import { promptInstall, useCanInstall } from "@/lib/installPrompt";

/** Rendered only while the browser has offered an install (Chromium's
 * `beforeinstallprompt`); hidden everywhere else (§6.3). */
export function InstallAppButton({ onAct }: { onAct?: () => void }) {
  const canInstall = useCanInstall();
  if (!canInstall) return null;

  function onClick() {
    // The browser records the answer; a dismissal needs nothing from us.
    void promptInstall();
    onAct?.();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-border px-3 py-1 hover:bg-muted"
    >
      Install app
    </button>
  );
}
