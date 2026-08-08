import { screen, waitFor } from "@testing-library/react";
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
    expect(screen.getByText(/Running/i)).toBeInTheDocument();
    expect(screen.getByText(/Drama/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Season \d/i }).length).toBeGreaterThan(0);
  });

  it("renders not-found for missing shows", async () => {
    renderWithProviders(routed(), { route: "/shows/999" });
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument());
  });

  it("carries a count on every tab and opens on seasons", async () => {
    renderWithProviders(routed(), { route: "/shows/100" });

    // Counts come from the fixtures: 3 cast, 6 crew.
    expect(await screen.findByRole("tab", { name: /Cast \(3\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Crew \(6\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Seasons/ })).toHaveAttribute("aria-selected", "true");
    // Only the active panel is mounted, so cast content is not on the page yet.
    expect(screen.queryByText("Zoe Lead")).not.toBeInTheDocument();
  });

  it("shows cast and crew content when their tabs are selected", async () => {
    renderWithProviders(routed(), { route: "/shows/100" });

    await userEvent.click(await screen.findByRole("tab", { name: /Cast/ }));
    expect(await screen.findByText("Zoe Lead")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /Crew/ }));
    expect(await screen.findByText("Wes Creator")).toBeInTheDocument();
    // Panels swap rather than stack — that is the point of the tabs.
    expect(screen.queryByText("Zoe Lead")).not.toBeInTheDocument();
  });

  it("disables the crew tab when a show has cast but no crew", async () => {
    server.use(http.get(`${base}/shows/100/crew`, () => HttpResponse.json([])));
    renderWithProviders(routed(), { route: "/shows/100" });

    expect(await screen.findByRole("tab", { name: /Cast \(3\)/ })).toBeEnabled();
    await waitFor(() => expect(screen.getByRole("tab", { name: /Crew \(0\)/ })).toBeDisabled());
  });

  it("disables both credit tabs when a show has neither", async () => {
    server.use(
      http.get(`${base}/shows/100/cast`, () => HttpResponse.json([])),
      http.get(`${base}/shows/100/crew`, () => HttpResponse.json([])),
    );
    renderWithProviders(routed(), { route: "/shows/100" });
    await screen.findByRole("heading", { name: "Fixture Show" });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Cast \(0\)/ })).toBeDisabled();
      expect(screen.getByRole("tab", { name: /Crew \(0\)/ })).toBeDisabled();
    });
    expect(screen.getByRole("tab", { name: /Seasons/ })).toHaveAttribute("aria-selected", "true");
  });

  it("deep-links to the cast panel via ?tab=cast", async () => {
    renderWithProviders(routed(), { route: "/shows/100?tab=cast" });

    expect(await screen.findByText("Zoe Lead")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Cast/ })).toHaveAttribute("aria-selected", "true");
  });

  it("falls back to seasons for an unknown tab, and for a tab the show cannot fill", async () => {
    server.use(http.get(`${base}/shows/100/crew`, () => HttpResponse.json([])));
    const { unmount } = renderWithProviders(routed(), { route: "/shows/100?tab=nonsense" });
    expect(await screen.findByRole("tab", { name: /Seasons/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    unmount();

    // A crewless show linked straight to ?tab=crew lands on seasons rather than
    // on a disabled tab with an empty panel.
    renderWithProviders(routed(), { route: "/shows/100?tab=crew" });
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /Seasons/ })).toHaveAttribute("aria-selected", "true"),
    );
  });
});
