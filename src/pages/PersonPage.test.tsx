import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { Route, Routes, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { fixturePerson, fixturePersonCredits } from "@/test/msw/fixtures";
import { renderWithProviders } from "@/test/renderWithProviders";
import { PersonPage } from "./PersonPage";

const base = env.apiBaseUrl;

function LocationSpy() {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
}

function routed() {
  return (
    <Routes>
      <Route
        path="/people/:personId"
        element={
          <>
            <PersonPage />
            <LocationSpy />
          </>
        }
      />
    </Routes>
  );
}

function renderPerson(id: number | string = 300, route?: string) {
  return renderWithProviders(routed(), { route: route ?? `/people/${id}` });
}

async function switchToTab(name: string) {
  const tab = await screen.findByRole("tab", { name });
  await userEvent.click(tab);
}

function serveCredits(credits: Partial<typeof fixturePersonCredits>) {
  server.use(
    http.get(`${base}/people/300/credits`, () =>
      HttpResponse.json({ cast: [], crew: [], guest_cast: [], episode_crew: [], ...credits }),
    ),
  );
}

/** The show links heading each card in a region, in order. */
function cardShows(region: HTMLElement): string[] {
  return within(region)
    .getAllByRole("link")
    .filter((a) => /^\/shows\/\d+$/.test(a.getAttribute("href") ?? ""))
    .map((a) => a.textContent ?? "");
}

describe("PersonPage", () => {
  it("renders the header with name, dates and country", async () => {
    renderPerson();

    expect(await screen.findByRole("heading", { level: 1, name: "Zoe Lead" })).toBeInTheDocument();
    // The date must not shift a day — it is built from parts, not UTC-parsed.
    expect(screen.getByText("Born September 9, 1972 · Croatia")).toBeInTheDocument();
  });

  it("renders two tabs, counting shows rather than credits", async () => {
    renderPerson();
    await screen.findByRole("heading", { level: 1, name: "Zoe Lead" });

    // Four shows in the cast and guest lists together; three in crew and episode
    // crew. Five cast credits and four crew credits behind them.
    expect(await screen.findByRole("tab", { name: "Cast (4)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Crew (3)" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);

    // The in-panel heading is visually hidden but still in the DOM.
    const heading = screen.getByRole("heading", { name: "Cast (4)" });
    expect(heading).toHaveClass("sr-only");
  });

  it("orders cards by the latest credited date, undated last", async () => {
    renderPerson();
    await switchToTab("Cast (4)");

    // Alpha's guest turn (2021) outranks its regular season (2020) and Gamma
    // (2019); Beta and Delta are undated, so they follow by show id.
    expect(cardShows(screen.getByRole("region", { name: /^Cast/ }))).toEqual([
      "Alpha Show",
      "Gamma Show",
      "Beta Show",
      "Delta Show",
    ]);
  });

  it("merges a regular-then-guest show into one card with season and episode rows", async () => {
    renderPerson();
    await switchToTab("Cast (4)");
    const cast = within(screen.getByRole("region", { name: /^Cast/ }));

    // The count is the regular credit's aggregate, which already includes the
    // guest turn; both characters are named; the year follows.
    expect(cast.getByText("· 42 episodes · 2020")).toBeInTheDocument();
    const disclosure = cast.getByRole("button", {
      name: "Alpha Show — Captain Alpha · Alpha Prime · 1 season · 1 episode",
    });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(disclosure);
    // The season row links to that season's cast, and states its episodes once
    // the show's seasons load; the guest episode follows beneath.
    const season = await cast.findByRole("link", {
      name: "Alpha Show — Season 1 · 10 episodes",
    });
    expect(season).toHaveAttribute("href", "/shows/100/episodes?season=1&tab=cast");
    const episode = cast.getByRole("link", { name: "Alpha Show — S2E1 · S2 Pilot · Alpha Prime" });
    expect(episode).toHaveAttribute("href", "/episodes/5100");
    expect(season.compareDocumentPosition(episode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Nothing on the card says regular or guest: the grain is in the row.
    const card = disclosure.parentElement as HTMLElement;
    expect(card.textContent).not.toMatch(/regular|guest/i);
  });

  it("counts a guest-only show's episodes and shows its one row inline", async () => {
    renderPerson();
    await switchToTab("Cast (4)");
    const cast = within(screen.getByRole("region", { name: /^Cast/ }));

    expect(cast.getByText("· 1 episode · 2018")).toBeInTheDocument();
    expect(cast.getByText("Guest Of The Week")).toBeInTheDocument();
    // One row: no expander, the row itself in its place.
    expect(cast.queryByRole("button", { name: /^Gamma Show/ })).not.toBeInTheDocument();
    expect(cast.getByRole("link", { name: "Gamma Show — S2E11 · The Reckoning" })).toHaveAttribute(
      "href",
      "/episodes/900",
    );
  });

  it("gives a regular with no aggregate count no count", async () => {
    renderPerson();
    await switchToTab("Cast (4)");
    const cast = within(screen.getByRole("region", { name: /^Cast/ }));

    expect(cast.getByText("· 2015")).toBeInTheDocument();
    expect(cast.getByText("Doctor Beta (voice)")).toBeInTheDocument();
    // Inline, the season row names the season alone: the show is fetched for
    // its season counts only when a card is expanded, never on page load.
    expect(cast.getByRole("link", { name: "Beta Show — Season 1" })).toHaveAttribute(
      "href",
      "/shows/101/episodes?season=1&tab=cast",
    );
  });

  it("links each card's header to the show", async () => {
    renderPerson();
    await switchToTab("Cast (4)");
    const cast = within(screen.getByRole("region", { name: /^Cast/ }));
    expect(cast.getByRole("link", { name: "Alpha Show" })).toHaveAttribute("href", "/shows/100");

    await switchToTab("Crew (3)");
    const crew = within(screen.getByRole("region", { name: /^Crew/ }));
    expect(crew.getByRole("link", { name: "Alpha Show" })).toHaveAttribute("href", "/shows/100");
  });

  it("gives a cast-and-crew show a card in each tab", async () => {
    renderPerson();
    await switchToTab("Crew (3)");
    const crew = screen.getByRole("region", { name: /^Crew/ });

    expect(cardShows(crew)).toEqual(["Gamma Show", "Alpha Show", "Delta Show"]);
    // Series crew: the aggregate, the role, and no rows — it links nowhere
    // narrower than the show.
    expect(within(crew).getByText("· 40 episodes · 2020")).toBeInTheDocument();
    expect(within(crew).getByText("Executive Producer")).toBeInTheDocument();
  });

  it("leaves a stale ?tab= pointing at a hidden tab in the address bar", async () => {
    serveCredits({ cast: fixturePersonCredits.cast, guest_cast: fixturePersonCredits.guest_cast });
    renderPerson(300, "/people/300?tab=crew");

    // Crew is empty and hidden, so Cast shows — and the URL is not rewritten
    // behind the reader's back (NEU-1211).
    expect(await screen.findByRole("tab", { name: "Cast (4)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("location")).toHaveTextContent("?tab=crew");
  });

  it("collapses two roles on one episode into a single row", async () => {
    renderPerson();
    await switchToTab("Crew (3)");
    const crew = within(screen.getByRole("region", { name: /^Crew/ }));

    // Upstream really does credit one person as Director and Teleplay on one
    // episode; both survive, as one row with both roles in the card's labels.
    expect(crew.getByText("Director · Teleplay")).toBeInTheDocument();
    expect(
      crew.getAllByRole("link").filter((a) => a.getAttribute("href") === "/episodes/900"),
    ).toHaveLength(1);
    // A special is unnumbered upstream, so it degrades to the season alone.
    expect(crew.getByRole("link", { name: "Delta Show — S1" })).toHaveAttribute(
      "href",
      "/episodes/901",
    );
  });

  it("falls back to the populated tab when the other is empty", async () => {
    serveCredits({ episode_crew: fixturePersonCredits.episode_crew });
    renderPerson();

    expect(await screen.findByRole("tab", { name: "Crew (2)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // Hidden, not disabled.
    expect(screen.queryByRole("tab", { name: /^Cast/ })).not.toBeInTheDocument();
    expect(screen.queryByText("No credits yet.")).not.toBeInTheDocument();
  });

  it("says so when a person has no credits at all", async () => {
    server.use(
      http.get(`${base}/people/300/credits`, () =>
        HttpResponse.json({ cast: [], crew: [], guest_cast: [], episode_crew: [] }),
      ),
    );
    renderPerson();

    // The header still renders — no credits is normal, not a broken page.
    expect(await screen.findByRole("heading", { level: 1, name: "Zoe Lead" })).toBeInTheDocument();
    expect(await screen.findByText("No credits yet.")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("deep-links to Crew, and maps the four-tab page's values onto two", async () => {
    for (const [query, selected] of [
      ["?tab=crew", "Crew (3)"],
      ["?tab=episode-crew", "Crew (3)"],
      ["?tab=guest", "Cast (4)"],
      ["?tab=cast", "Cast (4)"],
      ["?tab=nonsense", "Cast (4)"],
    ] as const) {
      const { unmount } = renderPerson(300, `/people/300${query}`);
      expect(await screen.findByRole("tab", { name: selected })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      unmount();
    }
  });

  it("updates the URL with replace when switching tabs", async () => {
    renderPerson();
    await screen.findByRole("heading", { level: 1, name: "Zoe Lead" });

    const historyBefore = window.history.length;
    expect(screen.getByTestId("location")).toHaveTextContent("");

    await switchToTab("Crew (3)");
    expect(screen.getByTestId("location")).toHaveTextContent("?tab=crew");

    await switchToTab("Cast (4)");
    expect(screen.getByTestId("location")).toHaveTextContent("");
    expect(window.history.length).toBe(historyBefore);
  });

  it("lets the tab strip scroll horizontally at a narrow viewport", async () => {
    renderPerson();
    const tablist = await screen.findByRole("tablist");
    expect(tablist).toHaveClass("overflow-x-auto");
  });

  it("collapses past twelve cards behind a show-all toggle", async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      ...fixturePersonCredits.guest_cast[1],
      show: { id: 200 + i, name: `Show ${i}`, image_medium: null, premiered: null },
      episode: { id: 900 + i, name: `Episode ${i}`, season: 1, number: i + 1, airdate: null },
    }));
    serveCredits({ guest_cast: many });
    renderPerson();

    expect(await screen.findByRole("tab", { name: "Cast (20)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const toggle = await screen.findByRole("button", { name: "Show all 20 shows" });
    expect(screen.getAllByRole("listitem")).toHaveLength(12);

    await userEvent.click(toggle);
    expect(screen.getAllByRole("listitem")).toHaveLength(20);
  });

  it("renders the not-found page for an unknown person", async () => {
    renderPerson(999);

    expect(await screen.findByRole("heading", { name: "Not found" })).toBeInTheDocument();
  });

  it("renders the not-found page for a non-numeric id instead of hanging", async () => {
    // A junk id disables the query, so waiting on it would spin forever.
    renderPerson("abc");

    expect(await screen.findByRole("heading", { name: "Not found" })).toBeInTheDocument();
    expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
  });

  it("surfaces a failed credits request without blanking the header", async () => {
    server.use(
      http.get(`${base}/people/300/credits`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderPerson();

    expect(await screen.findByRole("heading", { level: 1, name: "Zoe Lead" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(/boom/);
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("prefers the original headshot over the medium one", async () => {
    renderPerson();
    await screen.findByRole("heading", { level: 1, name: "Zoe Lead" });

    const img = document.querySelector("header img");
    expect(img).toHaveAttribute("src", fixturePerson.image_original);
  });

  it("omits the dates line when the person has neither date nor country", async () => {
    server.use(
      http.get(`${base}/people/300`, () =>
        HttpResponse.json({ ...fixturePerson, birthday: null, country_name: null }),
      ),
    );
    renderPerson();

    const header = (await screen.findByRole("heading", { level: 1 })).closest("header");
    await waitFor(() => expect(header?.querySelectorAll("p")).toHaveLength(0));
  });

});

describe("PersonPage grouped-card accessibility", () => {
  const gamma = { id: 102, name: "Gamma Show", image_medium: null, premiered: "2018-03-01" };
  const delta = { id: 103, name: "Delta Show", image_medium: null, premiered: "2016-01-01" };

  function ep(id: number, number: number, airdate: string) {
    return { id, name: `Episode ${number}`, season: 2, number, airdate };
  }

  it("collapses many episodes of one show behind a disclosure, keeping every episode link", async () => {
    serveCredits({
      episode_crew: [
        { show: gamma, episode: ep(910, 3, "2019-04-09"), role: "Director" },
        { show: gamma, episode: ep(911, 2, "2019-04-02"), role: "Director" },
        { show: gamma, episode: ep(912, 1, "2019-03-26"), role: "Director" },
      ],
    });
    renderPerson();

    await switchToTab("Crew (1)");
    const crew = within(screen.getByRole("region", { name: /^Crew/ }));
    const disclosure = crew.getByRole("button", { name: "Gamma Show — Director · 3 episodes" });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");

    // A chevron marks the control as interactive — the summary is a noun
    // phrase, so without it nothing says the card expands. It must stay
    // aria-hidden: decorative, and it would otherwise pollute the name above.
    const chevron = disclosure.querySelector("svg");
    expect(chevron).not.toBeNull();
    expect(chevron).toHaveAttribute("aria-hidden");

    // Collapsed, the episodes are not rendered — only the show link.
    expect(crew.queryByRole("link", { name: /Gamma Show — S2E3/ })).not.toBeInTheDocument();

    await userEvent.click(disclosure);
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    for (const [id, code] of [
      [910, "S2E3"],
      [911, "S2E2"],
      [912, "S2E1"],
    ] as const) {
      expect(crew.getByRole("link", { name: new RegExp(`^Gamma Show — ${code} `) })).toHaveAttribute(
        "href",
        `/episodes/${id}`,
      );
    }
  });

  it("distinguishes two shows whose groups would otherwise read identically", async () => {
    serveCredits({
      episode_crew: [
        { show: gamma, episode: ep(910, 3, "2019-04-09"), role: "Director" },
        { show: gamma, episode: ep(911, 2, "2019-04-02"), role: "Director" },
        { show: delta, episode: ep(920, 3, "2017-04-09"), role: "Director" },
        { show: delta, episode: ep(921, 2, "2017-04-02"), role: "Director" },
      ],
    });
    renderPerson();

    await switchToTab("Crew (2)");
    const crew = within(screen.getByRole("region", { name: /^Crew/ }));

    // Both cards summarise as "Director · 2 episodes". Without the show in the
    // accessible name a screen reader announces two identical buttons.
    await userEvent.click(crew.getByRole("button", { name: "Gamma Show — Director · 2 episodes" }));
    await userEvent.click(crew.getByRole("button", { name: "Delta Show — Director · 2 episodes" }));

    // Both expanded, both contain an "S2E3" — so the episode links need the
    // show too, or they collide in a screen reader's link list.
    expect(crew.getByRole("link", { name: /^Gamma Show — S2E3 / })).toHaveAttribute(
      "href",
      "/episodes/910",
    );
    expect(crew.getByRole("link", { name: /^Delta Show — S2E3 / })).toHaveAttribute(
      "href",
      "/episodes/920",
    );
  });

  it("makes the whole episode row the link, not just the episode code", async () => {
    serveCredits({
      episode_crew: [
        { show: gamma, episode: ep(910, 3, "2019-04-09"), role: "Director" },
        { show: gamma, episode: ep(911, 2, "2019-04-02"), role: "Director" },
      ],
    });
    renderPerson();

    await switchToTab("Crew (1)");
    const crew = within(screen.getByRole("region", { name: /^Crew/ }));
    await userEvent.click(crew.getByRole("button", { name: /^Gamma Show —/ }));

    const row = crew.getByRole("link", { name: /^Gamma Show — S2E3 / });
    expect(row).toHaveAttribute("href", "/episodes/910");
    // One separator between every part of the row, matching the friends feed
    // (NEU-1134) rather than a space here and a middot there.
    expect(row).toHaveTextContent("S2E3 · Episode 3 · Director");
    // The accessible name must still contain the visible string verbatim.
    expect(row).toHaveAccessibleName("Gamma Show — S2E3 · Episode 3 · Director");

    // Nothing in the row is left outside the link.
    const item = row.closest("li");
    expect(item?.textContent).toBe(row.textContent);
  });

  it("lists ten rows, then ten more per Show more", async () => {
    // 25 episodes on one show. Real data goes far higher — 8,010 episode-crew
    // credits on Jeopardy! for one person — so the list pages rather than
    // mounting everything.
    serveCredits({
      episode_crew: Array.from({ length: 25 }, (_, i) => ({
        show: gamma,
        episode: ep(1000 + i, 25 - i, "2019-04-09"),
        role: "Director",
      })),
    });
    renderPerson();

    await switchToTab("Crew (1)");
    const crew = within(screen.getByRole("region", { name: /^Crew/ }));
    // The summary still states the true total.
    await userEvent.click(crew.getByRole("button", { name: "Gamma Show — Director · 25 episodes" }));

    const episodeLinks = () =>
      crew.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/episodes/"));
    expect(episodeLinks()).toHaveLength(10);

    // Named for its card, since two expanded cards each carry one.
    await userEvent.click(
      crew.getByRole("button", { name: "Show more of Gamma Show (10 of 25 shown)" }),
    );
    expect(episodeLinks()).toHaveLength(20);
    await userEvent.click(crew.getByRole("button", { name: /^Show more of Gamma Show/ }));
    expect(episodeLinks()).toHaveLength(25);
    expect(crew.queryByRole("button", { name: /^Show more/ })).not.toBeInTheDocument();
  });

  it("summarises a card by character, not just a count", async () => {
    const character = { id: 13, name: "Guest Of The Week", image_medium: null };
    serveCredits({
      guest_cast: [930, 931].map((id, i) => ({
        show: gamma,
        episode: ep(id, 3 - i, "2019-04-09"),
        character,
        self: false,
        voice: false,
      })),
    });
    renderPerson();

    await switchToTab("Cast (1)");
    const cast = within(screen.getByRole("region", { name: /^Cast/ }));
    // "2 episodes" alone would not say who they played.
    expect(
      cast.getByRole("button", { name: "Gamma Show — Guest Of The Week · 2 episodes" }),
    ).toBeInTheDocument();
  });

  it("merges two characters on one show into a single card", async () => {
    serveCredits({
      cast: [
        { name: "Mark Scout", voice: false },
        { name: "Mark S.", voice: true },
      ].map((c, i) => ({
        show: gamma,
        character: { id: i + 1, name: c.name, image_medium: null },
        self: false,
        voice: c.voice,
        episode_count: 9,
        seasons: [1],
        last_credited: null,
      })),
    });
    renderPerson();

    await switchToTab("Cast (1)");
    const cast = within(screen.getByRole("region", { name: /^Cast/ }));
    // One card, both characters, both counts summed, and one season row.
    expect(cast.getByText("Mark Scout · Mark S. (voice)")).toBeInTheDocument();
    expect(cast.getByText("· 18 episodes · 2018")).toBeInTheDocument();
    expect(cast.getAllByRole("link", { name: /^Gamma Show — Season 1/ })).toHaveLength(1);
  });
});
