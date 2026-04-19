import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ShowDetailPage } from "./ShowDetailPage";

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
    await waitFor(() => expect(screen.getByRole("heading", { name: "Fixture Show" })).toBeInTheDocument());
    expect(screen.getByText(/Running/i)).toBeInTheDocument();
    expect(screen.getByText(/Drama/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Season \d/i }).length).toBeGreaterThan(0);
  });

  it("renders not-found for missing shows", async () => {
    renderWithProviders(routed(), { route: "/shows/999" });
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument());
  });
});
