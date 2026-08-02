import { screen, waitFor } from "@testing-library/react";
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

  it("renders cast and crew sections for a populated show", async () => {
    renderWithProviders(routed(), { route: "/shows/100" });

    expect(await screen.findByRole("heading", { name: /^Cast/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Crew/ })).toBeInTheDocument();
    expect(screen.getByText("Zoe Lead")).toBeInTheDocument();
    expect(screen.getByText("Wes Creator")).toBeInTheDocument();
  });

  it("omits the crew section when a show has cast but no crew", async () => {
    server.use(http.get(`${base}/shows/100/crew`, () => HttpResponse.json([])));
    renderWithProviders(routed(), { route: "/shows/100" });

    expect(await screen.findByRole("heading", { name: /^Cast/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: /^Crew/ })).not.toBeInTheDocument(),
    );
  });

  it("omits both sections when a show has neither cast nor crew", async () => {
    server.use(
      http.get(`${base}/shows/100/cast`, () => HttpResponse.json([])),
      http.get(`${base}/shows/100/crew`, () => HttpResponse.json([])),
    );
    renderWithProviders(routed(), { route: "/shows/100" });
    await screen.findByRole("heading", { name: "Fixture Show" });

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /^Cast/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /^Crew/ })).not.toBeInTheDocument();
    });
  });
});
