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

/** A promise a test resolves by hand, so a mutation can be held in flight. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

/** One show, marked however the caller says — and the only body the server ever
 * sends in a given test, so a mark that reads the *other* way can only be
 * ours. */
const onePage = (inMyShows: boolean) => ({
  items: [
    {
      id: SHOW_ID,
      name: "The Bear",
      type: "Scripted",
      status: "Returning Series",
      language: "en",
      premiered: "2022-06-23",
      ended: null,
      image_medium: null,
      image_original: null,
      network: null,
      web_channel: null,
      genres: [],
      matched_aka: null,
      rating_average: null,
      my_rating: null,
      in_my_shows: inMyShows,
    },
  ],
  page: 1,
  per_page: 50,
  total: 1,
  total_pages: 1,
});

/** NEU-1192 §3.3 — **the mark moves with the control, in the cache.**
 *
 * Invalidation alone leaves the poster's library mark saying nothing for a
 * `PUT` plus a refetch of a fifty-item search page, while the chip beside it
 * already reads "✓ My Shows". That was invisible until search grew a control:
 * the recommendations card *vanishes* on add, so nothing stayed on screen to
 * disagree with.
 *
 * Both tests hold the server still — the mutation is gated, and every refetch
 * after the first hangs — so what they observe can only be the optimistic
 * write and its snapshot restore, never a body the server sent.
 */
describe.each([
  {
    direction: "add",
    /** The state the surface starts in, and the one it must reach. */
    from: false,
    to: true,
    method: http.put,
    useMutation: () => useAddShow(),
  },
  {
    direction: "remove",
    from: true,
    to: false,
    method: http.delete,
    useMutation: () => useRemoveShow(),
  },
])("the library mark flips optimistically on a browse page ($direction)", (c) => {
  /** First GET answers; every later one hangs, so a refetch cannot supply (or
   * quietly restore) the value under test. */
  function frozenAfterFirstLoad(respond: () => Promise<Response> | Response) {
    let served = 0;
    server.use(
      http.get(`${env.apiBaseUrl}/shows`, async () => {
        served += 1;
        if (served > 1) await new Promise(() => {});
        return HttpResponse.json(onePage(c.from));
      }),
      c.method(`${env.apiBaseUrl}/me/shows/:id`, () => respond()),
    );
    return makeWrapper();
  }

  function mountFrozen(respond: () => Promise<Response> | Response) {
    return renderHook(() => ({ browse: useShows({ page: 1 }), fire: c.useMutation() }), {
      wrapper: frozenAfterFirstLoad(respond),
    });
  }

  it("moves the mark before the request settles (AC 3)", async () => {
    const gate = deferred();
    const { result } = mountFrozen(async () => {
      await gate.promise;
      return new HttpResponse(null, { status: 204 });
    });
    await waitFor(() => expect(result.current.browse.data?.items[0].in_my_shows).toBe(c.from));

    result.current.fire.mutate(SHOW_ID);

    await waitFor(() => expect(result.current.browse.data?.items[0].in_my_shows).toBe(c.to));
    // Still in flight, so no response can have supplied that.
    expect(result.current.fire.isPending).toBe(true);
    gate.resolve();
  });

  it("puts the mark back when the request fails (AC 6)", async () => {
    const gate = deferred();
    const { result } = mountFrozen(async () => {
      await gate.promise;
      return new HttpResponse(null, { status: 500 });
    });
    await waitFor(() => expect(result.current.browse.data?.items[0].in_my_shows).toBe(c.from));

    result.current.fire.mutate(SHOW_ID);
    await waitFor(() => expect(result.current.browse.data?.items[0].in_my_shows).toBe(c.to));

    gate.resolve();

    await waitFor(() => expect(result.current.fire.isError).toBe(true));
    // The snapshot restore, not a refetch: every GET after the first hangs.
    await waitFor(() => expect(result.current.browse.data?.items[0].in_my_shows).toBe(c.from));
  });
});
