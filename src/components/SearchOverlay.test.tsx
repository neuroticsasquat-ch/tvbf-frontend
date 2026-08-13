import { screen, waitFor } from "@testing-library/react";
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
