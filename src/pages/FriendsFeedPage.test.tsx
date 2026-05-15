import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderWithProviders } from "@/test/renderWithProviders";
import { env } from "@/env";
import type { FeedItem } from "@/api/types";
import { FriendsFeedPage } from "./FriendsFeedPage";

function item(overrides: Partial<FeedItem> & { id: string; kind: FeedItem["kind"] }): FeedItem {
  return {
    actor: { id: "u-1", display_name: "Alice" },
    show: { id: 5, name: "Severance" },
    episode: null,
    season_number: null,
    rollup_count: null,
    stars: null,
    occurred_at: "2026-05-15T12:00:00Z",
    ...overrides,
  };
}

const server = setupServer(
  http.get(`${env.apiBaseUrl}/me`, () =>
    HttpResponse.json({
      id: "viewer",
      email: "v@x.com",
      display_name: "V",
      created_at: "2026-01-01T00:00:00Z",
      email_verified_at: "2026-01-01T00:00:00Z",
      csrf_token: "t",
    }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("FriendsFeedPage", () => {
  it("renders each kind with expected copy", async () => {
    const items: FeedItem[] = [
      item({ id: "a", kind: "added_show" }),
      item({
        id: "b",
        kind: "watched_episode",
        episode: { id: 99, name: "Pilot", season: 1, number: 1 },
      }),
      item({ id: "c", kind: "watched_episode_run", rollup_count: 4 }),
      item({ id: "d", kind: "watched_season", season_number: 2 }),
      item({ id: "e", kind: "watched_show" }),
      item({ id: "f", kind: "rated_show", stars: 4.5 }),
      item({
        id: "g",
        kind: "rated_episode",
        stars: 5,
        episode: { id: 100, name: "Finale", season: 1, number: 10 },
      }),
    ];
    server.use(
      http.get(`${env.apiBaseUrl}/me/feed`, () =>
        HttpResponse.json({ items, next_cursor: null }),
      ),
    );
    renderWithProviders(<FriendsFeedPage />);
    await waitFor(() => expect(screen.getAllByTestId("feed-row")).toHaveLength(7));

    const text = screen.getByRole("region", { name: /friends activity/i }).textContent ?? "";
    expect(text).toContain("Alice added Severance to My Shows.");
    expect(text).toContain("Alice watched S1E1 · Pilot of Severance.");
    expect(text).toContain("Alice watched 4 episodes of Severance.");
    expect(text).toContain("Alice finished Season 2 of Severance.");
    expect(text).toContain("Alice finished Severance.");
    expect(text).toContain("Alice rated Severance 4.5 stars.");
    expect(text).toContain("Alice rated S1E10 · Finale of Severance 5 stars.");
  });

  it("concatenates items across two pages via cursor", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me/feed`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        if (cursor === null) {
          return HttpResponse.json({
            items: [item({ id: "p1a", kind: "added_show" })],
            next_cursor: "C2",
          });
        }
        if (cursor === "C2") {
          return HttpResponse.json({
            items: [item({ id: "p2a", kind: "watched_show" })],
            next_cursor: null,
          });
        }
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
    );
    renderWithProviders(<FriendsFeedPage />);
    await waitFor(() => expect(screen.getAllByTestId("feed-row")).toHaveLength(1));

    const button = screen.getByRole("button", { name: /load more/i });
    fireEvent.click(button);

    await waitFor(() => expect(screen.getAllByTestId("feed-row")).toHaveLength(2));
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("shows empty state when there are no items", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me/feed`, () =>
        HttpResponse.json({ items: [], next_cursor: null }),
      ),
    );
    renderWithProviders(<FriendsFeedPage />);
    await waitFor(() => expect(screen.getByText(/no friend activity yet/i)).toBeInTheDocument());
  });
});
