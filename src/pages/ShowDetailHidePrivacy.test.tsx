import { describe, it, expect, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ShowDetailPage } from "./ShowDetailPage";

function authedMe() {
  return http.get(`${env.apiBaseUrl}/me`, () =>
    HttpResponse.json({
      id: "u1",
      email: "a@x.com",
      display_name: "Alice",
      created_at: new Date().toISOString(),
      email_verified_at: null,
      csrf_token: "csrf",
      activity_feed_enabled: true,
    }),
  );
}

function myShowsHandler(rows: unknown[]) {
  return http.get(`${env.apiBaseUrl}/me/shows`, () => HttpResponse.json(rows));
}

function routed() {
  return (
    <Routes>
      <Route path="/shows/:id" element={<ShowDetailPage />} />
    </Routes>
  );
}

function entry(showId: number, overrides: Partial<{ hide_from_activity: boolean }> = {}) {
  return {
    show: {
      id: showId,
      name: "Fixture Show",
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
    added_at: new Date().toISOString(),
    my_rating: null,
    hide_from_activity: false,
    ...overrides,
  };
}

afterEach(() => server.resetHandlers());

describe("ShowDetailPage hide-from-activity toggle", () => {
  it("is hidden when the show is not in My Shows", async () => {
    server.use(authedMe(), myShowsHandler([]));
    renderWithProviders(routed(), { route: "/shows/100" });
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Fixture Show" })).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("switch", { name: /hide this show from my activity feed/i }),
    ).not.toBeInTheDocument();
  });

  it("reflects hide_from_activity and calls PATCH when toggled", async () => {
    const calls: Array<{ hide_from_activity: boolean }> = [];
    server.use(
      authedMe(),
      myShowsHandler([entry(100, { hide_from_activity: true })]),
      http.patch(
        `${env.apiBaseUrl}/me/shows/:id/hide-from-activity`,
        async ({ request }) => {
          const body = (await request.json()) as { hide_from_activity: boolean };
          calls.push(body);
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );
    renderWithProviders(routed(), { route: "/shows/100" });

    const toggle = await screen.findByRole("switch", {
      name: /hide this show from my activity feed/i,
    });
    expect(toggle).toBeChecked();

    await userEvent.click(toggle);
    await waitFor(() => expect(calls).toEqual([{ hide_from_activity: false }]));
  });
});
