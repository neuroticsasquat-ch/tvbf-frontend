import { describe, expect, it, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
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

function invite(overrides: Partial<{
  code: string;
  email_hint: string | null;
  consumed_at: string | null;
}> = {}) {
  return {
    code: overrides.code ?? "CODE-1",
    email_hint: overrides.email_hint ?? "user@example.com",
    created_at: "2026-05-15T12:00:00Z",
    consumed_at: overrides.consumed_at ?? null,
    consumed_by_user_id: null,
  };
}

function routed() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}

afterEach(() => server.resetHandlers());

describe("AdminPage Invites tab", () => {
  it("renders invite rows from GET /admin/invites/cookie", async () => {
    server.use(
      meAdmin(),
      http.get(`${env.apiBaseUrl}/admin/users`, () => HttpResponse.json([])),
      http.get(`${env.apiBaseUrl}/admin/invites/cookie`, () =>
        HttpResponse.json([
          invite({ code: "AAA", email_hint: "alice@example.com" }),
          invite({
            code: "BBB",
            email_hint: "bob@example.com",
            consumed_at: "2026-05-16T00:00:00Z",
          }),
        ]),
      ),
    );
    renderWithProviders(routed(), { route: "/admin?section=invites" });
    await waitFor(() =>
      expect(screen.getByText("alice@example.com")).toBeInTheDocument(),
    );
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByText(/AAA/)).toBeInTheDocument();
    // The consumed row carries the "Consumed" badge.
    const badges = screen.getAllByText(/Consumed|Pending/i);
    expect(badges.some((b) => b.textContent === "Consumed")).toBe(true);
    expect(badges.some((b) => b.textContent === "Pending")).toBe(true);
  });

  it("fires POST /admin/invites/email with the entered email and appends the row", async () => {
    const calls: Array<{ email: string }> = [];
    let invites = [invite({ code: "OLD", email_hint: "older@example.com" })];
    server.use(
      meAdmin(),
      http.get(`${env.apiBaseUrl}/admin/users`, () => HttpResponse.json([])),
      http.get(`${env.apiBaseUrl}/admin/invites/cookie`, () => HttpResponse.json(invites)),
      http.post(`${env.apiBaseUrl}/admin/invites/email`, async ({ request }) => {
        const body = (await request.json()) as { email: string };
        calls.push(body);
        const row = invite({ code: "NEW", email_hint: body.email });
        invites = [row, ...invites];
        return HttpResponse.json(row);
      }),
    );
    renderWithProviders(routed(), { route: "/admin?section=invites" });

    const input = await screen.findByLabelText(/send an invite/i);
    await userEvent.type(input, "fresh@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send invite/i }));

    await waitFor(() => expect(calls).toEqual([{ email: "fresh@example.com" }]));
    await waitFor(() => expect(screen.getByText("fresh@example.com")).toBeInTheDocument());
  });
});
