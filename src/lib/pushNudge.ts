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

/** Called after an add lands. Shows the card only where there is something to
 * turn on — permission not yet asked, or an iOS tab that must be installed
 * first — and only until the viewer has dismissed or acted on it once. Reads
 * state; never asks for permission. */
export function offerPushNudge(name: string): void {
  if (nudgeDismissed()) return;
  const state = supportState();
  if (state !== "prompt" && state !== "ios_needs_install") return;
  showName = name;
  emit();
}

/** Dismissing **or** acting: either way the card never comes back. */
export function dismissPushNudge(): void {
  try {
    localStorage.setItem(NUDGE_DISMISSED_KEY, "1");
  } catch {
    // Nothing to do: the card still closes for this page load.
  }
  clearPushNudge();
}

/** Close the card without recording anything — the viewer left the page the
 * add happened on, which is neither a dismissal nor an answer. */
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
