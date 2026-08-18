import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";

import { env } from "@/env";
import { server } from "@/test/msw/server";
import { useAddShow, useRemoveShow, useShowRating } from "./me";
import { useShows, useSimilarShows } from "./shows";

/** Its own file rather than a block inside `me.test.tsx`, for the reason
 * `recommendationsInvalidation.test.tsx` gives: that file stands up a *second*
 * MSW server, so every request is handled twice — invisible to an assertion
 * about a query parameter and fatal to one that counts requests, which is the
 * whole mechanism here.
 *
 * **`staleTime` is not the mechanism, and these tests are what says so.**
 * `useShows` and `useSimilarShows` both keep a five-minute `staleTime`
 * (NEU-1184 §5.2) — search is the app's chattiest query, firing one request per
 * debounced keystroke, and the Discover panes' `staleTime: 0` is a separate
 * choice about two rarely-mounted surfaces rather than a rule that follows from
 * `no-store`. What keeps a mark from going stale is invalidation, so a refetch
 * counted here is a refetch that would not have happened on `staleTime` alone.
 */

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const SHOW_ID = 1;

/** Count both browse bodies and stub every mutation these tests fire. */
function countingWrapper() {
  let shows = 0;
  let similar = 0;
  server.use(
    http.get(`${env.apiBaseUrl}/shows`, () => {
      shows += 1;
      return HttpResponse.json({ items: [], page: 1, per_page: 50, total: 0, total_pages: 1 });
    }),
    http.get(`${env.apiBaseUrl}/shows/:id/similar`, () => {
      similar += 1;
      return HttpResponse.json([]);
    }),
    http.put(`${env.apiBaseUrl}/me/shows/:id`, () => new HttpResponse(null, { status: 204 })),
    http.delete(`${env.apiBaseUrl}/me/shows/:id`, () => new HttpResponse(null, { status: 204 })),
    http.put(`${env.apiBaseUrl}/me/shows/:id/rating`, () => HttpResponse.json({ stars: 4 })),
  );
  return { wrapper: makeWrapper(), shows: () => shows, similar: () => similar };
}

/** Both bodies are per-user *and* mutable by that user: `GET /shows` and
 * `GET /shows/{id}/similar` each carry `in_my_shows`, and both carry
 * `my_rating`. So a toggle or a rating changes what the server would send, and
 * a mounted grid must ask again (NEU-1184 §5.2). */
describe("a My Shows toggle refreshes both marked browse surfaces", () => {
  const CASES: { label: string; useFire: () => () => void }[] = [
    {
      label: "adding a show",
      useFire: () => {
        const m = useAddShow();
        return () => m.mutate(SHOW_ID);
      },
    },
    {
      label: "removing a show",
      useFire: () => {
        const m = useRemoveShow();
        return () => m.mutate(SHOW_ID);
      },
    },
  ];

  it.each(CASES)(
    "refetches search results and the similar list after $label",
    async ({ useFire }) => {
      const { wrapper, shows, similar } = countingWrapper();
      // An invalidation only refetches a query with an *active observer*
      // (`refetchType: "active"`), so both are mounted here — the case the
      // ticket is actually about, a grid on screen when the toggle is thrown.
      const { result } = renderHook(
        () => ({
          browse: useShows({ page: 1 }),
          similar: useSimilarShows(SHOW_ID),
          fire: useFire(),
        }),
        { wrapper },
      );
      await waitFor(() => expect(shows()).toBe(1));
      await waitFor(() => expect(similar()).toBe(1));

      result.current.fire();

      await waitFor(() => expect(shows()).toBe(2));
      await waitFor(() => expect(similar()).toBe(2));
    },
  );
});

describe("a show rating refreshes the similar list", () => {
  it("refetches `show-similar`, which now carries `my_rating`", async () => {
    // `useShowRating` already invalidated `["shows"]`; `/similar` carries the
    // rating only since NEU-1186, and a show is routinely similar to one the
    // viewer is rating — the case a browse-only invalidation misses.
    const { wrapper, shows, similar } = countingWrapper();
    const { result } = renderHook(
      () => ({
        browse: useShows({ page: 1 }),
        similar: useSimilarShows(SHOW_ID),
        rate: useShowRating(SHOW_ID),
      }),
      { wrapper },
    );
    await waitFor(() => expect(shows()).toBe(1));
    await waitFor(() => expect(similar()).toBe(1));

    result.current.rate.mutate(4);

    await waitFor(() => expect(similar()).toBe(2));
    await waitFor(() => expect(shows()).toBe(2));
  });
});
