import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";

import { env } from "@/env";
import { server } from "@/test/msw/server";
import { fixturePersonListPage, fixtureShowListPage } from "@/test/msw/fixtures";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SearchOverlay } from "./SearchOverlay";

const base = env.apiBaseUrl;

const emptyShows = { items: [], page: 1, per_page: 50, total: 0, total_pages: 1 };
const emptyPeople = { items: [], page: 1, per_page: 24, total: 0, total_pages: 1 };

function noShows() {
  server.use(http.get(`${base}/shows`, () => HttpResponse.json(emptyShows)));
}

function noPeople() {
  server.use(http.get(`${base}/people`, () => HttpResponse.json(emptyPeople)));
}

/** The overlay plus a stub person route, so a person result can be followed. */
function renderOverlay(search = "fixture") {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<SearchOverlay search={search} />} />
      <Route path="/people/:personId" element={<h1>Person page stub</h1>} />
    </Routes>,
  );
}

describe("SearchOverlay", () => {
  // Sort/filter state persists to localStorage, so one test's filter would
  // otherwise be the next test's starting state.
  beforeEach(() => window.localStorage.clear());

  it("renders both sections when shows and people match", async () => {
    renderOverlay();

    // The Shows heading is up during the skeleton, so wait on a result.
    expect(await screen.findByRole("link", { name: /Fixture Show/i })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /^People/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Shows/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zoe Lead" })).toHaveAttribute("href", "/people/300");
    expect(screen.queryByText(/No shows or people match/i)).not.toBeInTheDocument();
  });

  it("hides the People section when only shows match", async () => {
    noPeople();
    renderOverlay();

    expect(await screen.findByRole("link", { name: /Fixture Show/i })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /^People/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { name: /^Shows/ })).toBeInTheDocument();
    expect(screen.queryByText(/No shows or people match/i)).not.toBeInTheDocument();
  });

  it("hides the Shows section when only people match", async () => {
    noShows();
    renderOverlay();

    expect(await screen.findByRole("heading", { name: /^People/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^Shows/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zoe Lead" })).toBeInTheDocument();
    expect(screen.queryByText(/No shows or people match/i)).not.toBeInTheDocument();
  });

  it("shows the combined empty state only when neither matches", async () => {
    noShows();
    noPeople();
    renderOverlay("nothingatall");

    expect(await screen.findByText(/No shows or people match "nothingatall"/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^Shows/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^People/ })).not.toBeInTheDocument();
  });

  it("keeps an empty Shows section on screen when a filter is what emptied it", async () => {
    // Otherwise the controls that caused the emptiness vanish with the section.
    server.use(
      http.get(`${base}/shows`, ({ request }) => {
        const status = new URL(request.url).searchParams.get("status");
        return HttpResponse.json(status ? emptyShows : fixtureShowListPage);
      }),
    );
    const user = userEvent.setup();
    renderOverlay();
    await screen.findByRole("link", { name: /Fixture Show/i });

    await user.click(screen.getByRole("button", { name: /filter by show status/i }));
    await user.click(await screen.findByRole("button", { name: "Returning Series" }));

    expect(await screen.findByRole("heading", { name: /^Shows/ })).toBeInTheDocument();
    expect(screen.getByText(/No shows match these filters/i)).toBeInTheDocument();
  });

  it("marks a tracked show in the results grid, alongside both ratings", async () => {
    // The bug this ticket was filed about, reproduced: a tracked, rated show
    // showed its own ★4.5 and TMDB's ★4.1 and no library mark. All three
    // belong on the one card, so all three are asserted on the one card — and
    // the unmarked row rides in the same payload, so what is being asserted is
    // the mark rather than which row was served.
    //
    // Grid only: it is the default view (`usePersistedView("search", "grid")`)
    // and the list row is NEU-1188's.
    noPeople();
    server.use(
      http.get(`${base}/shows`, () =>
        HttpResponse.json({
          ...fixtureShowListPage,
          items: [
            {
              ...fixtureShowListPage.items[0],
              name: "The Bear",
              in_my_shows: true,
              my_rating: 4.5,
              rating_average: 8.2,
            },
            { ...fixtureShowListPage.items[1], in_my_shows: false },
          ],
        }),
      ),
    );
    renderOverlay();

    const tracked = await screen.findByRole("link", { name: /The Bear/i });
    const card = tracked.closest("div");
    if (!card) throw new Error("the card link is not inside an element");
    // Scoped to the one card, or a badge from a neighbouring row would satisfy
    // the assertion and the "all three on one card" claim would be untested.
    expect(within(card).queryByText("Another Show")).not.toBeInTheDocument();
    expect(within(card).getByTitle("In your My Shows")).toBeInTheDocument();
    expect(within(card).getByTitle("Your rating: 4.5 out of 5")).toBeInTheDocument();
    expect(within(card).getByTitle("TMDB average: 4.1 out of 5")).toBeInTheDocument();

    // Marked, never filtered: the untracked row is still there, unmarked.
    expect(screen.getByRole("link", { name: /Another Show/i })).toBeInTheDocument();
    expect(screen.getAllByTitle("In your My Shows")).toHaveLength(1);
  });

  /** A `/shows` handler that tells the truth about membership: a `PUT` adds the
   * show, a `DELETE` removes it, and every subsequent search body reflects it.
   *
   * A fixed body would make this test pass for the wrong reason — the chip's
   * optimistic state would survive only because nothing ever contradicted it,
   * and the refetch `invalidateAll` fires would silently restore "Add". This is
   * the only test that exercises the real payload path, so the server it talks
   * to has to behave like one.
   */
  function trackingServer() {
    const tracked = new Set<number>();
    server.use(
      http.get(`${base}/shows`, () =>
        HttpResponse.json({
          ...fixtureShowListPage,
          items: fixtureShowListPage.items.map((s) => ({
            ...s,
            in_my_shows: tracked.has(s.id),
          })),
        }),
      ),
      http.put(`${base}/me/shows/:id`, ({ params }) => {
        tracked.add(Number(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete(`${base}/me/shows/:id`, ({ params }) => {
        tracked.delete(Number(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
  }

  describe.each([
    { view: "grid", label: "Grid view" },
    { view: "list", label: "List view" },
  ])("adding a show from the $view of results (NEU-1192)", ({ view, label }) => {
    it("leaves the result in place and moves the control to its tracked state", async () => {
      // AC 1 and AC 2. The recommendations grid confirms an add by the card
      // *vanishing*; a search result still matches the query, so it stays put
      // and the control's own state change is the whole confirmation.
      const user = userEvent.setup();
      noPeople();
      trackingServer();
      window.localStorage.setItem("tvbf:view:search", view);
      renderOverlay();

      expect(await screen.findByRole("button", { name: label })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const add = await screen.findByRole("button", { name: "Add Fixture Show to My Shows" });
      await user.click(add);

      expect(
        await screen.findByRole("button", { name: "Remove Fixture Show from My Shows" }),
      ).toBeInTheDocument();
      // Still on screen, and the mark agrees with the control (AC 3). By text
      // rather than by link: the list row is two links to the same show (the
      // poster and the name), the card is one, and the result being on screen
      // is the claim either way.
      expect(screen.getByText("Fixture Show")).toBeInTheDocument();
      await waitFor(() => expect(screen.getAllByTitle("In your My Shows")).toHaveLength(1));
      // And the neighbouring result is untouched by either.
      expect(
        screen.getByRole("button", { name: "Add Another Show to My Shows" }),
      ).toBeInTheDocument();
    });
  });

  it("tabs from the last show into the People section and activates with Enter", async () => {
    const user = userEvent.setup();
    renderOverlay();
    await screen.findByRole("heading", { name: /^People/ });

    const lastShow = screen.getByRole("link", { name: /Another Show/i });
    const firstPerson = screen.getByRole("link", { name: "Zoe Lead" });

    // Results are links in document order: Shows then People, no gap.
    const links = screen.getAllByRole("link");
    expect(links.indexOf(firstPerson)).toBe(links.indexOf(lastShow) + 1);

    lastShow.focus();
    // One stop between the two, and it is the last card's own My Shows control
    // (NEU-1192): the results are still adjacent in document order, and a
    // control that belongs to a card sits inside it rather than after the
    // section. Asserted rather than tabbed past, so a *second* stop appearing
    // here — the failure mode a bare double `tab()` would hide — fails.
    await user.tab();
    expect(screen.getByRole("button", { name: "Add Another Show to My Shows" })).toHaveFocus();
    await user.tab();
    expect(firstPerson).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { name: "Person page stub" })).toBeInTheDocument();
  });

  it("renders the show grid without waiting for a slow People response", async () => {
    server.use(
      http.get(`${base}/people`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return HttpResponse.json(fixturePersonListPage);
      }),
    );
    renderOverlay();

    expect(await screen.findByRole("link", { name: /Fixture Show/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^People/ })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /^People/ })).toBeInTheDocument();
  });

  it("debounces the first keystroke too, so mounting fires no request", async () => {
    // The overlay mounts on character one, so a first value that skipped the
    // debounce would mean one un-debounced 1-character search per session.
    const searched: string[] = [];
    server.use(
      http.get(`${base}/people`, ({ request }) => {
        searched.push(new URL(request.url).searchParams.get("search") ?? "");
        return HttpResponse.json(fixturePersonListPage);
      }),
    );
    renderOverlay("z");

    expect(searched).toEqual([]);
    await screen.findByRole("heading", { name: /^People/ });
    expect(searched).toEqual(["z"]);
  });

  it("counts each section from the API total, not the rendered page", async () => {
    server.use(
      http.get(`${base}/shows`, () =>
        HttpResponse.json({ ...fixtureShowListPage, total: 87, total_pages: 2 }),
      ),
      http.get(`${base}/people`, () =>
        HttpResponse.json({ ...fixturePersonListPage, total: 40, total_pages: 2 }),
      ),
    );
    renderOverlay();

    expect(await screen.findByRole("heading", { name: "Shows (87)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "People (40)" })).toBeInTheDocument();
  });
});
