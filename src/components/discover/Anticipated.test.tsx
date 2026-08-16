import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { useAddShow } from "@/api/me";
import type { AnticipatedShow } from "@/api/types";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/renderWithProviders";
import { Anticipated } from "./Anticipated";

function makeShow(overrides: Partial<AnticipatedShow> = {}): AnticipatedShow {
  return {
    id: 1,
    name: "Lanterns",
    type: null,
    status: "Returning Series",
    language: "en",
    premiered: "2027-02-18",
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
function serveAnticipated(respond: () => Response): { called: () => boolean } {
  let called = false;
  server.use(
    http.get(`${env.apiBaseUrl}/anticipated`, () => {
      called = true;
      return respond();
    }),
  );
  return { called: () => called };
}

function serveRows(shows: AnticipatedShow[]) {
  return serveAnticipated(() => HttpResponse.json(shows));
}

describe("Anticipated", () => {
  it("renders a card per entry, in the order the server sent", async () => {
    serveRows([
      makeShow(),
      makeShow({ id: 2, name: "Neuromancer" }),
      makeShow({ id: 3, name: "Neagley" }),
    ]);
    renderWithProviders(<Anticipated />);

    const links = await screen.findAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/shows/1", "/shows/2", "/shows/3"]);
  });

  it("renders every row the server sent, without slicing", async () => {
    // The length is the server's config (24 today) and is not published, so a
    // client-side cap would be a second number to keep in step with it.
    serveRows(Array.from({ length: 24 }, (_, i) => makeShow({ id: i + 1, name: `Show ${i + 1}` })));
    renderWithProviders(<Anticipated />);

    await waitFor(async () => expect(await screen.findAllByRole("link")).toHaveLength(24));
  });

  it("shows the premiere date on each card, not just the year", async () => {
    // The point of the surface: every entry premieres inside the same window,
    // so the year alone separates almost nothing.
    serveRows([makeShow({ premiered: "2027-02-18" })]);
    renderWithProviders(<Anticipated />);

    expect(await screen.findByText("Feb 18, 2027")).toBeInTheDocument();
    expect(screen.queryByText("2027")).not.toBeInTheDocument();
  });

  it("reads an undated show as TBA rather than a blank or a dash", async () => {
    // `/anticipated` never sends one (contract §5); the card declines to trust
    // that, and a dash here would read as a rendering failure.
    serveRows([makeShow({ premiered: null })]);
    renderWithProviders(<Anticipated />);

    expect(await screen.findByText("TBA")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("marks a show already in My Shows, and does not drop it", async () => {
    serveRows([
      makeShow({ id: 1, name: "Lanterns", in_my_shows: true }),
      makeShow({ id: 2, name: "Neagley", in_my_shows: false }),
    ]);
    renderWithProviders(<Anticipated />);

    // Marked, never filtered: both cards are present, one carries the mark.
    expect(await screen.findByRole("link", { name: /Lanterns/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Neagley/ })).toBeInTheDocument();
    expect(screen.getAllByTitle("In My Shows")).toHaveLength(1);
  });

  it("renders nothing at all when the list is empty", async () => {
    const request = serveRows([]);
    renderWithProviders(<Anticipated />);

    await waitFor(() => expect(request.called()).toBe(true));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    // No empty state, no error, and nothing about staleness — there is no
    // snapshot here to be stale (contract §3).
    expect(screen.queryByText(/no shows/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("refetches when the viewer adds a show, so the mark cannot go stale", async () => {
    // `in_my_shows` is per-user and mutable by that user, so a My Shows toggle
    // changes this body. `staleTime: 0` alone only refetches on mount, which
    // would leave the tab showing the pre-toggle mark until it remounted.
    let calls = 0;
    server.use(
      http.get(`${env.apiBaseUrl}/anticipated`, () => {
        calls += 1;
        return HttpResponse.json([makeShow({ id: 1, in_my_shows: calls > 1 })]);
      }),
      http.put(`${env.apiBaseUrl}/me/shows/1`, () => new HttpResponse(null, { status: 204 })),
    );

    function AddButton() {
      const add = useAddShow();
      return <button onClick={() => add.mutate(1)}>add</button>;
    }
    renderWithProviders(
      <>
        <Anticipated />
        <AddButton />
      </>,
    );

    await screen.findByRole("link");
    expect(calls).toBe(1);

    await userEvent.click(screen.getByRole("button", { name: "add" }));

    await waitFor(() => expect(screen.getByTitle("In My Shows")).toBeInTheDocument());
  });

  it("renders nothing and no error when the request fails", async () => {
    const request = serveAnticipated(() => HttpResponse.json({ detail: "boom" }, { status: 500 }));
    renderWithProviders(<Anticipated />);

    await waitFor(() => expect(request.called()).toBe(true));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
