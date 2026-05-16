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
    status: "Running",
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
    expect(screen.getByTitle("Your rating")).toBeInTheDocument();
  });

  it("hides my-rating badge when my_rating is null", () => {
    renderWithProviders(<MyShowCard entry={makeEntry(null)} />);
    expect(screen.queryByTitle("Your rating")).not.toBeInTheDocument();
  });
});
