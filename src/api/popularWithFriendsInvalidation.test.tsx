import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";

import { env } from "@/env";
import { server } from "@/test/msw/server";
import { useAddShow, usePopularWithFriends, useRemoveShow, useShowRating } from "./me";

/** Its own file, not a block in `me.test.tsx`, for the reason
 * `recommendationsInvalidation.test.tsx` gives: that file runs a second MSW
 * server, which double-handles every request and breaks a request count. */

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

/** `GET /me/friends/popular` carries `in_my_shows` and `my_rating`, and the
 * route is `no-store` (project spec §5.2). `staleTime: 0` only refetches on
 * mount, so a tab left open would show the pre-toggle mark; invalidation is
 * what refreshes it (NEU-1500). */
describe("mutations refresh the popular-with-friends key", () => {
  function countingWrapper() {
    let calls = 0;
    server.use(
      http.get(`${env.apiBaseUrl}/me/friends/popular`, () => {
        calls += 1;
        return HttpResponse.json({ window_days: 14, connection_count: 1, shows: [] });
      }),
      http.put(`${env.apiBaseUrl}/me/shows/:id`, () => new HttpResponse(null, { status: 204 })),
      http.delete(`${env.apiBaseUrl}/me/shows/:id`, () => new HttpResponse(null, { status: 204 })),
      http.put(`${env.apiBaseUrl}/me/shows/:id/rating`, () => HttpResponse.json({ stars: 4 })),
    );
    return { wrapper: makeWrapper(), calls: () => calls };
  }

  const CASES: { label: string; useFire: () => () => void }[] = [
    {
      label: "adding a show",
      useFire: () => {
        const m = useAddShow();
        return () => m.mutate({ showId: 1, showName: "Show" });
      },
    },
    {
      label: "removing a show",
      useFire: () => {
        const m = useRemoveShow();
        return () => m.mutate(1);
      },
    },
    {
      label: "rating a show",
      useFire: () => {
        const m = useShowRating(1);
        return () => m.mutate(4);
      },
    },
  ];

  it.each(CASES)("refetches after $label", async ({ useFire }) => {
    const { wrapper, calls } = countingWrapper();
    const { result } = renderHook(() => ({ query: usePopularWithFriends(), fire: useFire() }), {
      wrapper,
    });
    await waitFor(() => expect(calls()).toBe(1));

    result.current.fire();

    await waitFor(() => expect(calls()).toBe(2));
  });
});
