import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { Route, Routes, useLocation } from "react-router";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/renderWithProviders";
import { EpisodesPage } from "./EpisodesPage";

const base = env.apiBaseUrl;

function LocationSpy() {
  return <div data-testid="location">{useLocation().search}</div>;
}

function routed() {
  return (
    <Routes>
      <Route
        path="/shows/:id/episodes"
        element={
          <>
            <EpisodesPage />
            <LocationSpy />
          </>
        }
      />
    </Routes>
  );
}

describe("EpisodesPage", () => {
  it("renders default (season 1) episodes", async () => {
    renderWithProviders(routed(), { route: "/shows/100/episodes" });
    await waitFor(() => expect(screen.getByText("Pilot")).toBeInTheDocument());
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("loads a specific season from ?season", async () => {
    renderWithProviders(routed(), { route: "/shows/100/episodes?season=2" });
    await waitFor(() => expect(screen.getByText("S2 Pilot")).toBeInTheDocument());
  });

  it("changes season via the dropdown", async () => {
    const user = userEvent.setup();
    renderWithProviders(routed(), { route: "/shows/100/episodes" });
    await waitFor(() => expect(screen.getByText("Pilot")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Select season/i }));
    await user.click(screen.getByRole("button", { name: "Season 2" }));
    await waitFor(() => expect(screen.getByText("S2 Pilot")).toBeInTheDocument());
  });

  it("opens on Episodes, with Cast and Crew beside it", async () => {
    renderWithProviders(routed(), { route: "/shows/100/episodes" });

    // Season 1's fixtures: one regular and two guests, two crew.
    expect(await screen.findByRole("tab", { name: /^Cast \(3\)/ })).toBeEnabled();
    expect(screen.getByRole("tab", { name: /^Crew \(2\)/ })).toBeEnabled();
    expect(screen.getByRole("tab", { name: /^Episodes/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Pilot")).toBeInTheDocument();
  });

  it("shows the regular cast, then the guest stars with their appearances", async () => {
    renderWithProviders(routed(), { route: "/shows/100/episodes?tab=cast" });

    const regulars = await screen.findByRole("region", { name: /^Regular cast/ });
    const guests = screen.getByRole("region", { name: /^Guest stars/ });
    // Regulars first, and with no count: TMDB credits them on every episode.
    expect(regulars.compareDocumentPosition(guests) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(regulars).getByText("Zoe Lead")).toBeInTheDocument();
    expect(within(regulars).queryByText(/episodes?$/)).not.toBeInTheDocument();
    expect(within(guests).getByText("2 episodes")).toBeInTheDocument();
    expect(within(guests).getByText("1 episode")).toBeInTheDocument();
  });

  it("groups the season's crew by role, with counts", async () => {
    renderWithProviders(routed(), { route: "/shows/100/episodes?tab=crew" });

    const panel = await screen.findByRole("tabpanel");
    expect(await within(panel).findByRole("heading", { name: "Director" })).toBeInTheDocument();
    expect(within(panel).getByRole("heading", { name: "Writer" })).toBeInTheDocument();
    expect(within(panel).getByText("2 episodes")).toBeInTheDocument();
  });

  it("disables an empty Cast or Crew tab, never Episodes", async () => {
    // Season 2 has no credits in the fixtures.
    renderWithProviders(routed(), { route: "/shows/100/episodes?season=2&tab=cast" });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /^Cast \(0\)/ })).toBeDisabled();
      expect(screen.getByRole("tab", { name: /^Crew \(0\)/ })).toBeDisabled();
    });
    // A link to an empty tab lands on Episodes.
    expect(screen.getByRole("tab", { name: /^Episodes/ })).toBeEnabled();
    expect(screen.getByRole("tab", { name: /^Episodes/ })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the tab when the season changes", async () => {
    server.use(
      http.get(`${base}/shows/100/seasons/2/cast`, () =>
        HttpResponse.json({
          regulars: [
            {
              person: { id: 40, name: "Season Two Lead", image_medium: null },
              character: { id: 41, name: "Lead", image_medium: null },
              self: false,
              voice: false,
              episode_count: null,
            },
          ],
          guests: [],
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(routed(), { route: "/shows/100/episodes?tab=cast" });
    expect(await screen.findByText("Zoe Lead")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next season" }));
    expect(await screen.findByText("Season Two Lead")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("tab=cast");
    expect(screen.getByTestId("location")).toHaveTextContent("season=2");
  });

  it("replaces the URL when switching tabs, and keeps Episodes out of it", async () => {
    const user = userEvent.setup();
    renderWithProviders(routed(), { route: "/shows/100/episodes" });
    const historyBefore = window.history.length;

    await user.click(await screen.findByRole("tab", { name: /^Crew/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("?tab=crew");

    await user.click(screen.getByRole("tab", { name: /^Episodes/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("");
    expect(window.history.length).toBe(historyBefore);
  });
});
