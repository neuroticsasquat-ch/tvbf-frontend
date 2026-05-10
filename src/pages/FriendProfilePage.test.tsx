import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
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
    last_aired: "2026-04-10",
    first_watched_at: "2026-03-01T00:00:00Z",
    in_my_shows: false,
    status: "finished",
  };
}

describe("FriendProfilePage", () => {
  beforeEach(() => {
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

  it("Active tab fetches getFriendShows and renders rows read-only", async () => {
    const get = vi
      .spyOn(friendsApi, "getFriendShows")
      .mockResolvedValue([makeMyShow(11, "Severance")]);

    renderWithProviders(routed(), { route: `/users/${FRIEND_ID}` });

    await waitFor(() => expect(get).toHaveBeenCalledWith(FRIEND_ID, expect.any(Object)));
    await waitFor(() => expect(screen.getByText("Severance")).toBeInTheDocument());
    // Read-only: no Add/Remove buttons.
    expect(screen.queryByRole("button", { name: /add/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
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
    // Friend appears in the connection list but the friend endpoint 404s
    // (e.g., they unblocked us between renders, or stale cache).
    vi.spyOn(friendsApi, "getFriendShows").mockRejectedValue(new ApiError(404, "not_found", null));
    renderWithProviders(routed(), { route: `/users/${FRIEND_ID}` });

    await waitFor(() => expect(screen.getByText(/user not found/i)).toBeInTheDocument());
  });

  it("Watched tab status filter changes the query param", async () => {
    vi.spyOn(friendsApi, "getFriendShows").mockResolvedValue([]);
    const watched = vi.spyOn(friendsApi, "getFriendWatched").mockResolvedValue([]);

    renderWithProviders(routed(), { route: `/users/${FRIEND_ID}` });
    fireEvent.click(await screen.findByRole("tab", { name: /watched/i }));
    await waitFor(() => expect(watched).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /^finished$/i }));
    await waitFor(() => {
      const lastCall = watched.mock.calls.at(-1);
      expect(lastCall?.[1]).toMatchObject({ status: "finished" });
    });
  });
});
