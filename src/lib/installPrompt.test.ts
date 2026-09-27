import { afterEach, describe, expect, it } from "vitest";
import { offerInstall, withdrawInstall } from "@/test/installPrompt";
import { canInstall, promptInstall } from "./installPrompt";

afterEach(() => withdrawInstall());

describe("installPrompt", () => {
  it("has nothing to offer until the browser fires beforeinstallprompt", async () => {
    expect(canInstall()).toBe(false);
    expect(await promptInstall()).toBe("unavailable");
  });

  it("captures the event, holding back the browser's own infobar", () => {
    const { event } = offerInstall();
    expect(canInstall()).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it("prompts once and reports the answer; the event is spent after", async () => {
    const { prompt } = offerInstall("dismissed");
    expect(await promptInstall()).toBe("dismissed");
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(canInstall()).toBe(false);
  });

  it("forgets the event once the app is installed", () => {
    offerInstall();
    withdrawInstall();
    expect(canInstall()).toBe(false);
  });
});
