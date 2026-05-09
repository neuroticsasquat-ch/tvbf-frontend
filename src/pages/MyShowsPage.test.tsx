import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "@/test/renderWithProviders";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { MyShowsPage } from "./MyShowsPage";
import type { MyShowEntry, WatchedEntry } from "@/api/types";

function makeMyShow(showId: number, name: string): MyShowEntry {
  return {
    show: {
      id: showId,
      name,
      type: null,
      status: null,
      language: null,
      premiered: null,
      ended: null,
      image_medium: null,
      image_original: null,
      network: null,
      web_channel: null,
      genres: [],
      matched_aka: null,
    },
    watched_episode_count: 0,
    total_episode_count: 0,
    aired_episode_count: 0,
    upcoming_episode_count: 0,
    last_aired: null,
    last_watched_at: null,
    next_episode: null,
    added_at: "2026-04-01T00:00:00Z",
  };
}

function makeWatched(showId: number, name: string): WatchedEntry {
  return {
    show: {
      id: showId,
      name,
      type: null,
      status: "Ended",
      language: null,
      premiered: null,
      ended: null,
      image_medium: null,
      image_original: null,
      network: null,
      web_channel: null,
      genres: [],
      matched_aka: null,
    },
    watched_episode_count: 5,
    aired_episode_count: 5,
    total_episode_count: 5,
    last_watched_at: "2026-04-15T00:00:00Z",
    in_my_shows: false,
    status: "finished",
  };
}

describe("MyShowsPage", () => {
  let watchedCalls: URL[];
  let watchedResponse: WatchedEntry[];

  beforeEach(() => {
    window.localStorage.clear();
    watchedCalls = [];
    watchedResponse = [];
    server.use(
      http.get(`${env.apiBaseUrl}/me/shows`, () => HttpResponse.json([makeMyShow(1, "Severance")])),
      http.get(`${env.apiBaseUrl}/me/watched`, ({ request }) => {
        watchedCalls.push(new URL(request.url));
        return HttpResponse.json(watchedResponse);
      }),
    );
  });

  it("renders Active and Watched sub-tabs with Active selected by default", async () => {
    renderWithProviders(<MyShowsPage />);

    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(2));
    expect(screen.getByRole("tab", { name: /active/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /watched/i })).toHaveAttribute("aria-selected", "false");
  });

  it("does not fetch the watched list until the Watched tab is clicked", async () => {
    renderWithProviders(<MyShowsPage />);
    await waitFor(() => expect(screen.getByRole("tab", { name: /active/i })).toBeInTheDocument());
    expect(watchedCalls).toHaveLength(0);

    fireEvent.click(screen.getByRole("tab", { name: /watched/i }));
    await waitFor(() => expect(watchedCalls.length).toBeGreaterThan(0));
  });

  it("Watched tab fetches /me/watched and renders rows", async () => {
    watchedResponse = [makeWatched(99, "The Wire")];

    renderWithProviders(<MyShowsPage />);
    fireEvent.click(await screen.findByRole("tab", { name: /watched/i }));

    await waitFor(() => expect(screen.getByText("The Wire")).toBeInTheDocument());
  });

  it("Watched tab status filter re-fetches with the new status param", async () => {
    renderWithProviders(<MyShowsPage />);
    fireEvent.click(await screen.findByRole("tab", { name: /watched/i }));
    await waitFor(() => expect(watchedCalls.length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: /^finished$/i }));
    await waitFor(() => {
      const last = watchedCalls.at(-1);
      expect(last?.searchParams.get("status")).toBe("finished");
    });
  });

  it("renders the Watched empty-state when no rows", async () => {
    renderWithProviders(<MyShowsPage />);
    fireEvent.click(await screen.findByRole("tab", { name: /watched/i }));

    await waitFor(() => expect(screen.getByText(/no watch history/i)).toBeInTheDocument());
  });

  it("Active tab still renders existing My Shows list", async () => {
    renderWithProviders(<MyShowsPage />);
    await waitFor(() => expect(screen.getByText("Severance")).toBeInTheDocument());
  });
});
