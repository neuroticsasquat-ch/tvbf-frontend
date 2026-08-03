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

  it("renders all three credit sections when all three are populated", async () => {
    renderPerson();
    await screen.findByRole("heading", { level: 1, name: "Zoe Lead" });

    expect(await screen.findByRole("heading", { name: /^Cast/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Crew/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Guest appearances/ })).toBeInTheDocument();

    // Counts come from the payload, not from what is currently visible.
    expect(screen.getByRole("heading", { name: "Cast (2)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Crew (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Guest appearances (2)" })).toBeInTheDocument();
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
        HttpResponse.json({ cast: [], crew: [], guest_cast: [] }),
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
        HttpResponse.json({ cast: [], crew: [], guest_cast: many }),
      ),
    );
    renderPerson();

    const toggle = await screen.findByRole("button", { name: "Show all 20" });
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
