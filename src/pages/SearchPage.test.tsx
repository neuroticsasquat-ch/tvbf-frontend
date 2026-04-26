import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "@/test/renderWithProviders";
import { SearchPage } from "./SearchPage";

function LocationReadout() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

describe("SearchPage", () => {
  it("shows a hint and no results when the search box is empty", () => {
    renderWithProviders(<SearchPage />);
    expect(screen.getByLabelText(/search/i)).toBeInTheDocument();
    expect(screen.getByText(/type a show name to search/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Fixture Show/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
  });

  it("renders results once the user types", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchPage />);
    await user.type(screen.getByLabelText(/search/i), "fixture");
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Fixture Show/i })).toBeInTheDocument(),
    );
  });

  it("debounces typing into the search query string", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <SearchPage />
        <LocationReadout />
      </>,
    );
    await user.type(screen.getByLabelText(/search/i), "office");
    await waitFor(
      () =>
        expect(screen.getByTestId("location-search").textContent).toContain("search=office"),
      { timeout: 3000 },
    );
  });
});
