import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { SimilarShow } from "@/api/types";
import { SimilarShows } from "./SimilarShows";

const SHOW_ID = 100;

function makeShow(overrides: Partial<SimilarShow> = {}): SimilarShow {
  return {
    id: 1,
    name: "Severance",
    type: null,
    status: null,
    language: null,
    premiered: "2022-02-18",
    ended: null,
    image_medium: null,
    image_original: null,
    // Empty by design: the route serves neither, because `ShowCard` renders
    // neither (NEU-1053). `my_rating` and `in_my_shows` are *not* in that
    // group any more — the route fills both since NEU-1186.
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

/** Serve one response and report when the section has actually asked for it, so
 * the "nothing renders" assertions run after the query settled rather than
 * against a component that has not fetched yet. */
function serveSimilar(respond: () => Response | Promise<Response>): { called: () => boolean } {
  let called = false;
  server.use(
    http.get(`${env.apiBaseUrl}/shows/${SHOW_ID}/similar`, () => {
      called = true;
      return respond();
    }),
  );
  return { called: () => called };
}

function serveRows(shows: SimilarShow[]) {
  return serveSimilar(() => HttpResponse.json(shows));
}

/** The panel itself. The heading is `sr-only` — the tab label carries the
 * visible title — so it is found by role, not by sight. */
async function findSection(): Promise<HTMLElement> {
  const heading = await screen.findByRole("heading", { level: 2, name: "Similar" });
  const section = heading.closest("section");
  if (!section) throw new Error("the heading is not inside a section");
  return section;
}

describe("SimilarShows", () => {
  it("renders a card per show, in the order the API returned them", async () => {
    serveRows([
      makeShow(),
      makeShow({ id: 2, name: "The Leftovers", premiered: "2014-06-29" }),
      makeShow({ id: 3, name: "Dark", premiered: "2017-12-01" }),
    ]);
    renderWithProviders(<SimilarShows showId={SHOW_ID} />);

    const section = await findSection();
    const links = within(section).getAllByRole("link");
    // Rank order is the server's and this client never re-sorts it.
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/shows/1", "/shows/2", "/shows/3"]);
    expect(within(section).getByText("Severance")).toBeInTheDocument();
  });

  it("renders every row the server sent, without slicing", async () => {
    // The cap of 12 is the server's, applied *after* the adult /
    // deleted_upstream_at filters — a client that re-sliced would show fewer
    // than twelve the first time a tombstone landed.
    serveRows(Array.from({ length: 12 }, (_, i) => makeShow({ id: i + 1, name: `Show ${i + 1}` })));
    renderWithProviders(<SimilarShows showId={SHOW_ID} />);

    const section = await findSection();
    expect(within(section).getAllByRole("link")).toHaveLength(12);
  });

  it("marks a tracked show and shows the viewer's rating on it", async () => {
    // Both fields arrived together and both are asserted on the one card: the
    // mark spent this route's shared cacheability and `my_rating` rode on that
    // (§3.2), so before NEU-1186 this was the one grid in the app where a
    // tracked, rated show showed neither.
    //
    // The unmarked, unrated row rides in the same payload, so what is asserted
    // is the mark rather than which row was served — marked, never filtered.
    serveRows([
      makeShow({ id: 1, name: "Severance", in_my_shows: true, my_rating: 4.5 }),
      makeShow({ id: 2, name: "The Leftovers", in_my_shows: false, my_rating: null }),
    ]);
    renderWithProviders(<SimilarShows showId={SHOW_ID} />);

    const section = await findSection();
    const tracked = within(section).getByRole("link", { name: /Severance/ });
    expect(within(section).getByRole("link", { name: /The Leftovers/ })).toBeInTheDocument();

    const card = tracked.closest("div");
    if (!card) throw new Error("the card link is not inside an element");
    // Scoped to the one card, or a badge belonging to the neighbouring row
    // would satisfy the assertion and leave the pairing untested.
    expect(within(card).queryByText("The Leftovers")).not.toBeInTheDocument();
    expect(within(card).getByTitle("In your My Shows")).toBeInTheDocument();
    expect(within(card).getByTitle("Your rating: 4.5 out of 5")).toBeInTheDocument();

    expect(within(section).getAllByTitle("In your My Shows")).toHaveLength(1);
    expect(within(section).getAllByTitle(/Your rating/)).toHaveLength(1);
  });

  it("renders no DOM at all when the list is empty", async () => {
    const request = serveRows([]);
    const { container } = renderWithProviders(<SimilarShows showId={SHOW_ID} />);

    await waitFor(() => expect(request.called()).toBe(true));
    expect(screen.queryByRole("heading", { name: "Similar" })).not.toBeInTheDocument();
    // No empty state, no "no similar shows found", no spinner, no error.
    expect(screen.queryByText(/no shows/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("renders no heading while the request is in flight", async () => {
    // The heading must never appear and then disappear: it waits for rows.
    const request = serveSimilar(async () => {
      await delay("infinite");
      return HttpResponse.json([]);
    });
    const { container } = renderWithProviders(<SimilarShows showId={SHOW_ID} />);

    await waitFor(() => expect(request.called()).toBe(true));
    expect(screen.queryByRole("heading", { name: "Similar" })).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing and no error when the request fails", async () => {
    const request = serveSimilar(() => HttpResponse.json({ detail: "boom" }, { status: 500 }));
    const { container } = renderWithProviders(<SimilarShows showId={SHOW_ID} />);

    await waitFor(() => expect(request.called()).toBe(true));
    expect(screen.queryByRole("heading", { name: "Similar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
