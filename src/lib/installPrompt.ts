import { useSyncExternalStore } from "react";

/** Chromium's install prompt (push-notifications project spec §6.3). Not in
 * TypeScript's DOM library, since no other engine has it. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function setDeferred(next: BeforeInstallPromptEvent | null) {
  deferred = next;
  listeners.forEach((l) => l());
}

/** Captured at module load: the event fires once, early, and is gone for good
 * if nothing is listening. `preventDefault` holds back Chrome's own mini
 * infobar so the app's button is the one offer. */
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  setDeferred(e as BeforeInstallPromptEvent);
});
window.addEventListener("appinstalled", () => setDeferred(null));

export function canInstall(): boolean {
  return deferred !== null;
}

/** Show the browser's install dialog. Call only from a click handler. An
 * event can be prompted once, so it is spent either way. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = deferred;
  if (!event) return "unavailable";
  setDeferred(null);
  await event.prompt();
  return (await event.userChoice).outcome;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCanInstall(): boolean {
  return useSyncExternalStore(subscribe, canInstall);
}
