import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import type { TrendingShow } from "@/api/types";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/renderWithProviders";
import { Trending } from "./Trending";

function makeShow(overrides: Partial<TrendingShow> = {}): TrendingShow {
  return {
    id: 1,
    name: "Lanterns",
    type: null,
    status: "Returning Series",
    language: "en",
    premiered: "2026-02-18",
    ended: null,
    image_medium: null,
    image_original: null,
    network: null,
    web_channel: null,
    genres: [],
    matched_aka: null,
    rating_average: null,
    my_rating: null,
    in_my_shows: false,
    ...overrides,
  };
}

/** Serve one response and report when the tab has actually asked for it, so
 * the "nothing renders" assertions run after the query settled rather than
 * against a component that has not fetched yet. */
function serveTrending(respond: () => Response): { called: () => boolean } {
  let called = false;
  server.use(
    http.get(`${env.apiBaseUrl}/trending`, () => {
      called = true;
      return respond();
    }),
  );
  return { called: () => called };
}

function serveRows(shows: TrendingShow[], capturedAt: string | null = "2026-08-16T04:00:11.481Z") {
  return serveTrending(() => HttpResponse.json({ captured_at: capturedAt, shows }));
}

describe("Trending", () => {
  it("renders a card per entry, in the order the server sent", async () => {
    serveRows([
      makeShow(),
      makeShow({ id: 2, name: "Our Sticky Love" }),
      makeShow({ id: 3, name: "Neagley" }),
    ]);
    renderWithProviders(<Trending />);

    const links = await screen.findAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/shows/1", "/shows/2", "/shows/3"]);
  });

  it("renders all twenty rows of a full snapshot, without slicing", async () => {
    serveRows(Array.from({ length: 20 }, (_, i) => makeShow({ id: i + 1, name: `Show ${i + 1}` })));
    renderWithProviders(<Trending />);

    await waitFor(async () => expect(await screen.findAllByRole("link")).toHaveLength(20));
  });

  it("marks a show already in My Shows, and does not drop it", async () => {
    serveRows([
      makeShow({ id: 1, name: "Lanterns", in_my_shows: true }),
      makeShow({ id: 2, name: "Neagley", in_my_shows: false }),
    ]);
    renderWithProviders(<Trending />);

    // Marked, never filtered: both cards are present, one carries the mark.
    expect(await screen.findByRole("link", { name: /Lanterns/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Neagley/ })).toBeInTheDocument();
    expect(screen.getAllByTitle("In your My Shows")).toHaveLength(1);
  });

  it("renders nothing at all when the snapshot is empty", async () => {
    // A stale snapshot arrives as exactly this body — the cutoff is the
    // server's rule and this component cannot re-derive it (contract §3).
    const request = serveRows([], null);
    renderWithProviders(<Trending />);

    await waitFor(() => expect(request.called()).toBe(true));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    // No empty state, no error, and never the word "stale".
    expect(screen.queryByText(/no shows/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/stale/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders nothing and no error when the request fails", async () => {
    const request = serveTrending(() => HttpResponse.json({ detail: "boom" }, { status: 500 }));
    renderWithProviders(<Trending />);

    await waitFor(() => expect(request.called()).toBe(true));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
