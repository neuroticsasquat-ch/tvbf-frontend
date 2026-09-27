import { act } from "@testing-library/react";
import { vi } from "vitest";

/** Fire Chromium's `beforeinstallprompt`, which `lib/installPrompt` captured a
 * listener for at import. Returns the event's `prompt` spy. */
export function offerInstall(outcome: "accepted" | "dismissed" = "accepted") {
  const prompt = vi.fn(async () => undefined);
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return { prompt, event };
}

/** Forget any captured event, as an install does. */
export function withdrawInstall(): void {
  act(() => {
    window.dispatchEvent(new Event("appinstalled"));
  });
}
