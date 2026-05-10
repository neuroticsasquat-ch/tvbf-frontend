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
    last_aired: "2026-04-10",
    first_watched_at: "2026-03-01T00:00:00Z",
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
    // In-progress rows show "Progress: watched/aired" (no separate status pill).
    expect(screen.getByText(/^progress:\s*8\/10$/i)).toBeInTheDocument();
    // The "In progress" filter button still exists in the toolbar but the row
    // itself no longer renders that label as a pill.
    expect(
      screen.queryByText(
        (_text, el) => el?.tagName === "SPAN" && el?.textContent === "In progress",
      ),
    ).not.toBeInTheDocument();
    // Last-watched relative date — locale-formatted, contains "Apr".
    expect(screen.getByText(/last watched:.*apr/i)).toBeInTheDocument();
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
    // Finished rows omit the watched/aired count.
    expect(screen.queryByText(/^progress:/i)).not.toBeInTheDocument();
    expect(screen.queryByText("12/12")).not.toBeInTheDocument();
  });

  it("renders Add button when not in My Shows; clicking flips it to Remove", async () => {
    watchedResponse = [makeWatched(103, "Severance", { in_my_shows: false })];
    renderWithProviders(<WatchedList />);

    await waitFor(() => expect(screen.getByText("Severance")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /add to my shows/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove from my shows/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add to my shows/i }));

    await waitFor(() => expect(addCalls).toEqual([103]));
    // Optimistic toggle: the button is the membership indicator now.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /remove from my shows/i })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /add to my shows/i })).not.toBeInTheDocument();
  });

  it("renders Remove button when in My Shows; clicking flips it to Add", async () => {
    watchedResponse = [makeWatched(104, "The Sopranos", { in_my_shows: true })];
    renderWithProviders(<WatchedList />);

    await waitFor(() => expect(screen.getByText("The Sopranos")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /remove from my shows/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /remove from my shows/i }));

    await waitFor(() => expect(removeCalls).toEqual([104]));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /add to my shows/i })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /remove from my shows/i })).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: /remove .* watch history/i }));
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

    fireEvent.click(screen.getByRole("button", { name: /remove .* watch history/i }));
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
