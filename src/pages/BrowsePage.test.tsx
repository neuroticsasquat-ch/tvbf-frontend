import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/renderWithProviders";
import { BrowsePage } from "./BrowsePage";

function LocationReadout() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

describe("BrowsePage", () => {
  it("renders a list of shows", async () => {
    renderWithProviders(<BrowsePage />);
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Fixture Show/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: /Another Show/i })).toBeInTheDocument();
  });

  it("shows the loading skeleton first", () => {
    renderWithProviders(<BrowsePage />);
    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  it("updates query params when sort changes", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <BrowsePage />
        <LocationReadout />
      </>,
    );
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Fixture Show/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("combobox", { name: /sort/i }));
    await user.click(screen.getByRole("option", { name: /Name \(Z–A\)/i }));
    await waitFor(
      () =>
        expect(screen.getByTestId("location-search").textContent).toContain("sort=-name"),
      { timeout: 3000 },
    );
  });
});
