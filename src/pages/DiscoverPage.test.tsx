import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { Recommendation } from "@/api/types";
import { DiscoverPage } from "./DiscoverPage";

function makeRecommendation(overrides: Partial<Recommendation> = {}): Recommendation {
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
    network: null,
    web_channel: null,
    genres: [],
    matched_aka: null,
    rating_average: null,
    my_rating: null,
    rank: 1,
    reason: "Slow-burn workplace dread, like the thrillers you finished.",
    ...overrides,
  };
}

/** Serve one response and report when the page has actually asked for it, so
 * the "nothing renders" assertions run after the query settled rather than
 * against a page that has not fetched yet. */
function serveRecommendations(respond: () => Response): { called: () => boolean } {
  let called = false;
  server.use(
    http.get(`${env.apiBaseUrl}/me/recommendations`, () => {
      called = true;
      return respond();
    }),
  );
  return { called: () => called };
}

function serveRows(recommendations: Recommendation[]) {
  return serveRecommendations(() => HttpResponse.json({ recommendations }));
}

/** The "Recommended for you" section itself, so assertions stay scoped to it
 * once Discovery's trending / most anticipated sections share this page. */
async function findSection(): Promise<HTMLElement> {
  const heading = await screen.findByRole("heading", { level: 2, name: "Recommended for you" });
  const section = heading.closest("section");
  if (!section) throw new Error("the heading is not inside a section");
  return section;
}

describe("DiscoverPage", () => {
  it("renders the page heading", () => {
    renderWithProviders(<DiscoverPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Discover" })).toBeInTheDocument();
  });

  it("renders the section with a card per recommendation, in the order served", async () => {
    serveRows([
      makeRecommendation(),
      makeRecommendation({
        id: 2,
        name: "The Leftovers",
        premiered: "2014-06-29",
        rank: 3,
        reason: "Grief handled with the same restraint.",
      }),
    ]);
    renderWithProviders(<DiscoverPage />);

    const section = await findSection();
    const links = within(section).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/shows/1", "/shows/2"]);
    expect(
      screen.getByText("Slow-burn workplace dread, like the thrillers you finished."),
    ).toBeInTheDocument();
    expect(screen.getByText("Grief handled with the same restraint.")).toBeInTheDocument();
  });

  it("renders every row the server sent, without slicing", async () => {
    // The cap is the server's, applied *after* the adult / deleted_upstream_at
    // filters (NEU-1112 contract §4) — a client that re-sliced to 12 would show
    // fewer than twelve the first time a tombstone landed.
    serveRows(
      Array.from({ length: 13 }, (_, i) =>
        makeRecommendation({ id: i + 1, name: `Show ${i + 1}`, rank: i + 1 }),
      ),
    );
    renderWithProviders(<DiscoverPage />);

    const section = await findSection();
    expect(within(section).getAllByRole("link")).toHaveLength(13);
  });

  it("renders the reason as plain text, never as markup", async () => {
    serveRows([makeRecommendation({ reason: "<em>Sharp</em> and <b>funny</b>." })]);
    renderWithProviders(<DiscoverPage />);

    expect(await screen.findByText("<em>Sharp</em> and <b>funny</b>.")).toBeInTheDocument();
    expect(document.querySelector("em")).toBeNull();
    expect(document.querySelector("b")).toBeNull();
  });

  it("renders no section at all when the list is empty", async () => {
    const request = serveRows([]);
    renderWithProviders(<DiscoverPage />);

    await waitFor(() => expect(request.called()).toBe(true));
    expect(screen.getByRole("heading", { level: 1, name: "Discover" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recommended for you" })).not.toBeInTheDocument();
    // No empty state, no nudge, no spinner, no error (project spec §11).
    expect(screen.queryByText(/no shows/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders no section and no error when the request fails", async () => {
    const request = serveRecommendations(() =>
      HttpResponse.json({ detail: "boom" }, { status: 500 }),
    );
    renderWithProviders(<DiscoverPage />);

    await waitFor(() => expect(request.called()).toBe(true));
    expect(screen.getByRole("heading", { level: 1, name: "Discover" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recommended for you" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
