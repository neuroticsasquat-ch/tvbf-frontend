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
              handle: "alice",
              stars: 4.5,
              rated_at: "2026-05-01T00:00:00Z",
            },
            {
              user_id: "u-2",
              display_name: "Bob",
              handle: "bob",
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

  it("renders the friends' average as an aggregate and each row as its owner's", async () => {
    // NEU-1182 AC 6. The average was drawn in amber — the colour this design
    // reserves for a named person — on the same page as the TMDB average.
    server.use(
      http.get(`${env.apiBaseUrl}/shows/4/friends/ratings`, () =>
        HttpResponse.json({
          avg: 4.25,
          count: 2,
          items: [
            {
              user_id: "u-1",
              display_name: "Alice",
              handle: "alice",
              stars: 4.5,
              rated_at: "2026-05-01T00:00:00Z",
            },
            {
              user_id: "u-2",
              display_name: "Bob",
              handle: "bob",
              stars: 4.0,
              rated_at: "2026-04-20T00:00:00Z",
            },
          ],
        }),
      ),
    );

    renderWithProviders(<FriendRatingsList showId={4} />);

    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "Friends average: 4.3 out of 5" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("img", { name: "Alice's rating: 4.5 out of 5" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Bob's rating: 4.0 out of 5" })).toBeInTheDocument();
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

describe("FriendRatingsList — identity", () => {
  it("draws each rater through UserIdentity", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/shows/1/friends/ratings`, () =>
        HttpResponse.json({
          avg: 4.5,
          count: 1,
          items: [
            {
              user_id: "u-1",
              display_name: "Alice",
              handle: "alice",
              stars: 4.5,
              rated_at: "2026-05-01T00:00:00Z",
            },
          ],
        }),
      ),
    );

    renderWithProviders(<FriendRatingsList showId={1} />);

    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    const identity = document.querySelector("[data-user-identity]");
    expect(identity).not.toBeNull();
    expect(identity).toHaveTextContent("@alice");
  });

  it("keeps the possessive rating label on the display name alone", async () => {
    // The deliberate exception (D8): `@alice's rating` reads badly and
    // disambiguates nothing — you are already inside one named person's
    // context.
    server.use(
      http.get(`${env.apiBaseUrl}/shows/1/friends/ratings`, () =>
        HttpResponse.json({
          avg: 4.5,
          count: 1,
          items: [
            {
              user_id: "u-1",
              display_name: "Alice",
              handle: "alice",
              stars: 4.5,
              rated_at: "2026-05-01T00:00:00Z",
            },
          ],
        }),
      ),
    );

    renderWithProviders(<FriendRatingsList showId={1} />);

    expect(
      await screen.findByRole("img", { name: "Alice's rating: 4.5 out of 5" }),
    ).toBeInTheDocument();
  });
});
