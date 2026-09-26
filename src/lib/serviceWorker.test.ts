import { env } from "@/env";
import { registerServiceWorker } from "./serviceWorker";

function installServiceWorker(register: () => Promise<unknown>) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register: vi.fn(register) },
  });
  return (navigator as unknown as { serviceWorker: { register: ReturnType<typeof vi.fn> } })
    .serviceWorker.register;
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("registerServiceWorker", () => {
  it("does nothing where service workers are unsupported", () => {
    expect("serviceWorker" in navigator).toBe(false);
    expect(() => registerServiceWorker()).not.toThrow();
  });

  it("registers the root worker with the API base on its URL", () => {
    const register = installServiceWorker(() => Promise.resolve({}));
    registerServiceWorker();
    expect(register).toHaveBeenCalledWith(`/sw.js?api=${encodeURIComponent(env.apiBaseUrl)}`);
  });

  it("logs a failed registration instead of surfacing it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = new Error("insecure context");
    installServiceWorker(() => Promise.reject(error));

    registerServiceWorker();
    await vi.waitFor(() => expect(warn).toHaveBeenCalledWith(expect.any(String), error));
    warn.mockRestore();
  });
});
