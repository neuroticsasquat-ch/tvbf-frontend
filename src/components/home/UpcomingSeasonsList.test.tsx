import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { ShowSummary, UpcomingSeasonEntry } from "@/api/types";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/renderWithProviders";
import { UpcomingSeasonsList } from "./UpcomingSeasonsList";

function makeShow(overrides: Partial<ShowSummary> = {}): ShowSummary {
  return {
    id: 7,
    name: "Slow Horses",
    type: null,
    status: "Returning Series",
    language: null,
    premiered: "2022-04-01",
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

const ENTRY: UpcomingSeasonEntry = {
  show: makeShow(),
  season_number: 5,
  season_name: null,
  premiere_date: "2026-09-11",
  added_at: null,
};

describe("UpcomingSeasonsList", () => {
  it("keeps two links per row, each named for its own destination", async () => {
    // NEU-1190 AC 2, and the tripwire against a later tidy-up collapsing this
    // one too. It is exempt because its two links are *not* duplicates: the
    // poster goes to the show and the text to that season's episode list, so
    // collapsing them would delete the only keyboard route from here to the
    // show page in exchange for a tab stop that confused nobody (§1.2).
    server.use(
      http.get(`${env.apiBaseUrl}/me/upcoming/seasons`, () => HttpResponse.json([ENTRY])),
    );
    renderWithProviders(<UpcomingSeasonsList />);

    await waitFor(() => expect(screen.getByText("Season 5")).toBeInTheDocument());
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Slow Horses" })).toHaveAttribute("href", "/shows/7");
    expect(links.map((l) => l.getAttribute("href"))).toContain(
      "/shows/7/episodes?season=5",
    );
  });
});
