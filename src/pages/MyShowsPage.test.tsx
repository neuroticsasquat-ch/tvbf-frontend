import { Toaster } from "sonner";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { AuthProvider } from "@/components/AuthContext";
import { createTestQueryClient, renderWithProviders } from "@/test/renderWithProviders";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { MyShowsPage } from "./MyShowsPage";
import type { MyShowEntry, WatchedEntry } from "@/api/types";

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
    my_rating: null,
  };
}

describe("MyShowsPage", () => {
  let watchedCalls: URL[];
  let watchedResponse: WatchedEntry[];

  beforeEach(() => {
    window.localStorage.clear();
    watchedCalls = [];
    watchedResponse = [];
    server.use(
      http.get(`${env.apiBaseUrl}/me/shows`, () => HttpResponse.json([makeMyShow(1, "Severance")])),
      http.get(`${env.apiBaseUrl}/me/watched`, ({ request }) => {
        watchedCalls.push(new URL(request.url));
        return HttpResponse.json(watchedResponse);
      }),
    );
  });

  it("renders Active and Watched sub-tabs with Active selected by default", async () => {
    renderWithProviders(<MyShowsPage />);

    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(2));
    expect(screen.getByRole("tab", { name: /active/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /watched/i })).toHaveAttribute("aria-selected", "false");
  });

  it("does not fetch the watched list until the Watched tab is clicked", async () => {
    renderWithProviders(<MyShowsPage />);
    await waitFor(() => expect(screen.getByRole("tab", { name: /active/i })).toBeInTheDocument());
    expect(watchedCalls).toHaveLength(0);

    fireEvent.click(screen.getByRole("tab", { name: /watched/i }));
    await waitFor(() => expect(watchedCalls.length).toBeGreaterThan(0));
  });

  it("Watched tab fetches /me/watched and renders rows", async () => {
    watchedResponse = [makeWatched(99, "The Wire")];

    renderWithProviders(<MyShowsPage />);
    fireEvent.click(await screen.findByRole("tab", { name: /watched/i }));

    await waitFor(() => expect(screen.getByText("The Wire")).toBeInTheDocument());
  });

  it("Watched tab fetches /me/watched without status query param", async () => {
    // Sorting and filtering moved client-side (NEU-123); the URL no longer
    // carries a `status` param.
    renderWithProviders(<MyShowsPage />);
    fireEvent.click(await screen.findByRole("tab", { name: /watched/i }));
    await waitFor(() => expect(watchedCalls.length).toBeGreaterThan(0));

    const last = watchedCalls.at(-1);
    expect(last?.searchParams.get("status")).toBeNull();
    expect(last?.searchParams.get("sort")).toBeNull();
  });

  it("renders the Watched empty-state when no rows", async () => {
    renderWithProviders(<MyShowsPage />);
    fireEvent.click(await screen.findByRole("tab", { name: /watched/i }));

    await waitFor(() => expect(screen.getByText(/no watch history/i)).toBeInTheDocument());
  });

  it("Active tab still renders existing My Shows list", async () => {
    renderWithProviders(<MyShowsPage />);
    await waitFor(() => expect(screen.getByText("Severance")).toBeInTheDocument());
  });

  describe("invited-user toast", () => {
    beforeEach(() => {
      vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
    });

    function renderWithToaster(
      ui: React.ReactElement,
      route = "/",
      state?: Record<string, unknown>,
    ) {
      const qc = createTestQueryClient();
      return render(
        <QueryClientProvider client={qc}>
          <AuthProvider>
            <MemoryRouter initialEntries={[{ pathname: route, state }]}>{ui}</MemoryRouter>
            <Toaster />
          </AuthProvider>
        </QueryClientProvider>,
      );
    }

    it("shows a toast with the first connection's handle when state.invited is true", async () => {
      server.use(
        http.get(`${env.apiBaseUrl}/me/shows`, () =>
          HttpResponse.json([makeMyShow(1, "Severance")]),
        ),
        http.get(`${env.apiBaseUrl}/me/connections`, () =>
          HttpResponse.json([
            {
              user: { id: "u2", display_name: "Inviter", handle: "inviter_user" },
              since: "2026-08-22T00:00:00Z",
            },
          ]),
        ),
      );
      renderWithToaster(<MyShowsPage />, "/my-shows", { invited: true });

      await waitFor(() => {
        expect(screen.getByText("You're now connected with @inviter_user.")).toBeInTheDocument();
      });
    });

    it("suppresses the toast when connections are empty", async () => {
      server.use(
        http.get(`${env.apiBaseUrl}/me/shows`, () =>
          HttpResponse.json([makeMyShow(1, "Severance")]),
        ),
        http.get(`${env.apiBaseUrl}/me/connections`, () => HttpResponse.json([])),
      );
      renderWithToaster(<MyShowsPage />, "/my-shows", { invited: true });

      // Wait for connections to resolve — the toast should not appear.
      await waitFor(() => expect(screen.queryByText(/now connected/i)).not.toBeInTheDocument());
    });

    it("suppresses the toast when no location state is present", async () => {
      renderWithToaster(<MyShowsPage />, "/my-shows");
      await waitFor(() => {
        expect(screen.queryByText(/now connected/i)).not.toBeInTheDocument();
      });
    });
  });
});
