import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach } from "vitest";
import { screen, waitFor, act, fireEvent } from "@testing-library/react";
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
      activity_feed_enabled: true,
    }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// IntersectionObserver stub: capture the most recently constructed instance so
// tests can trigger intersection callbacks manually.
type IOCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
let latestIOCallback: IOCallback | null = null;

class IOStub {
  callback: IOCallback;
  constructor(cb: IOCallback) {
    this.callback = cb;
    latestIOCallback = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = "";
  thresholds: number[] = [];
}

beforeEach(() => {
  latestIOCallback = null;
  vi.stubGlobal("IntersectionObserver", IOStub);
});

describe("FriendsFeedPage", () => {
  it("renders each kind with the expected primary copy", async () => {
    const items: FeedItem[] = [
      item({ id: "a", kind: "added_show" }),
      item({
        id: "b",
        kind: "watched_episode",
        episode: { id: 99, name: "Pilot", season: 2, number: 5 },
      }),
      item({ id: "c", kind: "watched_episode_run", rollup_count: 5 }),
      item({ id: "d", kind: "watched_season", season_number: 2 }),
      item({ id: "e", kind: "watched_show" }),
      item({ id: "f", kind: "rated_show", stars: 4.5 }),
      item({
        id: "g",
        kind: "rated_episode",
        stars: 3,
        episode: { id: 100, name: null, season: 2, number: 5 },
      }),
    ];
    server.use(
      http.get(`${env.apiBaseUrl}/me/feed`, () =>
        HttpResponse.json({ items, next_cursor: null }),
      ),
    );
    renderWithProviders(<FriendsFeedPage />);
    await waitFor(() => expect(screen.getAllByTestId("feed-row")).toHaveLength(7));

    const text = screen.getByRole("region", { name: /^friends$/i }).textContent ?? "";
    expect(text).toContain("Alice added Severance to My Shows.");
    expect(text).toContain("Alice watched Severance S2E5.");
    expect(text).toContain("Alice watched 5 episodes of Severance.");
    expect(text).toContain("Alice finished season 2 of Severance.");
    expect(text).toContain("Alice finished Severance.");
    // rated_show / rated_episode use StarRatingDisplay; check it rendered.
    expect(screen.getByLabelText("4.5 out of 5")).toBeInTheDocument();
    expect(screen.getByLabelText("3.0 out of 5")).toBeInTheDocument();
  });

  it("fetches the next page when the sentinel intersects", async () => {
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
    expect(latestIOCallback).toBeTruthy();

    act(() => {
      latestIOCallback?.([{ isIntersecting: true }]);
    });

    await waitFor(() => expect(screen.getAllByTestId("feed-row")).toHaveLength(2));
  });

  it("renders an empty state when the first page is empty", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me/feed`, () =>
        HttpResponse.json({ items: [], next_cursor: null }),
      ),
    );
    renderWithProviders(<FriendsFeedPage />);
    await waitFor(() =>
      expect(screen.getByText(/no activity from your friends yet/i)).toBeInTheDocument(),
    );
  });

  it("exposes Activity and Connections section tabs with Activity active by default", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me/feed`, () =>
        HttpResponse.json({ items: [], next_cursor: null }),
      ),
    );
    renderWithProviders(<FriendsFeedPage />);
    const tablist = await screen.findByRole("tablist", { name: /friends sections/i });
    const tabs = screen.getAllByRole("tab", { current: false }).concat(
      screen.getAllByRole("tab", { selected: true }),
    );
    expect(tablist).toBeInTheDocument();
    expect(tabs.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("tab", { name: /^activity$/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: /^connections$/i })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("badges the outer Connections tab with the incoming-request count", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me/feed`, () =>
        HttpResponse.json({ items: [], next_cursor: null }),
      ),
      http.get(`${env.apiBaseUrl}/me/connection-requests`, () =>
        HttpResponse.json({
          incoming: [
            {
              id: "r1",
              requester: { id: "u1", display_name: "U1" },
              addressee: { id: "me", display_name: "Me" },
              state: "pending",
              created_at: "2026-05-15T10:00:00Z",
              responded_at: null,
            },
            {
              id: "r2",
              requester: { id: "u2", display_name: "U2" },
              addressee: { id: "me", display_name: "Me" },
              state: "pending",
              created_at: "2026-05-15T10:00:00Z",
              responded_at: null,
            },
            {
              id: "r3",
              requester: { id: "u3", display_name: "U3" },
              addressee: { id: "me", display_name: "Me" },
              state: "pending",
              created_at: "2026-05-15T10:00:00Z",
              responded_at: null,
            },
          ],
          outgoing: [],
        }),
      ),
    );
    renderWithProviders(<FriendsFeedPage />);
    await waitFor(() =>
      expect(
        document.getElementById("friends-tab-connections")?.textContent,
      ).toMatch(/Connections \(3\)/),
    );
  });

  it("switches to the Connections section when its tab is clicked", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me/feed`, () =>
        HttpResponse.json({ items: [], next_cursor: null }),
      ),
      http.get(`${env.apiBaseUrl}/me/connections`, () => HttpResponse.json([])),
    );
    renderWithProviders(<FriendsFeedPage />);
    const outerConnectionsTab = await screen.findByRole("tab", { name: /^connections$/i });
    fireEvent.click(outerConnectionsTab);
    // The nested Connections sub-tablist appears.
    await waitFor(() =>
      expect(
        screen.getByRole("tablist", { name: /connections sections/i }),
      ).toBeInTheDocument(),
    );
    expect(document.getElementById("friends-tab-connections")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
