import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { usePopularWithFriends } from "@/api/me";
import type { PopularShow } from "@/api/types";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/renderWithProviders";
import { PopularWithFriends } from "./PopularWithFriends";

function makeShow(overrides: Partial<PopularShow> = {}): PopularShow {
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
    friend_count: 1,
    ...overrides,
  };
}

/** Serve one response and report when the tab has actually asked for it, so
 * the "nothing renders" assertions run after the query settled rather than
 * against a component that has not fetched yet. */
function servePopular(respond: () => Response | Promise<Response>): { called: () => boolean } {
  let called = false;
  server.use(
    http.get(`${env.apiBaseUrl}/me/friends/popular`, () => {
      called = true;
      return respond();
    }),
  );
  return { called: () => called };
}

function serveBody(connectionCount: number, shows: PopularShow[]) {
  return servePopular(() =>
    HttpResponse.json({ window_days: 14, connection_count: connectionCount, shows }),
  );
}

describe("PopularWithFriends", () => {
  it("renders a card per entry, in the order the server sent", async () => {
    // Deliberately not in friend_count order: the client never re-sorts,
    // whatever the fields it can see would suggest (spec §7).
    serveBody(4, [
      makeShow({ id: 3, name: "Neagley", friend_count: 1 }),
      makeShow({ id: 1, name: "Lanterns", friend_count: 3 }),
      makeShow({ id: 2, name: "Our Sticky Love", friend_count: 2 }),
    ]);
    renderWithProviders(<PopularWithFriends />);

    const links = await screen.findAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/shows/3", "/shows/1", "/shows/2"]);
    expect(screen.getByRole("heading", { level: 2, name: "Popular with Friends" })).toHaveClass(
      "sr-only",
    );
  });

  it("carries each entry's friend count through the grid to its card", async () => {
    // NEU-1501: `ShowGrid` threads `friend_count` as a flat value, the way it
    // threads `in_my_shows`; the copy itself is asserted in `ShowCard.test.tsx`.
    serveBody(4, [
      makeShow({ id: 1, name: "Lanterns", friend_count: 3 }),
      makeShow({ id: 2, name: "Neagley", friend_count: 1 }),
    ]);
    renderWithProviders(<PopularWithFriends />);

    expect(await screen.findByText("3 friends")).toBeInTheDocument();
    expect(screen.getByText("1 friend")).toBeInTheDocument();
  });

  it("marks a show already in My Shows, and does not drop it", async () => {
    serveBody(2, [
      makeShow({ id: 1, name: "Lanterns", in_my_shows: true }),
      makeShow({ id: 2, name: "Neagley" }),
    ]);
    renderWithProviders(<PopularWithFriends />);

    expect(await screen.findByRole("link", { name: /Lanterns/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Neagley/ })).toBeInTheDocument();
    expect(screen.getAllByTitle("In your My Shows")).toHaveLength(1);
  });

  it("offers a way to connect when the viewer has no connections", async () => {
    serveBody(0, []);
    renderWithProviders(<PopularWithFriends />);

    const cta = await screen.findByRole("link", { name: "Connect with friends" });
    expect(cta).toHaveAttribute("href", "/friends");
    expect(cta.closest("p")).toHaveTextContent(
      "Connect with friends to see what they're watching.",
    );
    // Never ShowGrid's own empty copy, which is wrong on this surface.
    expect(screen.queryByText(/no shows/i)).not.toBeInTheDocument();
  });

  it("says the friends have been quiet when there are connections but no shows", async () => {
    serveBody(3, []);
    renderWithProviders(<PopularWithFriends />);

    expect(
      await screen.findByText("Nothing from your friends in the last two weeks."),
    ).toBeInTheDocument();
    // No link: there is nothing for the viewer to fix.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/no shows/i)).not.toBeInTheDocument();
  });

  it("renders nothing while the request is pending", () => {
    servePopular(() => new Promise<Response>(() => {}));
    const { container } = renderWithProviders(<PopularWithFriends />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing and no error when the request fails", async () => {
    servePopular(() => HttpResponse.json({ detail: "boom" }, { status: 500 }));
    // A probe on the same key, so the assertion runs once the query has
    // actually failed — an empty container alone cannot tell failure from
    // still-pending.
    function Probe() {
      return usePopularWithFriends().isError ? <span data-testid="failed" /> : null;
    }
    renderWithProviders(
      <>
        <PopularWithFriends />
        <Probe />
      </>,
    );

    await screen.findByTestId("failed");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/friends/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
