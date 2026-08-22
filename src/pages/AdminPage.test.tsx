import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AdminPage } from "./AdminPage";

const toastErrorMock = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(() => undefined, {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: () => undefined,
  }),
}));

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

function userRow(overrides: {
  id: string;
  is_admin?: boolean;
  display_name?: string;
  handle?: string;
  disabled_at?: string | null;
}) {
  return {
    id: overrides.id,
    email: `${overrides.id}@example.com`,
    display_name: overrides.display_name ?? overrides.id,
    handle: overrides.handle ?? `${overrides.id}_h`,
    created_at: "2026-01-01T00:00:00Z",
    is_admin: overrides.is_admin ?? false,
    disabled_at: overrides.disabled_at ?? null,
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

beforeEach(() => toastErrorMock.mockReset());
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

  it("filters the user list by name or email as the admin types", async () => {
    server.use(
      meHandler({ id: "viewer", is_admin: true }),
      adminUsersHandler([
        userRow({ id: "viewer", is_admin: true, display_name: "Admin Alice" }),
        userRow({ id: "u2", is_admin: false, display_name: "Bob Builder" }),
        userRow({ id: "u3", is_admin: false, display_name: "Carol Carpenter" }),
      ]),
    );
    renderWithProviders(routed(), { route: "/admin" });
    await screen.findByText("Bob Builder");

    const input = screen.getByRole("searchbox", { name: /filter users/i });
    await userEvent.type(input, "carol");

    expect(screen.queryByText("Bob Builder")).not.toBeInTheDocument();
    expect(screen.queryByText("Admin Alice")).not.toBeInTheDocument();
    expect(screen.getByText("Carol Carpenter")).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, "u3@example.com");
    expect(screen.getByText("Carol Carpenter")).toBeInTheDocument();
    expect(screen.queryByText("Bob Builder")).not.toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, "zzz-no-match");
    expect(screen.getByText(/no users match "zzz-no-match"/i)).toBeInTheDocument();
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
    await waitFor(() => expect(calls).toEqual([{ userId: "u2", body: { is_admin: true } }]));
  });

  it("marks a disabled row with a badge and the date, and leaves an active row unmarked", async () => {
    server.use(
      meHandler({ id: "viewer", is_admin: true }),
      adminUsersHandler([
        userRow({ id: "u2", display_name: "Bob" }),
        userRow({ id: "u3", display_name: "Carol", disabled_at: "2026-08-12T09:00:00Z" }),
      ]),
    );
    renderWithProviders(routed(), { route: "/admin" });

    const rows = await screen.findAllByTestId("admin-user-row");
    const bob = rows.find((r) => within(r).queryByText("Bob"))!;
    const carol = rows.find((r) => within(r).queryByText("Carol"))!;

    expect(within(carol).getByText("Disabled")).toBeInTheDocument();
    // `disabled_at` is the only record the act leaves anywhere, so the date is
    // shown beside the join date rather than only the fact (NEU-1168 §4.1).
    expect(within(carol).getByText(/Disabled 8\/12\/2026/)).toBeInTheDocument();
    expect(within(bob).queryByText("Disabled")).not.toBeInTheDocument();
  });

  it("offers Disable on other rows and nothing at all on the viewer's own", async () => {
    server.use(
      meHandler({ id: "viewer", is_admin: true }),
      adminUsersHandler([
        userRow({ id: "viewer", is_admin: true, display_name: "Admin Alice" }),
        userRow({ id: "u2", display_name: "Bob" }),
        userRow({ id: "u3", display_name: "Carol", disabled_at: "2026-08-12T09:00:00Z" }),
      ]),
    );
    renderWithProviders(routed(), { route: "/admin" });

    const rows = await screen.findAllByTestId("admin-user-row");
    const self = rows.find((r) => within(r).queryByText("Admin Alice"))!;
    const bob = rows.find((r) => within(r).queryByText("Bob"))!;
    const carol = rows.find((r) => within(r).queryByText("Carol"))!;

    // A control that exists only to be dead is worse than an absent one — the
    // route's 403 stays as the backstop (NEU-1168 §4.3).
    expect(within(self).queryByRole("button", { name: /disable|enable/i })).not.toBeInTheDocument();
    expect(within(bob).getByRole("button", { name: "Disable" })).toBeInTheDocument();
    expect(within(carol).getByRole("button", { name: "Enable" })).toBeInTheDocument();
  });

  it("says what disabling does, issues nothing until Confirm, and writes the response over the row", async () => {
    const calls: Array<{ userId: string; body: { disabled: boolean } }> = [];
    server.use(
      meHandler({ id: "viewer", is_admin: true }),
      adminUsersHandler([userRow({ id: "u2", display_name: "Bob" })]),
      http.patch(`${env.apiBaseUrl}/admin/users/:id/disabled`, async ({ request, params }) => {
        const body = (await request.json()) as { disabled: boolean };
        calls.push({ userId: params.id as string, body });
        return HttpResponse.json({
          ...userRow({ id: params.id as string, display_name: "Bob" }),
          disabled_at: body.disabled ? "2026-08-20T10:00:00Z" : null,
        });
      }),
    );
    renderWithProviders(routed(), { route: "/admin" });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Disable" }));

    const dialog = await screen.findByRole("dialog");
    // AC 2: all three consequences, plus the sentence separating this from
    // deletion.
    expect(within(dialog).getByText(/Disable Bob/)).toBeInTheDocument();
    expect(within(dialog).getByText(/signed out everywhere/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/cannot log in/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/re-enable them at any time/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/not account deletion/i)).toBeInTheDocument();
    expect(calls).toEqual([]);

    // Cancel issues nothing on this dialog as well as on Enable's (AC 4).
    await user.click(within(dialog).getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Disable" }));
    const reopened = await screen.findByRole("dialog");
    await user.click(within(reopened).getByRole("button", { name: /disable account/i }));
    await waitFor(() => expect(calls).toEqual([{ userId: "u2", body: { disabled: true } }]));

    // The row re-renders from the response body, with no refetch to correct a
    // timestamp the client would otherwise have had to invent (§4.4).
    const row = await screen.findByTestId("admin-user-row");
    expect(within(row).getByText("Disabled")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Enable" })).toBeInTheDocument();
  });

  it("confirms re-enabling too, and cancelling either dialog issues nothing", async () => {
    let calls = 0;
    server.use(
      meHandler({ id: "viewer", is_admin: true }),
      adminUsersHandler([
        userRow({ id: "u3", display_name: "Carol", disabled_at: "2026-08-12T09:00:00Z" }),
      ]),
      http.patch(`${env.apiBaseUrl}/admin/users/:id/disabled`, () => {
        calls += 1;
        return HttpResponse.json(userRow({ id: "u3", display_name: "Carol" }));
      }),
    );
    renderWithProviders(routed(), { route: "/admin" });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Enable" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Enable Carol/)).toBeInTheDocument();
    expect(within(dialog).getByText(/able to log in again/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/need to sign in/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls).toBe(0);
  });

  it("toasts and refetches the list when a toggle is refused", async () => {
    let listCalls = 0;
    server.use(
      meHandler({ id: "viewer", is_admin: true }),
      http.get(`${env.apiBaseUrl}/admin/users`, () => {
        listCalls += 1;
        return HttpResponse.json([userRow({ id: "u2", display_name: "Bob" })]);
      }),
      http.patch(`${env.apiBaseUrl}/admin/users/:id/disabled`, () =>
        HttpResponse.json({ detail: "user_not_found" }, { status: 404 }),
      ),
    );
    renderWithProviders(routed(), { route: "/admin" });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Disable" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /disable account/i }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    // A 403 or a 404 here means the list the admin is reading is stale, so the
    // failure path refetches rather than rolling anything back (§4.4).
    await waitFor(() => expect(listCalls).toBeGreaterThan(1));
    // Nothing optimistic was written, so the row is unchanged throughout.
    const row = screen.getByTestId("admin-user-row");
    expect(within(row).queryByText("Disabled")).not.toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Disable" })).toBeInTheDocument();
  });

  it("draws each row through UserIdentity and matches the filter on the handle", async () => {
    server.use(
      meHandler({ id: "viewer", is_admin: true }),
      adminUsersHandler([
        userRow({ id: "u2", display_name: "Bob Builder", handle: "bob_b" }),
        userRow({ id: "u3", display_name: "Carol Carpenter", handle: "carol_c" }),
      ]),
    );
    renderWithProviders(routed(), { route: "/admin" });
    await screen.findByText("Bob Builder");

    const rows = screen.getAllByTestId("admin-user-row");
    // Asserted on the identity node, not the row: on the row it would pass
    // just as happily when this surface hand-rolls its own span (§7).
    expect(rows[0].querySelector("[data-user-identity]")).toHaveTextContent("@bob_b");

    // The handle is the one label a moderator can be handed verbatim in a
    // report, so the box that finds a person has to match on it.
    await userEvent.type(screen.getByRole("searchbox", { name: /filter users/i }), "carol_c");
    expect(screen.getByText("Carol Carpenter")).toBeInTheDocument();
    expect(screen.queryByText("Bob Builder")).not.toBeInTheDocument();
  });

  it("names both the display name and the handle on the repeated admin switch and the dialogs", async () => {
    // The sharpest case in §4.3: this switch repeats down every row, so with
    // `display_name` alone a screen reader user hears the same accessible name
    // on two switches, one of which grants admin to the wrong person.
    server.use(
      meHandler({ id: "viewer", is_admin: true }),
      adminUsersHandler([
        userRow({ id: "u2", display_name: "Tom", handle: "tom_b" }),
        userRow({ id: "u3", display_name: "Tom", handle: "tom_c" }),
      ]),
    );
    renderWithProviders(routed(), { route: "/admin" });

    expect(
      await screen.findByRole("switch", { name: "Admin status for Tom (@tom_b)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Admin status for Tom (@tom_c)" }),
    ).toBeInTheDocument();

    const rows = screen.getAllByTestId("admin-user-row");
    await userEvent.click(within(rows[1]).getByRole("button", { name: "Disable" }));
    expect(await screen.findByText("Disable Tom (@tom_c)")).toBeInTheDocument();
  });
});
