import { describe, expect, it, beforeAll, afterAll, afterEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { useWatchNext, useUpcoming, useMyShows } from "./me";
import { env } from "@/env";

const requested: { path: string; today: string | null }[] = [];

const server = setupServer(
  http.get(`${env.apiBaseUrl}/me/watch-next`, ({ request }) => {
    const url = new URL(request.url);
    requested.push({ path: "/me/watch-next", today: url.searchParams.get("today") });
    return HttpResponse.json([]);
  }),
  http.get(`${env.apiBaseUrl}/me/upcoming`, ({ request }) => {
    const url = new URL(request.url);
    requested.push({ path: "/me/upcoming", today: url.searchParams.get("today") });
    return HttpResponse.json([]);
  }),
  http.get(`${env.apiBaseUrl}/me/shows`, ({ request }) => {
    const url = new URL(request.url);
    requested.push({ path: "/me/shows", today: url.searchParams.get("today") });
    return HttpResponse.json([]);
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  requested.length = 0;
  vi.useRealTimers();
});
afterAll(() => server.close());

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("/me hooks send local today", () => {
  it("useWatchNext sends today=YYYY-MM-DD from device local date", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 4, 6, 18, 14, 0));

    const { result } = renderHook(() => useWatchNext(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const hit = requested.find((r) => r.path === "/me/watch-next");
    expect(hit?.today).toBe("2026-05-06");
  });

  it("useUpcoming sends today on the request", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 4, 6, 18, 14, 0));

    const { result } = renderHook(() => useUpcoming(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const hit = requested.find((r) => r.path === "/me/upcoming");
    expect(hit?.today).toBe("2026-05-06");
  });

  it("useMyShows sends today on the request", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 4, 6, 18, 14, 0));

    const { result } = renderHook(() => useMyShows(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const hit = requested.find((r) => r.path === "/me/shows");
    expect(hit?.today).toBe("2026-05-06");
  });
});
