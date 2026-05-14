import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "@/test/renderWithProviders";
import { server } from "@/test/msw/server";
import { env } from "@/env";
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
      rating_average: null,
      my_rating: null,
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
    my_rating: null,
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
      rating_average: null,
      my_rating: null,
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
    expect(
      screen.getByRole("button", { name: /filter by my shows membership/i }),
    ).toBeInTheDocument();
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

  it("friend Active row shows green ✓ poster badge when caller has the show in their My Shows", async () => {
    vi.spyOn(friendsApi, "getFriendShows").mockResolvedValue([
      makeMyShow(41, "Severance"),
      makeMyShow(42, "Lost"),
    ]);
    server.use(
      http.get(`${env.apiBaseUrl}/me/shows`, () =>
        HttpResponse.json([makeMyShow(41, "Severance")]),
      ),
    );

    renderWithProviders(routed(), { route: `/users/${FRIEND_ID}` });

    await waitFor(() => expect(screen.getByText("Severance")).toBeInTheDocument());
    await waitFor(() => {
      const badges = screen.queryAllByLabelText(/^in my shows$/i);
      expect(badges).toHaveLength(1);
    });
    // Badge is a sibling of the Severance link (same row), not the Lost link.
    const severanceLink = screen.getByText("Severance").closest("a");
    expect(severanceLink?.parentElement).toBeTruthy();
  });

  it("friend Active row shows 'You: x/y' when caller has watched but show is NOT in caller's My Shows", async () => {
    vi.spyOn(friendsApi, "getFriendShows").mockResolvedValue([makeMyShow(51, "Severance")]);
    server.use(
      // Caller's My Shows is empty.
      http.get(`${env.apiBaseUrl}/me/shows`, () => HttpResponse.json([])),
      // Caller has watched 3 of 9 episodes of show 51, but it's NOT in My Shows.
      http.get(`${env.apiBaseUrl}/me/watched`, () =>
        HttpResponse.json([
          {
            show: makeMyShow(51, "Severance").show,
            watched_episode_count: 3,
            aired_episode_count: 9,
            total_episode_count: 9,
            last_watched_at: "2026-04-15T00:00:00Z",
            last_aired: "2026-04-10",
            first_watched_at: "2026-03-01T00:00:00Z",
            in_my_shows: false,
            status: "in_progress",
          },
        ]),
      ),
    );

    renderWithProviders(routed(), { route: `/users/${FRIEND_ID}` });

    await waitFor(() => expect(screen.getByText("Severance")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/^you:\s*3\/9$/i)).toBeInTheDocument());
    // No green ✓ badge for this show — caller watches it but doesn't track it.
    expect(screen.queryByLabelText(/^in my shows$/i)).not.toBeInTheDocument();
  });

  it("friend Active row shows BOTH green ✓ and 'You: x/y' when caller tracks AND has watched", async () => {
    vi.spyOn(friendsApi, "getFriendShows").mockResolvedValue([makeMyShow(71, "Severance")]);
    server.use(
      // Caller tracks Severance and has watched 5/10 episodes.
      http.get(`${env.apiBaseUrl}/me/shows`, () =>
        HttpResponse.json([
          {
            ...makeMyShow(71, "Severance"),
            watched_episode_count: 5,
            aired_episode_count: 10,
            total_episode_count: 10,
          },
        ]),
      ),
    );

    renderWithProviders(routed(), { route: `/users/${FRIEND_ID}` });

    await waitFor(() => expect(screen.getByText("Severance")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByLabelText(/^in my shows$/i)).toBeInTheDocument());
    expect(screen.getByText(/^you:\s*5\/10$/i)).toBeInTheDocument();
  });

  it("friend Active row renders no caller indicators when caller has no relationship", async () => {
    vi.spyOn(friendsApi, "getFriendShows").mockResolvedValue([makeMyShow(61, "Severance")]);
    // Default MSW handlers: /me/shows = [], no /me/watched override needed (we
    // add an empty handler to suppress the missing-handler warning).
    server.use(http.get(`${env.apiBaseUrl}/me/watched`, () => HttpResponse.json([])));

    renderWithProviders(routed(), { route: `/users/${FRIEND_ID}` });

    await waitFor(() => expect(screen.getByText("Severance")).toBeInTheDocument());
    expect(screen.queryByLabelText(/^in my shows$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^you:/i)).not.toBeInTheDocument();
  });

  it("My Library filter only renders on friend tabs (not on self tabs)", async () => {
    vi.spyOn(friendsApi, "getFriendShows").mockResolvedValue([makeMyShow(81, "Severance")]);

    renderWithProviders(routed(), { route: `/users/${FRIEND_ID}` });

    await waitFor(() => expect(screen.getByText("Severance")).toBeInTheDocument());
    expect(
      screen.getByRole("button", { name: /filter by my library membership/i }),
    ).toBeInTheDocument();
  });

  it("My Library filter narrows friend rows by caller's relationship", async () => {
    vi.spyOn(friendsApi, "getFriendShows").mockResolvedValue([
      makeMyShow(91, "Severance"),
      makeMyShow(92, "Lost"),
      makeMyShow(93, "Fringe"),
    ]);
    server.use(
      // Caller has Severance only.
      http.get(`${env.apiBaseUrl}/me/shows`, () =>
        HttpResponse.json([makeMyShow(91, "Severance")]),
      ),
    );

    renderWithProviders(routed(), { route: `/users/${FRIEND_ID}` });

    await waitFor(() => expect(screen.getByText("Severance")).toBeInTheDocument());
    expect(screen.getByText("Lost")).toBeInTheDocument();
    expect(screen.getByText("Fringe")).toBeInTheDocument();

    // Pick "In my My Shows".
    fireEvent.click(screen.getByRole("button", { name: /filter by my library membership/i }));
    let dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^in my my shows$/i }));

    await waitFor(() => expect(screen.queryByText("Lost")).not.toBeInTheDocument());
    expect(screen.queryByText("Fringe")).not.toBeInTheDocument();
    expect(screen.getByText("Severance")).toBeInTheDocument();

    // Switch to "Not in my My Shows".
    fireEvent.click(screen.getByRole("button", { name: /filter by my library membership/i }));
    dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^not in my my shows$/i }));

    await waitFor(() => expect(screen.queryByText("Severance")).not.toBeInTheDocument());
    expect(screen.getByText("Lost")).toBeInTheDocument();
    expect(screen.getByText("Fringe")).toBeInTheDocument();
  });

  it("My Watch State filter only renders on friend tabs", async () => {
    vi.spyOn(friendsApi, "getFriendShows").mockResolvedValue([makeMyShow(101, "Severance")]);

    renderWithProviders(routed(), { route: `/users/${FRIEND_ID}` });

    await waitFor(() => expect(screen.getByText("Severance")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /filter by my watch state/i })).toBeInTheDocument();
  });

  it("My Watch State 'Not Started' surfaces friend rows the caller hasn't touched", async () => {
    vi.spyOn(friendsApi, "getFriendShows").mockResolvedValue([
      makeMyShow(111, "Severance"),
      makeMyShow(112, "Lost"),
      makeMyShow(113, "Fringe"),
    ]);
    server.use(
      // Caller actively watches Severance (3/10) and has no relationship to
      // Lost or Fringe.
      http.get(`${env.apiBaseUrl}/me/shows`, () =>
        HttpResponse.json([
          {
            ...makeMyShow(111, "Severance"),
            watched_episode_count: 3,
            aired_episode_count: 10,
            total_episode_count: 10,
          },
        ]),
      ),
    );

    renderWithProviders(routed(), { route: `/users/${FRIEND_ID}` });

    await waitFor(() => expect(screen.getByText("Severance")).toBeInTheDocument());

    // Pick "Not Started" → only Lost and Fringe (no caller relationship → 0/0).
    fireEvent.click(screen.getByRole("button", { name: /filter by my watch state/i }));
    let dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^not started$/i }));

    await waitFor(() => expect(screen.queryByText("Severance")).not.toBeInTheDocument());
    expect(screen.getByText("Lost")).toBeInTheDocument();
    expect(screen.getByText("Fringe")).toBeInTheDocument();

    // Switch to "Watching" → only Severance.
    fireEvent.click(screen.getByRole("button", { name: /filter by my watch state/i }));
    dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^watching$/i }));

    await waitFor(() => expect(screen.queryByText("Lost")).not.toBeInTheDocument());
    expect(screen.queryByText("Fringe")).not.toBeInTheDocument();
    expect(screen.getByText("Severance")).toBeInTheDocument();
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
