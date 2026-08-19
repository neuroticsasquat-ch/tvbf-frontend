import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./msw/server";
import { installFakeTurnstile } from "./turnstile";

// Radix UI uses pointer capture and scroll APIs not available in jsdom.
// Polyfill them so Radix Select (and other Radix primitives) work in tests.
if (typeof window !== "undefined") {
  window.HTMLElement.prototype.hasPointerCapture = () => false;
  window.HTMLElement.prototype.setPointerCapture = () => undefined;
  window.HTMLElement.prototype.releasePointerCapture = () => undefined;
  window.HTMLElement.prototype.scrollIntoView = () => undefined;
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver ??=
    ResizeObserverStub as unknown as typeof ResizeObserver;
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
// Installed for every test, not only the ones that assert on it: `loadTurnstile`
// short-circuits when `window.turnstile` is already defined, so this is what
// makes "no test reaches Cloudflare" structural rather than a convention each
// test file has to remember. MSW cannot cover it — a `<script>` tag is not a
// request MSW can intercept.
beforeEach(() => installFakeTurnstile());
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
