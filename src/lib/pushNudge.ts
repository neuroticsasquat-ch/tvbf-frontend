import { useSyncExternalStore } from "react";
import { supportState } from "./push";

/** The one-time post-add push nudge (push-notifications project spec §6.4).
 *
 * A module-level store rather than context or props: `useAddShow`'s
 * `onSuccess` feeds it and `AppShell` draws it, so every add surface gets the
 * card without threading anything through. */

export const NUDGE_DISMISSED_KEY = "push-nudge-dismissed";

/** Deliberately not `usePersistedString` (unvalidated by design, and this is a
 * flag, not a value). Storage that throws reads as dismissed: a nudge whose
 * dismissal cannot be recorded would come back after every add. */
function nudgeDismissed(): boolean {
  try {
    return localStorage.getItem(NUDGE_DISMISSED_KEY) !== null;
  } catch {
    return true;
  }
}

let showName: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function recordNudgeSeen(): void {
  try {
    localStorage.setItem(NUDGE_DISMISSED_KEY, "1");
  } catch {
    // Nothing to do: the card still closes for this page load.
  }
}

/** Called after an add lands. Shows the card only where there is something to
 * turn on — permission not yet asked, or an iOS tab that must be installed
 * first. Reads state; never asks for permission.
 *
 * The key is set as the card appears, not only when it is dismissed or acted
 * on: the spec's "at most once per browser" would otherwise break for a viewer
 * who simply navigates away, and the card would return after every add. */
export function offerPushNudge(name: string): void {
  if (nudgeDismissed()) return;
  const state = supportState();
  if (state !== "prompt" && state !== "ios_needs_install") return;
  recordNudgeSeen();
  showName = name;
  emit();
}

/** Dismissing **or** acting: either way the card never comes back. */
export function dismissPushNudge(): void {
  recordNudgeSeen();
  clearPushNudge();
}

/** Close the card — the viewer left the page the add happened on. It was
 * already recorded as seen when it appeared, so it does not come back. */
export function clearPushNudge(): void {
  if (showName === null) return;
  showName = null;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The show the card is about, or null when there is no card. */
export function usePushNudge(): string | null {
  return useSyncExternalStore(subscribe, () => showName);
}
