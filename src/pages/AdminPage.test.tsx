import { describe, expect, it, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AdminPage } from "./AdminPage";

function meHandler(opts: { id?: string; is_admin: boolean }) {
  return http.get(`${env.apiBaseUrl}/me`, () =>
    HttpResponse.json({
      id: opts.id ?? "viewer",
      email: "a@x.com",
      display_name: "Admin Alice",
      created_at: "2026-01-01T00:00:00Z",
      email_verified_at: "2026-01-01T00:00:00Z",
      csrf_token: "csrf",
      activity_feed_enabled: true,
      is_admin: opts.is_admin,
    }),
  );
}

function adminUsersHandler(rows: unknown[]) {
  return http.get(`${env.apiBaseUrl}/admin/users`, () => HttpResponse.json(rows));
}

function userRow(overrides: { id: string; is_admin?: boolean; display_name?: string }) {
  return {
    id: overrides.id,
    email: `${overrides.id}@example.com`,
    display_name: overrides.display_name ?? overrides.id,
    created_at: "2026-01-01T00:00:00Z",
    is_admin: overrides.is_admin ?? false,
  };
}

function routed() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/" element={<p>home</p>} />
    </Routes>
  );
}

afterEach(() => server.resetHandlers());

describe("AdminPage", () => {
  it("redirects non-admins to /", async () => {
    server.use(meHandler({ is_admin: false }));
    renderWithProviders(routed(), { route: "/admin" });
    await waitFor(() => expect(screen.getByText("home")).toBeInTheDocument());
  });

  it("renders the Users tab with rows from GET /admin/users for an admin", async () => {
    server.use(
      meHandler({ id: "viewer", is_admin: true }),
      adminUsersHandler([
        userRow({ id: "viewer", is_admin: true, display_name: "Admin Alice" }),
        userRow({ id: "u2", is_admin: false, display_name: "Bob" }),
      ]),
    );
    renderWithProviders(routed(), { route: "/admin" });
    await waitFor(() => expect(screen.getByText("Bob")).toBeInTheDocument());
    expect(screen.getByText("Admin Alice")).toBeInTheDocument();
  });

  it("disables the toggle on the viewer's own row and fires PATCH for others", async () => {
    const calls: Array<{ userId: string; body: { is_admin: boolean } }> = [];
    server.use(
      meHandler({ id: "viewer", is_admin: true }),
      adminUsersHandler([
        userRow({ id: "viewer", is_admin: true, display_name: "Admin Alice" }),
        userRow({ id: "u2", is_admin: false, display_name: "Bob" }),
      ]),
      http.patch(`${env.apiBaseUrl}/admin/users/:id/admin`, async ({ request, params }) => {
        const body = (await request.json()) as { is_admin: boolean };
        calls.push({ userId: params.id as string, body });
        return HttpResponse.json({
          ...userRow({ id: params.id as string }),
          is_admin: body.is_admin,
        });
      }),
    );
    renderWithProviders(routed(), { route: "/admin" });
    const selfSwitch = await screen.findByRole("switch", {
      name: /admin status for Admin Alice/i,
    });
    expect(selfSwitch).toBeDisabled();

    const bobSwitch = screen.getByRole("switch", { name: /admin status for Bob/i });
    await userEvent.click(bobSwitch);
    await waitFor(() =>
      expect(calls).toEqual([{ userId: "u2", body: { is_admin: true } }]),
    );
  });
});
