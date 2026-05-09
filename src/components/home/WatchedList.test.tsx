import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "@/test/renderWithProviders";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { WatchedList } from "./WatchedList";
import type { WatchedEntry } from "@/api/types";

function makeWatched(
  showId: number,
  name: string,
  overrides: Partial<WatchedEntry> = {},
): WatchedEntry {
  return {
    show: {
      id: showId,
      name,
      type: null,
      status: "Ended",
      language: null,
      premiered: "2020-01-01",
      ended: null,
      image_medium: "https://example.com/poster.jpg",
      image_original: null,
      network: null,
      web_channel: null,
      genres: [],
      matched_aka: null,
    },
    watched_episode_count: 8,
    aired_episode_count: 10,
    total_episode_count: 12,
    last_watched_at: "2026-04-15T00:00:00Z",
    in_my_shows: false,
    status: "in_progress",
    ...overrides,
  };
}

describe("WatchedList row UI", () => {
  let watchedResponse: WatchedEntry[];
  let addCalls: number[];
  let removeCalls: number[];

  beforeEach(() => {
    window.localStorage.clear();
    watchedResponse = [];
    addCalls = [];
    removeCalls = [];
    server.use(
      http.get(`${env.apiBaseUrl}/me/watched`, () => HttpResponse.json(watchedResponse)),
      http.put(`${env.apiBaseUrl}/me/shows/:id`, ({ params }) => {
        addCalls.push(Number(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete(`${env.apiBaseUrl}/me/shows/:id`, ({ params }) => {
        removeCalls.push(Number(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
  });

  it("renders poster, name, counts, last-watched, status pill", async () => {
    watchedResponse = [makeWatched(101, "The Wire")];

    const { container } = renderWithProviders(<WatchedList />);

    await waitFor(() => expect(screen.getByText("The Wire")).toBeInTheDocument());
    // Poster (decorative img with empty alt — query by tag).
    expect(container.querySelector("img")).toHaveAttribute("src", "https://example.com/poster.jpg");
    // Counts.
    expect(screen.getByText("8/10")).toBeInTheDocument();
    // Status pill — both the filter button and the row pill say "In progress".
    const matches = screen.getAllByText("In progress");
    expect(matches.some((el) => el.tagName === "SPAN")).toBe(true);
    // Last-watched relative date — locale-formatted, contains "Apr".
    expect(screen.getByText(/last watched .*apr/i)).toBeInTheDocument();
  });

  it("renders Finished pill when entry.status is finished", async () => {
    watchedResponse = [
      makeWatched(102, "Six Feet Under", {
        status: "finished",
        watched_episode_count: 12,
        aired_episode_count: 12,
      }),
    ];
    renderWithProviders(<WatchedList />);

    await waitFor(() => expect(screen.getByText("Six Feet Under")).toBeInTheDocument());
    // Two "Finished" elements exist: the filter button and the row pill.
    // The pill is a <span>; the filter is a <button>. Find the non-button one.
    const matches = screen.getAllByText("Finished");
    expect(matches.some((el) => el.tagName === "SPAN")).toBe(true);
  });

  it("renders Add button when not in My Shows; clicking calls add and shows badge", async () => {
    watchedResponse = [makeWatched(103, "Severance", { in_my_shows: false })];
    renderWithProviders(<WatchedList />);

    await waitFor(() => expect(screen.getByText("Severance")).toBeInTheDocument());
    expect(screen.queryByText(/^in my shows$/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add to my shows/i }));

    await waitFor(() => expect(addCalls).toEqual([103]));
    // Optimistic toggle: badge appears immediately, button switches to Remove.
    await waitFor(() => expect(screen.getByText(/^in my shows$/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /remove from my shows/i })).toBeInTheDocument();
  });

  it("renders Remove button when in My Shows; clicking calls remove and hides badge", async () => {
    watchedResponse = [makeWatched(104, "The Sopranos", { in_my_shows: true })];
    renderWithProviders(<WatchedList />);

    await waitFor(() => expect(screen.getByText("The Sopranos")).toBeInTheDocument());
    expect(screen.getByText(/^in my shows$/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /remove from my shows/i }));

    await waitFor(() => expect(removeCalls).toEqual([104]));
    await waitFor(() => expect(screen.queryByText(/^in my shows$/i)).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /add to my shows/i })).toBeInTheDocument();
  });

  it("Remove from history opens a confirm dialog and calls the API on confirm", async () => {
    let unmarkCalls: number[] = [];
    server.use(
      http.delete(`${env.apiBaseUrl}/me/shows/:id/watched`, ({ params }) => {
        unmarkCalls.push(Number(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    watchedResponse = [makeWatched(106, "Lost")];
    renderWithProviders(<WatchedList />);

    await waitFor(() => expect(screen.getByText("Lost")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /remove .* from history/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() => expect(unmarkCalls).toEqual([106]));
    // Optimistic remove: row vanishes from the list.
    await waitFor(() => expect(screen.queryByText("Lost")).not.toBeInTheDocument());
  });

  it("Remove from history cancel keeps the row and skips the API call", async () => {
    let unmarkCalls: number[] = [];
    server.use(
      http.delete(`${env.apiBaseUrl}/me/shows/:id/watched`, ({ params }) => {
        unmarkCalls.push(Number(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    );
    watchedResponse = [makeWatched(107, "Fringe")];
    renderWithProviders(<WatchedList />);

    await waitFor(() => expect(screen.getByText("Fringe")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /remove .* from history/i }));
    fireEvent.click(await screen.findByRole("button", { name: /cancel/i }));

    expect(unmarkCalls).toEqual([]);
    expect(screen.getByText("Fringe")).toBeInTheDocument();
  });

  it("row name links to the show detail page", async () => {
    watchedResponse = [makeWatched(105, "Deadwood")];
    renderWithProviders(<WatchedList />);

    await waitFor(() => expect(screen.getByText("Deadwood")).toBeInTheDocument());
    const link = screen.getByText("Deadwood").closest("a");
    expect(link).toHaveAttribute("href", "/shows/105");
  });
});
