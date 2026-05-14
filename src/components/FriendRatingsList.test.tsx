import { describe, expect, it, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "@/test/renderWithProviders";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { FriendRatingsList } from "./FriendRatingsList";

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

describe("FriendRatingsList (show)", () => {
  it("renders aggregate and items with profile links", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/shows/1/friends/ratings`, () =>
        HttpResponse.json({
          avg: 4.25,
          count: 2,
          items: [
            {
              user_id: "u-1",
              display_name: "Alice",
              stars: 4.5,
              rated_at: "2026-05-01T00:00:00Z",
            },
            {
              user_id: "u-2",
              display_name: "Bob",
              stars: 4.0,
              rated_at: "2026-04-20T00:00:00Z",
            },
          ],
        }),
      ),
    );

    renderWithProviders(<FriendRatingsList showId={1} />);

    await waitFor(() => expect(screen.getByText(/2 friends/i)).toBeInTheDocument());
    expect(screen.getByText("Alice").closest("a")).toHaveAttribute("href", "/users/u-1");
    expect(screen.getByText("Bob").closest("a")).toHaveAttribute("href", "/users/u-2");
  });

  it("uses singular friend when count is 1", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/shows/2/friends/ratings`, () =>
        HttpResponse.json({
          avg: 3.0,
          count: 1,
          items: [
            {
              user_id: "u-3",
              display_name: "Carol",
              stars: 3.0,
              rated_at: "2026-05-10T00:00:00Z",
            },
          ],
        }),
      ),
    );

    renderWithProviders(<FriendRatingsList showId={2} />);

    await waitFor(() => expect(screen.getByText(/1 friend/i)).toBeInTheDocument());
    expect(screen.queryByText(/1 friends/i)).not.toBeInTheDocument();
  });

  it("renders nothing when count is 0", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/shows/3/friends/ratings`, () =>
        HttpResponse.json({ avg: null, count: 0, items: [] }),
      ),
    );

    const { container } = renderWithProviders(<FriendRatingsList showId={3} />);

    await waitFor(() =>
      expect(container.querySelector('[aria-label="Friend ratings"]')).not.toBeInTheDocument(),
    );
  });
});

describe("FriendRatingsList (episode)", () => {
  it("fetches the episode endpoint when episodeId is provided", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/episodes/42/friends/ratings`, () =>
        HttpResponse.json({
          avg: 5.0,
          count: 1,
          items: [
            {
              user_id: "u-9",
              display_name: "Dee",
              stars: 5.0,
              rated_at: "2026-05-12T00:00:00Z",
            },
          ],
        }),
      ),
    );

    renderWithProviders(<FriendRatingsList episodeId={42} />);

    await waitFor(() => expect(screen.getByText("Dee")).toBeInTheDocument());
    expect(screen.getByText("Dee").closest("a")).toHaveAttribute("href", "/users/u-9");
  });
});
