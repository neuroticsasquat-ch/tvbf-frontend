import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Toaster, toast } from "sonner";
import { server } from "@/test/msw/server";
import { RELOAD_AFTER_HIDDEN_MS } from "@/lib/versionCheck";
import { useVersionCheck } from "./useVersionCheck";

let visibility: DocumentVisibilityState = "visible";

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

/** Serves `version.json` via `respond`, counting requests. */
function serveVersion(respond: () => Response) {
  const calls = { count: 0 };
  server.use(
    http.get("*/version.json", () => {
      calls.count += 1;
      return respond();
    }),
  );
  return calls;
}

function Harness({ reload }: { reload: () => void }) {
  useVersionCheck("abc", reload);
  return <Toaster />;
}

describe("useVersionCheck", () => {
  beforeEach(() => {
    visibility = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
  });

  afterEach(() => {
    // Sonner's store is module-global and the prompt never times out, so a toast
    // left over from one test would otherwise render into the next one's Toaster.
    act(() => {
      toast.dismiss();
    });
    vi.useRealTimers();
    // Back to jsdom's own getter on the prototype.
    delete (document as { visibilityState?: unknown }).visibilityState;
  });

  it("offers a reload for a different version, and Reload reloads", async () => {
    serveVersion(() => HttpResponse.json({ version: "def" }));
    const reload = vi.fn();
    render(<Harness reload={reload} />);

    setVisibility("hidden");
    setVisibility("visible");

    const button = await screen.findByRole("button", { name: "Reload" });
    expect(screen.getByText("A new version is available")).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();

    await userEvent.click(button);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads outright after the page was hidden past the threshold", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const calls = serveVersion(() => HttpResponse.json({ version: "def" }));
    const reload = vi.fn();
    render(<Harness reload={reload} />);

    setVisibility("hidden");
    vi.setSystemTime(Date.now() + RELOAD_AFTER_HIDDEN_MS);
    setVisibility("visible");

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(calls.count).toBe(1);
    expect(screen.queryByText("A new version is available")).not.toBeInTheDocument();
  });

  it("shows nothing when the versions match", async () => {
    const calls = serveVersion(() => HttpResponse.json({ version: "abc" }));
    render(<Harness reload={vi.fn()} />);

    setVisibility("hidden");
    setVisibility("visible");

    await waitFor(() => expect(calls.count).toBe(1));
    expect(screen.queryByText("A new version is available")).not.toBeInTheDocument();
  });

  it("shows nothing on a network error", async () => {
    const calls = serveVersion(() => HttpResponse.error());
    render(<Harness reload={vi.fn()} />);

    setVisibility("hidden");
    setVisibility("visible");

    await waitFor(() => expect(calls.count).toBe(1));
    expect(screen.queryByText("A new version is available")).not.toBeInTheDocument();
  });

  it("shows nothing when a missing version.json answers 200 with the SPA's HTML", async () => {
    const calls = serveVersion(() =>
      HttpResponse.html("<!doctype html><html><body><div id='root'></div></body></html>"),
    );
    const reload = vi.fn();
    render(<Harness reload={reload} />);

    setVisibility("hidden");
    setVisibility("visible");

    await waitFor(() => expect(calls.count).toBe(1));
    expect(screen.queryByText("A new version is available")).not.toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it("makes no second request for a return inside the throttle window", async () => {
    const calls = serveVersion(() => HttpResponse.json({ version: "abc" }));
    render(<Harness reload={vi.fn()} />);

    setVisibility("hidden");
    setVisibility("visible");
    await waitFor(() => expect(calls.count).toBe(1));

    setVisibility("hidden");
    setVisibility("visible");
    // Give a second request, were one made, the chance to land.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls.count).toBe(1);
  });
});
