import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MyShowEntry, ShowSummary } from "@/api/types";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MyShowCard } from "./MyShowCard";

function makeShow(overrides: Partial<ShowSummary> = {}): ShowSummary {
  return {
    id: 1,
    name: "Test Show",
    type: null,
    status: "Returning Series",
    language: null,
    premiered: "2020-01-01",
    ended: null,
    image_medium: null,
    image_original: null,
    network: null,
    web_channel: null,
    genres: [],
    matched_aka: null,
    rating_average: null,
    my_rating: null,
    ...overrides,
  };
}

function makeEntry(my_rating: number | null = null): MyShowEntry {
  return {
    show: makeShow(),
    watched_episode_count: 0,
    total_episode_count: 10,
    aired_episode_count: 10,
    upcoming_episode_count: 0,
    last_aired: null,
    last_watched_at: null,
    first_watched_at: null,
    next_episode: null,
    added_at: "2026-01-01T00:00:00Z",
    my_rating,
  };
}

describe("MyShowCard", () => {
  it("renders my-rating badge when my_rating is set", () => {
    renderWithProviders(<MyShowCard entry={makeEntry(4)} />);
    expect(screen.getByRole("img", { name: "Your rating: 4.0 out of 5" })).toBeInTheDocument();
  });

  it("hides my-rating badge when my_rating is null", () => {
    renderWithProviders(<MyShowCard entry={makeEntry(null)} />);
    expect(screen.queryByRole("img", { name: /rating:/ })).not.toBeInTheDocument();
  });

  it("marks a tracked show with the shared library badge, not a green check", () => {
    // The same assertion `ShowCard.test.tsx` makes, which is the point: one
    // claim, one picture. This card drew its own emerald ✓ until the three
    // definitions were unified on `InMyShowsBadge`, and emerald means *watched*
    // everywhere else in the app.
    renderWithProviders(<MyShowCard entry={makeEntry(null)} />);
    expect(screen.getByRole("img", { name: "In My Shows" })).toBeInTheDocument();
  });

  it("renders no mark when the show is not in My Shows", () => {
    renderWithProviders(<MyShowCard entry={makeEntry(null)} inMyShows={false} />);
    expect(screen.queryByTitle("In My Shows")).not.toBeInTheDocument();
  });
});
