import { describe, expect, it, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "@/test/renderWithProviders";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { EpisodeFriendsWatched, ShowFriendActivityStrip } from "./FriendActivity";

const ME_USER = {
  id: "me-1",
  email: "me@example.com",
  display_name: "Me",
  created_at: "2026-01-01T00:00:00Z",
  csrf_token: "x",
};

beforeEach(() => {
  server.use(http.get(`${env.apiBaseUrl}/me`, () => HttpResponse.json(ME_USER)));
});

describe("ShowFriendActivityStrip", () => {
  it("renders both sections when API returns names", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/shows/1/friends`, () =>
        HttpResponse.json({
          in_my_shows: [
            { id: "u-1", display_name: "Alice" },
            { id: "u-2", display_name: "Bob" },
          ],
          watched: [{ id: "u-3", display_name: "Carol" }],
        }),
      ),
    );

    renderWithProviders(<ShowFriendActivityStrip showId={1} />);

    await waitFor(() => expect(screen.getByText(/in my shows:/i)).toBeInTheDocument());
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText(/watched:/i)).toBeInTheDocument();
    expect(screen.getByText("Carol")).toBeInTheDocument();

    expect(screen.getByText("Alice").closest("a")).toHaveAttribute("href", "/users/u-1");
  });

  it("hides empty sections", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/shows/2/friends`, () =>
        HttpResponse.json({
          in_my_shows: [{ id: "u-9", display_name: "Dee" }],
          watched: [],
        }),
      ),
    );

    renderWithProviders(<ShowFriendActivityStrip showId={2} />);

    await waitFor(() => expect(screen.getByText(/in my shows:/i)).toBeInTheDocument());
    expect(screen.queryByText(/^watched:/i)).not.toBeInTheDocument();
  });

  it("renders nothing when both sections are empty", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/shows/3/friends`, () =>
        HttpResponse.json({ in_my_shows: [], watched: [] }),
      ),
    );

    const { container } = renderWithProviders(<ShowFriendActivityStrip showId={3} />);

    // Wait long enough for the query to settle.
    await waitFor(() =>
      expect(
        container.querySelector('[aria-label="Friends engaged with this show"]'),
      ).not.toBeInTheDocument(),
    );
  });
});

describe("EpisodeFriendsWatched", () => {
  it("renders the watched-by list with links to friend profiles", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/episodes/42/friends/watched`, () =>
        HttpResponse.json([
          { id: "u-1", display_name: "Alice" },
          { id: "u-2", display_name: "Bob" },
        ]),
      ),
    );

    renderWithProviders(<EpisodeFriendsWatched episodeId={42} />);

    await waitFor(() => expect(screen.getByText(/watched by:/i)).toBeInTheDocument());
    expect(screen.getByText("Alice").closest("a")).toHaveAttribute("href", "/users/u-1");
    expect(screen.getByText("Bob").closest("a")).toHaveAttribute("href", "/users/u-2");
  });

  it("renders nothing when no friends watched", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/episodes/43/friends/watched`, () => HttpResponse.json([])),
    );

    const { container } = renderWithProviders(<EpisodeFriendsWatched episodeId={43} />);

    await waitFor(() =>
      expect(
        container.querySelector('[aria-label="Friends who watched this episode"]'),
      ).not.toBeInTheDocument(),
    );
  });
});
