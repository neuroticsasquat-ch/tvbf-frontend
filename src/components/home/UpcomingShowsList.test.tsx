import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import type { ShowSummary, UpcomingShowEntry } from "@/api/types";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/renderWithProviders";
import { UpcomingShowsList } from "./UpcomingShowsList";

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

const ENTRY: UpcomingShowEntry = {
  show: makeShow(),
  premiere_date: "2026-09-11",
  added_at: null,
};

function serve(entries: UpcomingShowEntry[]) {
  server.use(http.get(`${env.apiBaseUrl}/me/upcoming/shows`, () => HttpResponse.json(entries)));
}

describe("UpcomingShowsList", () => {
  it("exposes exactly one link per row, and it is the show's", async () => {
    // NEU-1190 AC 1. The poster and the row's text were two links to
    // `/shows/7`, both named for the show; the poster is presentational now.
    serve([ENTRY]);
    renderWithProviders(<UpcomingShowsList />);

    await waitFor(() => expect(screen.getByText("Slow Horses")).toBeInTheDocument());
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/shows/7");
  });

  it("draws its poster through ShowPoster rather than hand-rolling one", async () => {
    // NEU-1183's tripwire, which the presentational form does not exempt it
    // from: the corner rule is still inherited from one component.
    serve([ENTRY]);
    const { container } = renderWithProviders(<UpcomingShowsList />);

    await waitFor(() => expect(container.querySelector("[data-show-poster]")).not.toBeNull());
  });
});
