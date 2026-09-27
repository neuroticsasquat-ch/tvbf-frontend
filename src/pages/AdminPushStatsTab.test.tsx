import { describe, expect, it, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AdminPage } from "./AdminPage";

function meAdmin() {
  return http.get(`${env.apiBaseUrl}/me`, () =>
    HttpResponse.json({
      id: "viewer",
      email: "admin@x.com",
      display_name: "Admin Alice",
      created_at: "2026-01-01T00:00:00Z",
      email_verified_at: "2026-01-01T00:00:00Z",
      csrf_token: "csrf",
      activity_feed_enabled: true,
      is_admin: true,
    }),
  );
}

/** The contract's shape: exactly 30 UTC days, oldest first, zero-filled. */
function days(active: Record<string, { sent: number; failed: number; retired: number }> = {}) {
  const end = Date.UTC(2026, 8, 27);
  return Array.from({ length: 30 }, (_, i) => {
    const day = new Date(end - (29 - i) * 86_400_000).toISOString().slice(0, 10);
    return { day, ...(active[day] ?? { sent: 0, failed: 0, retired: 0 }) };
  });
}

function statsHandler(body: Record<string, unknown>, status = 200) {
  return http.get(`${env.apiBaseUrl}/admin/push/stats`, () => HttpResponse.json(body, { status }));
}

function routed() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}

afterEach(() => server.resetHandlers());

describe("AdminPage Push notifications tab", () => {
  it("renders the two totals and one row per day from GET /admin/push/stats", async () => {
    server.use(
      meAdmin(),
      statsHandler({
        subscriptions: 7,
        users_subscribed: 4,
        by_day: days({
          "2026-09-27": { sent: 12, failed: 3, retired: 2 },
          "2026-08-29": { sent: 5, failed: 1, retired: 0 },
        }),
      }),
    );
    renderWithProviders(routed(), { route: "/admin?section=push" });

    const table = await screen.findByRole("table", { name: /deliveries by day/i });
    expect(screen.getByText("Subscriptions").nextSibling).toHaveTextContent("7");
    expect(screen.getByText("Subscribed users").nextSibling).toHaveTextContent("4");

    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(30);
    // Newest first: the day an admin opens the panel to check is on top.
    expect(rows[0]).toHaveTextContent(/2026-09-27\s*12\s*3\s*2/);
    expect(rows[29]).toHaveTextContent(/2026-08-29\s*5\s*1\s*0/);
  });

  it("shows the empty state when no deliveries fall in the window", async () => {
    server.use(meAdmin(), statsHandler({ subscriptions: 0, users_subscribed: 0, by_day: days() }));
    renderWithProviders(routed(), { route: "/admin?section=push" });

    await waitFor(() =>
      expect(screen.getByText(/no push deliveries in the last 30 days/i)).toBeInTheDocument(),
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("Subscriptions").nextSibling).toHaveTextContent("0");
  });

  it("renders the page's error state on a 403", async () => {
    server.use(meAdmin(), statsHandler({ detail: "admin_required" }, 403));
    renderWithProviders(routed(), { route: "/admin?section=push" });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/failed to load push stats/i);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("is reachable from the tab list and fetches only once selected", async () => {
    let hits = 0;
    server.use(
      meAdmin(),
      http.get(`${env.apiBaseUrl}/admin/users`, () => HttpResponse.json([])),
      http.get(`${env.apiBaseUrl}/admin/push/stats`, () => {
        hits += 1;
        return HttpResponse.json({ subscriptions: 1, users_subscribed: 1, by_day: days() });
      }),
    );
    renderWithProviders(routed(), { route: "/admin" });

    const tab = await screen.findByRole("tab", { name: "Push notifications" });
    expect(hits).toBe(0);
    await userEvent.click(tab);
    expect(tab).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(screen.getByText("Subscriptions")).toBeInTheDocument());
    expect(hits).toBe(1);
  });
});
