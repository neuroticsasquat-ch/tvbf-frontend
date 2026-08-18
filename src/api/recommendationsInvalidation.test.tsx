import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";

import { env } from "@/env";
import { server } from "@/test/msw/server";
import {
  useAddShow,
  useEpisodeRating,
  useMarkEpisode,
  useRecommendations,
  useRemoveFromHistory,
  useRemoveShow,
  useShowRating,
  useUnmarkEpisode,
} from "./me";

/** Its own file rather than a block inside `me.test.tsx`: that file stands up a
 * *second* MSW server for its `today` assertions, so with the suite's shared
 * one also running every request passes through two interceptors and is handled
 * twice. That is invisible to an assertion about a query parameter and fatal to
 * one that counts requests, which is the whole mechanism here. */

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

/** Project spec §8's four sources — My Shows membership, a show rating, any
 * episode watch, any episode rating — are what `GET /me/recommendations`
 * suppresses on, and NEU-1175 made that a live join. So each of them changes
 * this payload in one direction or the other, and the client's whole job is to
 * refetch afterwards (NEU-1112 contract §4.1). It never re-implements the
 * rule itself.
 *
 * Counted at the hook level rather than through a page, because the guarantee
 * belongs to the mutations: any surface that calls one gets it. */
describe("mutations refresh the recommendations key", () => {
  function countingWrapper() {
    let calls = 0;
    server.use(
      http.get(`${env.apiBaseUrl}/me/recommendations`, () => {
        calls += 1;
        return HttpResponse.json({ recommendations: [] });
      }),
      http.put(`${env.apiBaseUrl}/me/shows/:id`, () => new HttpResponse(null, { status: 204 })),
      http.delete(`${env.apiBaseUrl}/me/shows/:id`, () => new HttpResponse(null, { status: 204 })),
      http.post(
        `${env.apiBaseUrl}/me/episodes/:id/watched`,
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.delete(
        `${env.apiBaseUrl}/me/episodes/:id/watched`,
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.put(`${env.apiBaseUrl}/me/shows/:id/rating`, () => HttpResponse.json({ stars: 4 })),
      http.put(`${env.apiBaseUrl}/me/episodes/:id/rating`, () => HttpResponse.json({ stars: 4 })),
      http.delete(
        `${env.apiBaseUrl}/me/shows/:id/watched`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    return { wrapper: makeWrapper(), calls: () => calls };
  }

  /** One case per §8 source. Each carries a hook that returns the click: the
   * mutations differ in what they take, and a tuple table would infer one
   * union across all of them and then reject every member of it. */
  const CASES: { label: string; useFire: () => () => void }[] = [
    {
      label: "adding a show",
      useFire: () => {
        const m = useAddShow();
        return () => m.mutate(1);
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
    {
      label: "rating an episode",
      useFire: () => {
        const m = useEpisodeRating(5);
        return () => m.mutate(4);
      },
    },
    {
      label: "marking an episode watched",
      useFire: () => {
        const m = useMarkEpisode();
        return () => m.mutate({ episodeId: 5, showId: 1 });
      },
    },
    {
      label: "un-marking an episode",
      useFire: () => {
        const m = useUnmarkEpisode();
        return () => m.mutate({ episodeId: 5, showId: 1 });
      },
    },
    {
      label: "clearing a show's watch history",
      useFire: () => {
        const m = useRemoveFromHistory();
        return () => m.mutate({ showId: 1 });
      },
    },
  ];

  it.each(CASES)("refetches after $label", async ({ useFire }) => {
    const { wrapper, calls } = countingWrapper();
    // The query needs an *active observer* for an invalidation to refetch:
    // `invalidateQueries` defaults to `refetchType: "active"`, so this is the
    // mounted-grid case the ticket is actually about.
    const { result } = renderHook(() => ({ query: useRecommendations(), fire: useFire() }), {
      wrapper,
    });
    await waitFor(() => expect(calls()).toBe(1));

    result.current.fire();

    await waitFor(() => expect(calls()).toBe(2));
  });
});
