import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { FriendsFeedPage } from "./FriendsFeedPage";

describe("FriendsFeedPage", () => {
  it("renders the Connections tab content", async () => {
    renderWithProviders(<FriendsFeedPage />);

    await waitFor(() =>
      expect(screen.getByRole("tablist", { name: /connections sections/i })).toBeInTheDocument(),
    );
  });

  it("shows a friends heading", () => {
    renderWithProviders(<FriendsFeedPage />);
    expect(screen.getByRole("heading", { name: /^friends$/i, level: 1 })).toBeInTheDocument();
  });
});
