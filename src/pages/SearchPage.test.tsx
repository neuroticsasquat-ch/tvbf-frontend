import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";
import { SearchPage } from "./SearchPage";

describe("SearchPage", () => {
  it("shows a hint and no results when no search query is set", () => {
    renderWithProviders(<SearchPage />, { route: "/search" });
    expect(screen.getByText(/type a show name in the search box above/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Fixture Show/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
  });

  it("renders results when the URL carries a search query", async () => {
    renderWithProviders(<SearchPage />, { route: "/search?search=fixture" });
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Fixture Show/i })).toBeInTheDocument(),
    );
  });
});
