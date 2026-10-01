import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ShowDetailPage } from "./ShowDetailPage";

const base = env.apiBaseUrl;

function routed() {
  return (
    <Routes>
      <Route path="/shows/:id" element={<ShowDetailPage />} />
    </Routes>
  );
}

describe("ShowDetailPage", () => {
  it("renders show details", async () => {
    renderWithProviders(routed(), { route: "/shows/100" });
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Fixture Show" })).toBeInTheDocument(),
    );
    // Status renders raw, so this is TMDB's string verbatim (NEU-1031 D1).
    expect(screen.getByText(/Returning Series/i)).toBeInTheDocument();
    expect(screen.getByText(/Drama/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Season \d/i }).length).toBeGreaterThan(0);
  });

  it("renders not-found for missing shows", async () => {
    renderWithProviders(routed(), { route: "/shows/999" });
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument());
  });

  it("carries six tabs in order, each with a count, and opens on seasons", async () => {
    renderWithProviders(routed(), { route: "/shows/100" });

    // Counts come from the fixtures: 3 cast, 2 guest stars, 6 crew, 2 episode
    // crew, 0 similar.
    expect(await screen.findByRole("tab", { name: /^Cast \(3\)/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
        "Seasons (2)",
        "Cast (3)",
        "Guest stars (2)",
        "Crew (6)",
        "Episode crew (2)",
        "Similar (0)",
      ]),
    );
    expect(screen.getByRole("tab", { name: /Seasons/ })).toHaveAttribute("aria-selected", "true");
    // Only the active panel is mounted, so cast content is not on the page yet.
    expect(screen.queryByText("Zoe Lead")).not.toBeInTheDocument();
    // Six triggers overflow a phone: the strip scrolls rather than wraps.
    expect(screen.getByRole("tablist")).toHaveClass("overflow-x-auto");
  });

  it("shows each credit panel when its tab is selected", async () => {
    renderWithProviders(routed(), { route: "/shows/100" });

    await userEvent.click(await screen.findByRole("tab", { name: /^Cast/ }));
    expect(await screen.findByText("Zoe Lead")).toBeInTheDocument();
    // Regulars carry their episode count after the character.
    expect(screen.getByText("42 episodes")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /^Guest stars/ }));
    expect(await screen.findByText("Gus Guest")).toBeInTheDocument();
    expect(screen.getByText("3 episodes")).toBeInTheDocument();
    // Panels swap rather than stack — that is the point of the tabs.
    expect(screen.queryByText("Zoe Lead")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /^Crew/ }));
    expect(await screen.findByText("Wes Creator")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /^Episode crew/ }));
    expect(await screen.findByRole("heading", { name: "Director" })).toBeInTheDocument();
    expect(screen.getByText("5 episodes")).toBeInTheDocument();
    expect(screen.queryByText("Wes Creator")).not.toBeInTheDocument();
  });

  it("pages a long guest stars list: 12, then 48 more per Show more", async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      person: { id: 1000 + i, name: `Guest ${i}`, image_medium: null },
      character: { id: 2000 + i, name: `Role ${i}`, image_medium: null },
      self: false,
      voice: false,
      episode_count: 1,
    }));
    server.use(http.get(`${base}/shows/100/guest-cast`, () => HttpResponse.json(many)));
    renderWithProviders(routed(), { route: "/shows/100?tab=guest-stars" });

    const panel = await screen.findByRole("tabpanel");
    await within(panel).findByText("Guest 0");
    expect(within(panel).getAllByRole("listitem")).toHaveLength(12);

    await userEvent.click(within(panel).getByRole("button", { name: /^Show more/ }));
    expect(within(panel).getAllByRole("listitem")).toHaveLength(60);
  });

  it("disables the crew tab when a show has cast but no crew", async () => {
    server.use(http.get(`${base}/shows/100/crew`, () => HttpResponse.json([])));
    renderWithProviders(routed(), { route: "/shows/100" });

    expect(await screen.findByRole("tab", { name: /^Cast \(3\)/ })).toBeEnabled();
    await waitFor(() => expect(screen.getByRole("tab", { name: /^Crew \(0\)/ })).toBeDisabled());
    // The other half of the split is its own question.
    expect(screen.getByRole("tab", { name: /^Episode crew \(2\)/ })).toBeEnabled();
  });

  it("disables every credit tab when a show has no credits", async () => {
    server.use(
      http.get(`${base}/shows/100/cast`, () => HttpResponse.json([])),
      http.get(`${base}/shows/100/guest-cast`, () => HttpResponse.json([])),
      http.get(`${base}/shows/100/crew`, () => HttpResponse.json([])),
      http.get(`${base}/shows/100/episode-crew`, () => HttpResponse.json([])),
    );
    renderWithProviders(routed(), { route: "/shows/100" });
    await screen.findByRole("heading", { name: "Fixture Show" });

    await waitFor(() => {
      for (const name of ["Cast", "Guest stars", "Crew", "Episode crew"]) {
        expect(screen.getByRole("tab", { name: new RegExp(`^${name} \\(0\\)`) })).toBeDisabled();
      }
    });
    expect(screen.getByRole("tab", { name: /Seasons/ })).toHaveAttribute("aria-selected", "true");
  });

  it("deep-links to the cast panel via ?tab=cast", async () => {
    renderWithProviders(routed(), { route: "/shows/100?tab=cast" });

    expect(await screen.findByText("Zoe Lead")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Cast/ })).toHaveAttribute("aria-selected", "true");
  });

  it("deep-links to guest stars and episode crew", async () => {
    const { unmount } = renderWithProviders(routed(), { route: "/shows/100?tab=guest-stars" });
    expect(await screen.findByText("Gus Guest")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Guest stars/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    unmount();

    renderWithProviders(routed(), { route: "/shows/100?tab=episode-crew" });
    expect(await screen.findByText("Di Director")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Episode crew/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("falls back to seasons for an unknown tab, and for a tab the show cannot fill", async () => {
    server.use(http.get(`${base}/shows/100/crew`, () => HttpResponse.json([])));
    const { unmount } = renderWithProviders(routed(), { route: "/shows/100?tab=nonsense" });
    expect(await screen.findByRole("tab", { name: /Seasons/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    unmount();

    // An inherited object key is not a tab either.
    const second = renderWithProviders(routed(), { route: "/shows/100?tab=constructor" });
    expect(await screen.findByRole("tab", { name: /Seasons/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    second.unmount();

    // A crewless show linked straight to ?tab=crew lands on seasons rather than
    // on a disabled tab with an empty panel.
    renderWithProviders(routed(), { route: "/shows/100?tab=crew" });
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /Seasons/ })).toHaveAttribute("aria-selected", "true"),
    );
  });

  it("renders similar shows in their own tab", async () => {
    server.use(
      http.get(`${base}/shows/100/similar`, () =>
        HttpResponse.json([
          {
            id: 777,
            name: "Similar Show",
            type: null,
            status: null,
            language: null,
            premiered: "2020-01-01",
            ended: null,
            image_medium: null,
            image_original: null,
            network: null,
            web_channel: null,
            genres: [],
            matched_aka: null,
            rating_average: null,
            my_rating: null,
          },
        ]),
      ),
    );
    renderWithProviders(routed(), { route: "/shows/100" });

    // A fourth tab beside seasons, cast and crew — not a section below them.
    const tab = await screen.findByRole("tab", { name: /Similar \(1\)/ });
    expect(tab).toBeEnabled();
    // Only the active panel is mounted, so the grid arrives with the tab.
    expect(screen.queryByRole("link", { name: /Similar Show/ })).not.toBeInTheDocument();

    await userEvent.click(tab);
    expect(await screen.findByRole("heading", { level: 2, name: "Similar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Similar Show/ })).toHaveAttribute(
      "href",
      "/shows/777",
    );
  });

  it("disables the similar tab when the show has none", async () => {
    // Gate on the request actually having been served: a negative assertion
    // inside `waitFor` passes on the first tick, so it would hold against a
    // page that has not asked for the list yet.
    let called = false;
    server.use(
      http.get(`${base}/shows/100/similar`, () => {
        called = true;
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(routed(), { route: "/shows/100" });

    await screen.findByRole("heading", { name: "Fixture Show" });
    await waitFor(() => expect(called).toBe(true));
    // Present but disabled, matching cast and crew: a tab strip that changes
    // width when a query resolves moves the other tabs under the cursor.
    await waitFor(() => expect(screen.getByRole("tab", { name: /Similar \(0\)/ })).toBeDisabled());
    expect(screen.queryByRole("heading", { name: "Similar" })).not.toBeInTheDocument();
  });

  it("deep-links to the similar panel via ?tab=similar, and falls back when empty", async () => {
    server.use(
      http.get(`${base}/shows/100/similar`, () =>
        HttpResponse.json([
          {
            id: 777,
            name: "Similar Show",
            type: null,
            status: null,
            language: null,
            premiered: "2020-01-01",
            ended: null,
            image_medium: null,
            image_original: null,
            network: null,
            web_channel: null,
            genres: [],
            matched_aka: null,
            rating_average: null,
            my_rating: null,
          },
        ]),
      ),
    );
    const { unmount } = renderWithProviders(routed(), { route: "/shows/100?tab=similar" });
    expect(await screen.findByRole("link", { name: /Similar Show/ })).toBeInTheDocument();
    unmount();

    // A show with no recommendations linked straight to ?tab=similar lands on
    // seasons rather than on a disabled tab with an empty panel.
    server.use(http.get(`${base}/shows/100/similar`, () => HttpResponse.json([])));
    renderWithProviders(routed(), { route: "/shows/100?tab=similar" });
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /Seasons/ })).toHaveAttribute("aria-selected", "true"),
    );
  });
});
