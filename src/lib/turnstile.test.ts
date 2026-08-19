import { beforeEach, describe, expect, it } from "vitest";

import { loadTurnstile, resetTurnstileLoaderForTests, type TurnstileApi } from "./turnstile";

const SCRIPT_SELECTOR = "script[src*='challenges.cloudflare.com']";

function fakeApi(ready?: (cb: () => void) => void): TurnstileApi {
  return { render: () => "w", reset: () => {}, remove: () => {}, ready };
}

function injectedScript(): HTMLScriptElement {
  const script = document.querySelector<HTMLScriptElement>(SCRIPT_SELECTOR);
  if (!script) throw new Error("no Turnstile script was injected");
  return script;
}

describe("loadTurnstile", () => {
  beforeEach(() => {
    // `setup.ts` installs a fake for every test; these tests are about the
    // path taken when one is *not* already there.
    delete window.turnstile;
    resetTurnstileLoaderForTests();
    document.querySelectorAll(SCRIPT_SELECTOR).forEach((s) => s.remove());
  });

  it("resolves from the window without touching the DOM", async () => {
    const api = fakeApi();
    window.turnstile = api;

    await expect(loadTurnstile()).resolves.toBe(api);
    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();
  });

  it("injects the script once and shares it between concurrent callers", async () => {
    const first = loadTurnstile();
    const second = loadTurnstile();

    const script = injectedScript();
    expect(script.src).toContain("render=explicit");
    expect(document.querySelectorAll(SCRIPT_SELECTOR)).toHaveLength(1);

    const api = fakeApi();
    window.turnstile = api;
    script.dispatchEvent(new Event("load"));

    await expect(first).resolves.toBe(api);
    await expect(second).resolves.toBe(api);
  });

  it("waits for turnstile.ready before resolving when the script defines it", async () => {
    const promise = loadTurnstile();
    const script = injectedScript();

    let release: (() => void) | undefined;
    const api = fakeApi((cb) => {
      release = cb;
    });
    window.turnstile = api;
    script.dispatchEvent(new Event("load"));

    expect(release).toBeDefined();
    release?.();
    await expect(promise).resolves.toBe(api);
  });

  it("rejects when the script loads without defining window.turnstile", async () => {
    const promise = loadTurnstile();
    injectedScript().dispatchEvent(new Event("load"));

    await expect(promise).rejects.toThrow(/without defining window.turnstile/);
  });

  it("rejects on a load failure and lets the next call try again", async () => {
    const promise = loadTurnstile();
    injectedScript().dispatchEvent(new Event("error"));

    await expect(promise).rejects.toThrow(/Failed to load/);
    // The failed attempt takes its script with it, so the retry is a real
    // second attempt rather than a replay of the same rejection.
    expect(document.querySelector(SCRIPT_SELECTOR)).toBeNull();

    const retry = loadTurnstile();
    retry.catch(() => {});
    expect(document.querySelectorAll(SCRIPT_SELECTOR)).toHaveLength(1);
  });
});
