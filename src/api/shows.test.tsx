import { describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useShow, useShows, useShowEpisodes } from "./shows";

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useShows", () => {
  it("fetches the list page", async () => {
    const { result } = renderHook(() => useShows({ page: 1 }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(2);
    expect(result.current.data?.total).toBe(2);
  });
});

describe("useShow", () => {
  it("fetches a show by id", async () => {
    const { result } = renderHook(() => useShow(100), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(100);
    expect(result.current.data?.seasons).toHaveLength(2);
  });

  it("surfaces 404 as an error", async () => {
    const { result } = renderHook(() => useShow(999), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toHaveProperty("status", 404);
  });
});

describe("useShowEpisodes", () => {
  it("fetches default season episodes", async () => {
    const { result } = renderHook(() => useShowEpisodes(100), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it("fetches a specific season", async () => {
    const { result } = renderHook(() => useShowEpisodes(100, 2), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].season).toBe(2);
  });
});
