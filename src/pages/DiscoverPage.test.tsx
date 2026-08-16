import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { AnticipatedShow, Recommendation, TrendingShow } from "@/api/types";
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

/** The "My Recommendations" panel itself, so assertions stay scoped to it
 * rather than to the sibling tabs' panels. The heading is `sr-only` — the tab
 * label carries the visible title — so it is found by role, not by sight. */
async function findSection(): Promise<HTMLElement> {
  const heading = await screen.findByRole("heading", { level: 2, name: "My Recommendations" });
  const section = heading.closest("section");
  if (!section) throw new Error("the heading is not inside a section");
  return section;
}

function makeTrendingShow(overrides: Partial<TrendingShow> = {}): TrendingShow {
  return {
    id: 900,
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

function serveTrending(shows: TrendingShow[]) {
  server.use(
    http.get(`${env.apiBaseUrl}/trending`, () =>
      HttpResponse.json({ captured_at: shows.length ? "2026-08-16T04:00:11.481Z" : null, shows }),
    ),
  );
}

function makeAnticipatedShow(overrides: Partial<AnticipatedShow> = {}): AnticipatedShow {
  return {
    id: 800,
    name: "Neuromancer",
    type: null,
    status: "Planned",
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

function serveAnticipated(shows: AnticipatedShow[]) {
  server.use(http.get(`${env.apiBaseUrl}/anticipated`, () => HttpResponse.json(shows)));
}

describe("DiscoverPage", () => {
  // The tab is persisted, and nothing else clears localStorage between tests.
  beforeEach(() => window.localStorage.clear());

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
    expect(screen.queryByRole("heading", { name: "My Recommendations" })).not.toBeInTheDocument();
    // The tab goes with the panel: a disabled tab is the empty state with a
    // smaller footprint (project spec §11).
    // `waitFor` genuinely waits here rather than passing on the first tick:
    // the tab *is* rendered while the query is in flight, so this only settles
    // once the empty answer has landed and the tab has gone.
    await waitFor(() =>
      expect(screen.queryByRole("tab", { name: "My Recommendations" })).not.toBeInTheDocument(),
    );
    // No empty state, no nudge, no spinner, no error.
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
    expect(screen.queryByRole("heading", { name: "My Recommendations" })).not.toBeInTheDocument();
    // `waitFor` genuinely waits here rather than passing on the first tick:
    // the tab *is* rendered while the query is in flight, so this only settles
    // once the empty answer has landed and the tab has gone.
    await waitFor(() =>
      expect(screen.queryByRole("tab", { name: "My Recommendations" })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("opens on My Recommendations, ahead of the other two tabs", async () => {
    serveRows([makeRecommendation()]);
    renderWithProviders(<DiscoverPage />);

    const mine = await screen.findByRole("tab", { name: "My Recommendations" });
    expect(mine).toHaveAttribute("aria-selected", "true");
    // First in the strip, not merely present.
    const labels = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(labels).toEqual(["My Recommendations", "Trending", "Most Anticipated"]);
    expect(await screen.findByRole("link", { name: /Severance/ })).toBeInTheDocument();
  });

  it("falls back to Trending when the user has no recommendations", async () => {
    const request = serveRows([]);
    serveTrending([makeTrendingShow()]);
    renderWithProviders(<DiscoverPage />);

    await waitFor(() => expect(request.called()).toBe(true));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Trending" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
    expect(await screen.findByRole("link", { name: /Lanterns/ })).toBeInTheDocument();
    // The stored preference is untouched: deferring is a decision for this
    // visit, not a reason to spend the user's default on one bad Sunday.
    expect(window.localStorage.getItem("tvbf:str:discover-tab")).toBe("my-recommendations");
  });

  it("restores the persisted tab", () => {
    window.localStorage.setItem("tvbf:str:discover-tab", "trending");
    renderWithProviders(<DiscoverPage />);

    expect(screen.getByRole("tab", { name: "Trending" })).toHaveAttribute("aria-selected", "true");
  });

  it("falls back to the default tab when the persisted value names no tab", async () => {
    // `usePersistedString` does not validate, so a value that outlives the tab
    // it named must not leave the page with nothing selected.
    window.localStorage.setItem("tvbf:str:discover-tab", "coming-soon");
    serveRows([makeRecommendation()]);
    renderWithProviders(<DiscoverPage />);

    expect(await screen.findByRole("tab", { name: "My Recommendations" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // Healed, not merely ignored — otherwise the value would come back to life
    // the day a tab is added by that name.
    await waitFor(() =>
      expect(window.localStorage.getItem("tvbf:str:discover-tab")).toBe("my-recommendations"),
    );
  });

  it("renders the Most Anticipated tab beside Trending", async () => {
    const request = serveRows([]);
    serveTrending([makeTrendingShow()]);
    serveAnticipated([makeAnticipatedShow()]);
    renderWithProviders(<DiscoverPage />);

    await waitFor(() => expect(request.called()).toBe(true));
    expect(screen.getByRole("tab", { name: "Most Anticipated" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Trending" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
  });

  it("restores Most Anticipated when it is the persisted tab", async () => {
    window.localStorage.setItem("tvbf:str:discover-tab", "most-anticipated");
    serveAnticipated([makeAnticipatedShow({ name: "Neuromancer", premiered: "2027-02-18" })]);
    renderWithProviders(<DiscoverPage />);

    expect(screen.getByRole("tab", { name: "Most Anticipated" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByRole("link", { name: /Neuromancer/ })).toBeInTheDocument();
    // The date, not the year: an anticipated list without dates is a
    // popularity list.
    expect(screen.getByText("Feb 18, 2027")).toBeInTheDocument();
  });

  it("persists the tab when the user switches to Most Anticipated", async () => {
    serveRows([makeRecommendation()]);
    serveTrending([makeTrendingShow()]);
    serveAnticipated([makeAnticipatedShow()]);
    renderWithProviders(<DiscoverPage />);

    await userEvent.click(screen.getByRole("tab", { name: "Most Anticipated" }));

    await waitFor(() =>
      expect(window.localStorage.getItem("tvbf:str:discover-tab")).toBe("most-anticipated"),
    );
    expect(await screen.findByRole("link", { name: /Neuromancer/ })).toBeInTheDocument();
  });

  it("renders the tab with no content, and no error, when most anticipated is empty", async () => {
    window.localStorage.setItem("tvbf:str:discover-tab", "most-anticipated");
    let called = false;
    server.use(
      http.get(`${env.apiBaseUrl}/anticipated`, () => {
        called = true;
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(<DiscoverPage />);

    await waitFor(() => expect(called).toBe(true));
    expect(screen.getByRole("tab", { name: "Most Anticipated" })).toBeInTheDocument();
    expect(screen.queryByText(/no shows/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the tab with no content, and no error, when trending is empty", async () => {
    let called = false;
    server.use(
      http.get(`${env.apiBaseUrl}/trending`, () => {
        called = true;
        return HttpResponse.json({ captured_at: null, shows: [] });
      }),
    );
    renderWithProviders(<DiscoverPage />);

    await waitFor(() => expect(called).toBe(true));
    expect(screen.getByRole("tab", { name: "Trending" })).toBeInTheDocument();
    expect(screen.queryByText(/stale/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no shows/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
