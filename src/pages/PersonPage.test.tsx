import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { fixturePerson, fixturePersonCredits } from "@/test/msw/fixtures";
import { renderWithProviders } from "@/test/renderWithProviders";
import { PersonPage } from "./PersonPage";

const base = env.apiBaseUrl;

function routed() {
  return (
    <Routes>
      <Route path="/people/:personId" element={<PersonPage />} />
    </Routes>
  );
}

function renderPerson(id: number | string = 300) {
  return renderWithProviders(routed(), { route: `/people/${id}` });
}

describe("PersonPage", () => {
  it("renders the header with name, dates and country", async () => {
    renderPerson();

    expect(await screen.findByRole("heading", { level: 1, name: "Zoe Lead" })).toBeInTheDocument();
    // The date must not shift a day — it is built from parts, not UTC-parsed.
    expect(screen.getByText("Born September 9, 1972 · Croatia")).toBeInTheDocument();
  });

  it("renders all four credit sections when all four are populated", async () => {
    renderPerson();
    await screen.findByRole("heading", { level: 1, name: "Zoe Lead" });

    expect(await screen.findByRole("heading", { name: /^Cast/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Crew/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Guest appearances/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Episode crew/ })).toBeInTheDocument();

    // Counts come from the payload, not from what is currently visible.
    expect(screen.getByRole("heading", { name: "Cast (2)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Crew (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Guest appearances (2)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Episode crew (3)" })).toBeInTheDocument();
  });

  it("keeps episode crew separate from show-level crew", async () => {
    renderPerson();

    // The two sections answer different questions and point at different
    // things: a standing production role links to the show, one night's
    // directing links to the episode. Merging them would put both destinations
    // under one heading.
    const crew = within(await screen.findByRole("region", { name: /^Crew/ }));
    expect(crew.getByRole("heading", { name: "Crew (1)" })).toBeInTheDocument();
    expect(crew.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/shows/100"]);

    const epCrew = within(screen.getByRole("region", { name: /^Episode crew/ }));
    const epHrefs = epCrew.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(epHrefs.every((h) => h?.startsWith("/episodes/"))).toBe(true);
  });

  it("collapses two roles on one episode into a single entry", async () => {
    renderPerson();

    const epCrew = within(await screen.findByRole("region", { name: /^Episode crew/ }));

    // Upstream really does credit one person as both Story and Teleplay on an
    // episode, and both credits must survive — but they describe one night's
    // work on one episode, so they read as one entry with both roles rather
    // than two links with the same href.
    const episode = epCrew.getByRole("link", { name: "Gamma Show — S2E11" });
    expect(episode).toHaveAttribute("href", "/episodes/900");
    expect(epCrew.getByText("The Reckoning · Director · Teleplay")).toBeInTheDocument();

    // Exactly one link to that episode. Two identically-named links to one href
    // is what `linkLabel` used to paper over; collapsing removes the collision.
    expect(
      epCrew.getAllByRole("link").filter((a) => a.getAttribute("href") === "/episodes/900"),
    ).toHaveLength(1);

    // A special is unnumbered upstream, so it degrades to the season alone, and
    // an unnamed episode leaves the role as the whole detail line.
    expect(epCrew.getByRole("link", { name: "Delta Show — S1" })).toHaveAttribute(
      "href",
      "/episodes/901",
    );
    expect(epCrew.getByText("Writer")).toBeInTheDocument();
  });

  it("hides the episode crew section for a person who has none", async () => {
    server.use(
      http.get(`${base}/people/300/credits`, () =>
        HttpResponse.json({ ...fixturePersonCredits, episode_crew: [] }),
      ),
    );
    renderPerson();

    expect(await screen.findByRole("heading", { name: /^Cast/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^Episode crew/ })).not.toBeInTheDocument();
  });

  it("does not claim a director with only episode crew credits has no credits", async () => {
    // Episode crew is reachable by no other route upstream, so this is a real
    // shape: a working director whose entire filmography is episode-level.
    server.use(
      http.get(`${base}/people/300/credits`, () =>
        HttpResponse.json({
          cast: [],
          crew: [],
          guest_cast: [],
          episode_crew: fixturePersonCredits.episode_crew,
        }),
      ),
    );
    renderPerson();

    expect(await screen.findByRole("heading", { name: "Episode crew (3)" })).toBeInTheDocument();
    expect(screen.queryByText("No credits yet.")).not.toBeInTheDocument();
  });

  it("links cast and crew credits to the show", async () => {
    renderPerson();

    const cast = within(await screen.findByRole("region", { name: /^Cast/ }));
    expect(cast.getByRole("link", { name: "Alpha Show" })).toHaveAttribute("href", "/shows/100");
    expect(cast.getByText("Captain Alpha · 2020")).toBeInTheDocument();
    // Voice roles stay marked, same as on the show page.
    expect(cast.getByText("Doctor Beta (voice) · 2015")).toBeInTheDocument();

    const crew = within(screen.getByRole("region", { name: /^Crew/ }));
    expect(crew.getByRole("link", { name: "Alpha Show" })).toHaveAttribute("href", "/shows/100");
    expect(crew.getByText("Executive Producer · 2020")).toBeInTheDocument();
  });

  it("renders guest credits with episode context, not bare episode names", async () => {
    renderPerson();

    const guest = within(await screen.findByRole("region", { name: /^Guest appearances/ }));
    // "Show — S2E11" in one payload: the show name must be on the credit itself.
    const link = guest.getByRole("link", { name: "Gamma Show — S2E11" });
    expect(link).toHaveAttribute("href", "/episodes/900");
    expect(guest.getByText("The Reckoning · Guest Of The Week")).toBeInTheDocument();

    // A special is unnumbered upstream, so it degrades to the season alone.
    expect(guest.getByRole("link", { name: "Delta Show — S1" })).toHaveAttribute(
      "href",
      "/episodes/901",
    );
  });

  it("hides sections that are empty rather than rendering empty headers", async () => {
    server.use(
      http.get(`${base}/people/300/credits`, () =>
        HttpResponse.json({ ...fixturePersonCredits, cast: [], guest_cast: [] }),
      ),
    );
    renderPerson();

    expect(await screen.findByRole("heading", { name: /^Crew/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^Cast/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^Guest appearances/ })).not.toBeInTheDocument();
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
  });

  it("collapses a long section behind a show-all toggle", async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      ...fixturePersonCredits.guest_cast[0],
      show: { id: 200 + i, name: `Show ${i}`, image_medium: null, premiered: null },
      episode: { id: 900 + i, name: `Episode ${i}`, season: 1, number: i + 1, airdate: null },
    }));
    server.use(
      http.get(`${base}/people/300/credits`, () =>
        HttpResponse.json({ cast: [], crew: [], guest_cast: many, episode_crew: [] }),
      ),
    );
    renderPerson();

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

describe("PersonPage credit grouping", () => {
  const show102 = { id: 102, name: "Gamma Show", image_medium: null, premiered: "2018-03-01" };

  function ep(id: number, number: number, airdate: string) {
    return { id, name: `Episode ${number}`, season: 2, number, airdate };
  }

  function serveCredits(credits: Partial<typeof fixturePersonCredits>) {
    server.use(
      http.get(`${base}/people/300/credits`, () =>
        HttpResponse.json({
          cast: [],
          crew: [],
          guest_cast: [],
          episode_crew: [],
          ...credits,
        }),
      ),
    );
  }

  it("collapses many episodes of one show behind a disclosure, keeping every episode link", async () => {
    serveCredits({
      episode_crew: [
        { show: show102, episode: ep(910, 3, "2019-04-09"), role: "Director" },
        { show: show102, episode: ep(911, 2, "2019-04-02"), role: "Director" },
        { show: show102, episode: ep(912, 1, "2019-03-26"), role: "Director" },
      ],
    });
    renderPerson();

    const epCrew = within(await screen.findByRole("region", { name: /^Episode crew/ }));

    // Three credits, one card. The heading still counts credits: the number
    // states the size of the filmography, not how many shows it spans.
    expect(epCrew.getByRole("heading", { name: "Episode crew (3)" })).toBeInTheDocument();
    const disclosure = epCrew.getByRole("button", { name: "Gamma Show — Director · 3 episodes" });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");

    // A chevron marks the control as interactive — the summary is a noun
    // phrase, so without it nothing says the card expands. It must stay
    // aria-hidden: decorative, and it would otherwise pollute the name above.
    const chevron = disclosure.querySelector("svg");
    expect(chevron).not.toBeNull();
    expect(chevron).toHaveAttribute("aria-hidden");

    // Collapsed, the episodes are not rendered — only the show link.
    expect(epCrew.queryByRole("link", { name: /Gamma Show — S2E3/ })).not.toBeInTheDocument();

    await userEvent.click(disclosure);
    expect(disclosure).toHaveAttribute("aria-expanded", "true");

    // Expanded, every episode is reachable by its own link — the whole reason
    // these groups expand rather than collapsing to a show-level summary.
    for (const [id, code] of [
      [910, "S2E3"],
      [911, "S2E2"],
      [912, "S2E1"],
    ] as const) {
      expect(
        epCrew.getByRole("link", { name: new RegExp(`^Gamma Show — ${code} `) }),
      ).toHaveAttribute("href", `/episodes/${id}`);
    }
  });

  it("merges two characters on one show into a single cast card", async () => {
    serveCredits({
      cast: [
        {
          show: show102,
          character: { id: 1, name: "Mark Scout", image_medium: null },
          self: false,
          voice: false,
        },
        {
          show: show102,
          character: { id: 2, name: "Mark S.", image_medium: null },
          self: false,
          voice: true,
        },
      ],
    });
    renderPerson();

    const cast = within(await screen.findByRole("region", { name: /^Cast/ }));
    expect(cast.getByRole("heading", { name: "Cast (2)" })).toBeInTheDocument();

    // One card, both characters, still linking to the show as it always did.
    const links = cast.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/shows/102");
    expect(cast.getByText("Mark Scout · Mark S. (voice) · 2018")).toBeInTheDocument();
  });

  it("leaves a one-credit-per-show filmography looking unchanged", async () => {
    serveCredits({
      guest_cast: [
        {
          show: show102,
          episode: ep(920, 4, "2019-05-01"),
          character: { id: 3, name: "Guest", image_medium: null },
          self: false,
          voice: false,
        },
      ],
    });
    renderPerson();

    const guest = within(await screen.findByRole("region", { name: /^Guest/ }));

    // No expander and no "1 episode": the common case must not gain ceremony.
    expect(guest.queryByRole("button")).not.toBeInTheDocument();
    expect(guest.getByRole("link", { name: "Gamma Show — S2E4" })).toHaveAttribute(
      "href",
      "/episodes/920",
    );
  });
});

describe("PersonPage grouped-card accessibility", () => {
  function ep(id: number, number: number, airdate: string) {
    return { id, name: `Episode ${number}`, season: 2, number, airdate };
  }

  it("distinguishes two shows whose groups would otherwise read identically", async () => {
    const gamma = { id: 102, name: "Gamma Show", image_medium: null, premiered: "2018-03-01" };
    const delta = { id: 103, name: "Delta Show", image_medium: null, premiered: "2016-01-01" };
    server.use(
      http.get(`${base}/people/300/credits`, () =>
        HttpResponse.json({
          cast: [],
          crew: [],
          guest_cast: [],
          episode_crew: [
            { show: gamma, episode: ep(910, 3, "2019-04-09"), role: "Director" },
            { show: gamma, episode: ep(911, 2, "2019-04-02"), role: "Director" },
            { show: delta, episode: ep(920, 3, "2017-04-09"), role: "Director" },
            { show: delta, episode: ep(921, 2, "2017-04-02"), role: "Director" },
          ],
        }),
      ),
    );
    renderPerson();

    const epCrew = within(await screen.findByRole("region", { name: /^Episode crew/ }));

    // Both cards summarise as "Director · 2 episodes". Without the show in the
    // accessible name a screen reader announces two identical buttons.
    const gammaToggle = epCrew.getByRole("button", { name: "Gamma Show — Director · 2 episodes" });
    const deltaToggle = epCrew.getByRole("button", { name: "Delta Show — Director · 2 episodes" });

    await userEvent.click(gammaToggle);
    await userEvent.click(deltaToggle);

    // Both expanded, both contain an "S2E3" — so the episode links need the
    // show too, or they collide in a screen reader's link list.
    expect(epCrew.getByRole("link", { name: /^Gamma Show — S2E3 / })).toHaveAttribute(
      "href",
      "/episodes/910",
    );
    expect(epCrew.getByRole("link", { name: /^Delta Show — S2E3 / })).toHaveAttribute(
      "href",
      "/episodes/920",
    );
  });

  it("makes the whole episode row the link, not just the episode code", async () => {
    const gamma = { id: 102, name: "Gamma Show", image_medium: null, premiered: "2018-03-01" };
    server.use(
      http.get(`${base}/people/300/credits`, () =>
        HttpResponse.json({
          cast: [],
          crew: [],
          guest_cast: [],
          episode_crew: [
            { show: gamma, episode: ep(910, 3, "2019-04-09"), role: "Director" },
            { show: gamma, episode: ep(911, 2, "2019-04-02"), role: "Director" },
          ],
        }),
      ),
    );
    renderPerson();

    const epCrew = within(await screen.findByRole("region", { name: /^Episode crew/ }));
    await userEvent.click(epCrew.getByRole("button", { name: /^Gamma Show —/ }));

    // The episode name and role used to sit outside the anchor, so the widest
    // part of the row did nothing when clicked. They must be inside it.
    const row = epCrew.getByRole("link", { name: /^Gamma Show — S2E3 / });
    expect(row).toHaveAttribute("href", "/episodes/910");
    expect(row).toHaveTextContent("S2E3 Episode 3 · Director");

    // Nothing in the row is left outside the link.
    const item = row.closest("li");
    expect(item?.textContent).toBe(row.textContent);
  });

  it("caps the episodes listed in a group and states the remainder", async () => {
    const gamma = { id: 102, name: "Gamma Show", image_medium: null, premiered: "2018-03-01" };
    // 25 episodes on one show. Real data goes far higher — 8,010 episode-crew
    // credits on Jeopardy! for one person — so the list has to stop somewhere.
    const credits = Array.from({ length: 25 }, (_, i) => ({
      show: gamma,
      episode: ep(1000 + i, 25 - i, "2019-04-09"),
      role: "Director",
    }));
    server.use(
      http.get(`${base}/people/300/credits`, () =>
        HttpResponse.json({ cast: [], crew: [], guest_cast: [], episode_crew: credits }),
      ),
    );
    renderPerson();

    const epCrew = within(await screen.findByRole("region", { name: /^Episode crew/ }));
    // The summary still states the true total.
    await userEvent.click(
      epCrew.getByRole("button", { name: "Gamma Show — Director · 25 episodes" }),
    );

    // Ten listed, fifteen accounted for in words.
    const episodeLinks = epCrew
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href")?.startsWith("/episodes/"));
    expect(episodeLinks).toHaveLength(10);
    expect(epCrew.getByText("+15 more")).toBeInTheDocument();

    // Deliberately inert: the only control in the section is the disclosure
    // itself, so there is no way to expand into thousands of rows.
    expect(epCrew.getAllByRole("button")).toHaveLength(1);
  });

  it("summarises a guest group by character, not just a count", async () => {
    const gamma = { id: 102, name: "Gamma Show", image_medium: null, premiered: "2018-03-01" };
    const character = { id: 13, name: "Guest Of The Week", image_medium: null };
    server.use(
      http.get(`${base}/people/300/credits`, () =>
        HttpResponse.json({
          cast: [],
          crew: [],
          episode_crew: [],
          guest_cast: [
            { show: gamma, episode: ep(930, 3, "2019-04-09"), character, self: false, voice: false },
            { show: gamma, episode: ep(931, 2, "2019-04-02"), character, self: false, voice: false },
          ],
        }),
      ),
    );
    renderPerson();

    const guest = within(await screen.findByRole("region", { name: /^Guest/ }));
    // "2 episodes" alone would not say who they played.
    expect(
      guest.getByRole("button", { name: "Gamma Show — Guest Of The Week · 2 episodes" }),
    ).toBeInTheDocument();
  });
});
