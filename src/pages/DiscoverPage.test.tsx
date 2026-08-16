import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { DiscoverPage } from "./DiscoverPage";

describe("DiscoverPage", () => {
  // Page shell only (NEU-1113). The "Recommended for you" section and its
  // GET /me/recommendations call land in NEU-1114 — this page fetches nothing
  // today, and MSW's onUnhandledRequest: "error" is what would catch a stray
  // request if one were ever added here without a handler.
  it("renders the page heading", () => {
    renderWithProviders(<DiscoverPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Discover" })).toBeInTheDocument();
  });
});
