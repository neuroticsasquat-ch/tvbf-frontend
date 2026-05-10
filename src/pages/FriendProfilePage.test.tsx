import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { renderWithProviders } from "@/test/renderWithProviders";
import { FriendProfilePage } from "./FriendProfilePage";
import * as connectionsApi from "@/api/connections";
import * as friendsApi from "@/api/friends";
import { ApiError } from "@/api/client";
import type { MyShowEntry, WatchedEntry } from "@/api/types";

const FRIEND_ID = "00000000-0000-0000-0000-0000000000aa";

function routed() {
  return (
    <Routes>
      <Route path="/users/:userId" element={<FriendProfilePage />} />
    </Routes>
  );
}

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
    first_watched_at: null,
    next_episode: null,
    added_at: "2026-04-01T00:00:00Z",
  };
}

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
    last_aired: "2026-04-10",
    first_watched_at: "2026-03-01T00:00:00Z",
    in_my_shows: false,
    status: "finished",
    ...overrides,
  };
}

describe("FriendProfilePage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([
      { user: { id: FRIEND_ID, display_name: "Friendly Person" }, since: "2026-04-01T00:00:00Z" },
    ]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders friend display name and tab list when connected", async () => {
    vi.spyOn(friendsApi, "getFriendShows").mockResolvedValue([]);

    renderWithProviders(routed(), { route: `/users/${FRIEND_ID}` });

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /friendly person/i, level: 1 }),
      ).toBeInTheDocument(),
    );
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: /active/i })).toHaveAttribute("aria-selected", "true");
  });

  it("Active tab fetches getFriendShows and renders rows with caller-relative action button", async () => {
    const get = vi
      .spyOn(friendsApi, "getFriendShows")
      .mockResolvedValue([makeMyShow(11, "Severance")]);

    renderWithProviders(routed(), { route: `/users/${FRIEND_ID}` });

    await waitFor(() => expect(get).toHaveBeenCalledWith(FRIEND_ID, expect.any(Object)));
    await waitFor(() => expect(screen.getByText("Severance")).toBeInTheDocument());
    // Caller's My Shows is empty (default MSW handler) → Add button shown.
    expect(screen.getByRole("button", { name: /add to my shows/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove from my shows/i })).not.toBeInTheDocument();
  });

  it("Active tab renders the shared toolbar (sort + filters + view toggle)", async () => {
    vi.spyOn(friendsApi, "getFriendShows").mockResolvedValue([makeMyShow(12, "Lost")]);

    renderWithProviders(routed(), { route: `/users/${FRIEND_ID}` });

    await waitFor(() => expect(screen.getByText("Lost")).toBeInTheDocument());
    // Sort trigger.
    expect(screen.getByRole("button", { name: /sort my shows/i })).toBeInTheDocument();
    // Filter triggers (each FilterSheet exposes its trigger via aria-label).
    expect(screen.getByRole("button", { name: /filter by watch state/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /filter by show status/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /filter by my shows membership/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /filter by genre/i })).toBeInTheDocument();
    // View toggle.
    expect(screen.getByRole("button", { name: /list view/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /grid view/i })).toBeInTheDocument();
  });

  it("Watched tab is lazy (not fetched until clicked)", async () => {
    vi.spyOn(friendsApi, "getFriendShows").mockResolvedValue([]);
    const watched = vi.spyOn(friendsApi, "getFriendWatched").mockResolvedValue([]);

    renderWithProviders(routed(), { route: `/users/${FRIEND_ID}` });

    await waitFor(() => expect(screen.getByRole("tab", { name: /active/i })).toBeInTheDocument());
    expect(watched).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: /watched/i }));
    await waitFor(() => expect(watched).toHaveBeenCalledWith(FRIEND_ID, expect.any(Object)));
  });

  it("Watched tab renders rows", async () => {
    vi.spyOn(friendsApi, "getFriendShows").mockResolvedValue([]);
    vi.spyOn(friendsApi, "getFriendWatched").mockResolvedValue([makeWatched(22, "The Wire")]);

    renderWithProviders(routed(), { route: `/users/${FRIEND_ID}` });

    fireEvent.click(await screen.findByRole("tab", { name: /watched/i }));
    await waitFor(() => expect(screen.getByText("The Wire")).toBeInTheDocument());
  });

  it("renders 'user not found' when not in caller's connections", async () => {
    vi.spyOn(connectionsApi, "listConnections").mockResolvedValue([]);
    renderWithProviders(routed(), { route: `/users/${FRIEND_ID}` });

    await waitFor(() => expect(screen.getByText(/user not found/i)).toBeInTheDocument());
  });

  it("renders 'user not found' when friend API returns 404", async () => {
    vi.spyOn(friendsApi, "getFriendShows").mockRejectedValue(new ApiError(404, "not_found", null));
    renderWithProviders(routed(), { route: `/users/${FRIEND_ID}` });

    await waitFor(() => expect(screen.getByText(/user not found/i)).toBeInTheDocument());
  });

  it("Watched tab Finished filter narrows rows client-side without refetching", async () => {
    vi.spyOn(friendsApi, "getFriendShows").mockResolvedValue([]);
    const watched = vi.spyOn(friendsApi, "getFriendWatched").mockResolvedValue([
      makeWatched(31, "Six Feet Under", {
        status: "finished",
        watched_episode_count: 12,
        aired_episode_count: 12,
        total_episode_count: 12,
      }),
      makeWatched(32, "Severance", {
        status: "in_progress",
        watched_episode_count: 4,
        aired_episode_count: 9,
        total_episode_count: 9,
      }),
    ]);

    renderWithProviders(routed(), { route: `/users/${FRIEND_ID}` });
    fireEvent.click(await screen.findByRole("tab", { name: /watched/i }));

    await waitFor(() => expect(screen.getByText("Six Feet Under")).toBeInTheDocument());
    expect(screen.getByText("Severance")).toBeInTheDocument();
    const callsAfterLoad = watched.mock.calls.length;

    // Open the WatchState FilterSheet then pick "Finished".
    fireEvent.click(screen.getByRole("button", { name: /filter by watch state/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^finished$/i }));

    await waitFor(() => expect(screen.queryByText("Severance")).not.toBeInTheDocument());
    expect(screen.getByText("Six Feet Under")).toBeInTheDocument();
    // No new server fetch — filtering happens client-side.
    expect(watched.mock.calls.length).toBe(callsAfterLoad);
  });
});
