import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { AuthProvider } from "@/components/AuthContext";
import { AppShell } from "@/components/AppShell";
import { HomePage } from "@/pages/HomePage";

function authedUser() {
  server.use(
    http.get(`${env.apiBaseUrl}/me`, () =>
      HttpResponse.json({
        id: "u1",
        email: "t@example.com",
        display_name: "T",
        created_at: "2026-01-01T00:00:00Z",
        csrf_token: "x",
      }),
    ),
  );
}

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "upcoming", element: <HomePage /> },
          { path: "all", element: <HomePage /> },
          { path: "watched", element: <HomePage /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("HomePage", () => {
  it("renders the Watch Next tab at /", async () => {
    authedUser();
    renderAt("/");
    await waitFor(() =>
      expect(screen.getByText(/You're caught up/i)).toBeInTheDocument(),
    );
    const watchNextLink = screen.getByRole("link", { name: /Watch Next/i });
    expect(watchNextLink).toHaveAttribute("aria-current", "page");
  });

  it("renders Upcoming at /upcoming", async () => {
    authedUser();
    renderAt("/upcoming");
    await waitFor(() =>
      expect(screen.getByText(/No upcoming episodes/i)).toBeInTheDocument(),
    );
  });

  it("renders All at /all", async () => {
    authedUser();
    renderAt("/all");
    await waitFor(() =>
      expect(screen.getByText(/Nothing here yet/i)).toBeInTheDocument(),
    );
  });

  it("renders Watched at /watched", async () => {
    authedUser();
    renderAt("/watched");
    await waitFor(() =>
      expect(screen.getByText(/finish a show/i)).toBeInTheDocument(),
    );
  });

  it("shows tab counts when watch-next and upcoming have entries", async () => {
    authedUser();
    const baseShow = {
      id: 100,
      name: "Test Show",
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
    };
    const baseEpisode = {
      id: 1,
      show_id: 100,
      season: 1,
      number: 1,
      name: "Pilot",
      airdate: "2026-01-01",
      airtime: null,
      runtime: null,
      summary: null,
      image_medium: null,
      image_original: null,
    };
    server.use(
      http.get(`${env.apiBaseUrl}/me/watch-next`, () =>
        HttpResponse.json([
          {
            show: baseShow,
            episode: baseEpisode,
            last_watched_at: null,
            last_aired: "2026-01-01",
            watched_episode_count: 0,
            aired_episode_count: 1,
            upcoming_episode_count: 0,
            added_at: "2026-01-01T00:00:00Z",
          },
        ]),
      ),
      http.get(`${env.apiBaseUrl}/me/upcoming`, () =>
        HttpResponse.json([
          {
            show: baseShow,
            episode: baseEpisode,
            watched_episode_count: 0,
            aired_episode_count: 1,
            upcoming_episode_count: 1,
            added_at: "2026-01-01T00:00:00Z",
          },
        ]),
      ),
    );
    renderAt("/");
    await waitFor(() => {
      // Tab nav links should now include the count.
      const links = screen.getAllByRole("link");
      const watchNextTab = links.find(
        (a) => a.getAttribute("href") === "/" && /Watch Next/.test(a.textContent ?? ""),
      );
      expect(watchNextTab?.textContent).toMatch(/\(\s*1\s*\)/);
    });
    const links = screen.getAllByRole("link");
    const upcomingTab = links.find(
      (a) => a.getAttribute("href") === "/upcoming",
    );
    expect(upcomingTab?.textContent).toMatch(/\(\s*1\s*\)/);
  });
});
