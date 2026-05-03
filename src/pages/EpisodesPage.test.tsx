import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router";
import { renderWithProviders } from "@/test/renderWithProviders";
import { EpisodesPage } from "./EpisodesPage";

function routed() {
  return (
    <Routes>
      <Route path="/shows/:id/episodes" element={<EpisodesPage />} />
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
});
