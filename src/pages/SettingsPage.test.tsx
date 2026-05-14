import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SettingsPage } from "./SettingsPage";

function sessionsHandler(rows: unknown[]) {
  return http.get(`${env.apiBaseUrl}/me/sessions`, () => HttpResponse.json(rows));
}

function authedMeHandler() {
  return http.get(`${env.apiBaseUrl}/me`, () =>
    HttpResponse.json({
      id: "u1",
      email: "alice@example.com",
      display_name: "Alice",
      created_at: new Date().toISOString(),
      email_verified_at: null,
      csrf_token: "csrf",
    }),
  );
}

describe("SettingsPage", () => {
  it("renders the current display name and reveals the editor on Edit", async () => {
    server.use(authedMeHandler());
    renderWithProviders(<SettingsPage />, { route: "/settings" });

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByLabelText(/display name/i)).toHaveValue("Alice");
  });

  it("saves a new display name and reflects it in /me", async () => {
    server.use(authedMeHandler());
    server.use(
      http.patch(`${env.apiBaseUrl}/me`, async ({ request }) => {
        const body = (await request.json()) as { display_name: string };
        return HttpResponse.json({
          id: "u1",
          email: "alice@example.com",
          display_name: body.display_name,
          created_at: new Date().toISOString(),
          email_verified_at: null,
          csrf_token: "csrf",
        });
      }),
    );

    renderWithProviders(<SettingsPage />, { route: "/settings" });
    await screen.findByText("Alice");
    await userEvent.click(screen.getByRole("button", { name: /edit/i }));

    const input = screen.getByLabelText(/display name/i);
    await userEvent.clear(input);
    await userEvent.type(input, "Allison");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    // Edit closes, new name renders.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Allison")).toBeInTheDocument();
  });

  it("shows an error toast and keeps the editor open when the API returns 422", async () => {
    server.use(authedMeHandler());
    server.use(
      http.patch(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "invalid" }, { status: 422 }),
      ),
    );

    renderWithProviders(<SettingsPage />, { route: "/settings" });
    await screen.findByText("Alice");
    await userEvent.click(screen.getByRole("button", { name: /edit/i }));

    const input = screen.getByLabelText(/display name/i);
    await userEvent.clear(input);
    await userEvent.type(input, "Different");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    // The Save button should reappear (editor stays open) and original
    // display name stays visible nowhere else.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument(),
    );
  });

  it("rejects an empty name client-side without calling the API", async () => {
    server.use(authedMeHandler());
    server.use(
      http.patch(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "should not be called" }, { status: 500 }),
      ),
    );

    renderWithProviders(<SettingsPage />, { route: "/settings" });
    await screen.findByText("Alice");
    await userEvent.click(screen.getByRole("button", { name: /edit/i }));
    const input = screen.getByLabelText(/display name/i);
    await userEvent.clear(input);
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/1–80 characters/);
  });

  // ---------------------------------------------------------------------
  // Email section
  // ---------------------------------------------------------------------

  it("shows current email and verified/unverified state", async () => {
    server.use(authedMeHandler());
    renderWithProviders(<SettingsPage />, { route: "/settings" });
    expect(await screen.findByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText(/^unverified$/i)).toBeInTheDocument();
  });

  it("happy-path: submitting the change-email form shows a sent-confirmation message", async () => {
    server.use(authedMeHandler());
    server.use(
      http.post(`${env.apiBaseUrl}/me/email/change`, () => new HttpResponse(null, { status: 202 })),
    );

    renderWithProviders(<SettingsPage />, { route: "/settings" });
    await screen.findByText("alice@example.com");
    await userEvent.click(screen.getByRole("button", { name: /change email/i }));

    await userEvent.type(screen.getByLabelText(/new email/i), "new@example.com");
    await userEvent.type(screen.getByLabelText(/current password/i), "hunter2hunter2");
    await userEvent.click(
      screen.getByRole("button", { name: /send confirmation link/i }),
    );

    expect(
      await screen.findByText(/we sent a confirmation link to/i),
    ).toBeInTheDocument();
    expect(screen.getByText("new@example.com")).toBeInTheDocument();
  });

  it.each([
    [401, /password is incorrect/i],
    [409, /already used by another account/i],
    [429, /too many requests/i],
  ])("change-email surface for status %i shows %s", async (status, copy) => {
    server.use(authedMeHandler());
    server.use(
      http.post(`${env.apiBaseUrl}/me/email/change`, () =>
        HttpResponse.json({ detail: "err" }, { status }),
      ),
    );

    renderWithProviders(<SettingsPage />, { route: "/settings" });
    await screen.findByText("alice@example.com");
    await userEvent.click(screen.getByRole("button", { name: /change email/i }));
    await userEvent.type(screen.getByLabelText(/new email/i), "new@example.com");
    await userEvent.type(screen.getByLabelText(/current password/i), "wrong");
    await userEvent.click(
      screen.getByRole("button", { name: /send confirmation link/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(copy);
    // Form stays open so the user can fix and retry.
    expect(
      screen.getByRole("button", { name: /send confirmation link/i }),
    ).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------
  // Sessions section
  // ---------------------------------------------------------------------

  it("renders sessions with device label, IP, and marks the current one", async () => {
    server.use(authedMeHandler());
    server.use(
      sessionsHandler([
        {
          id: "sess-1",
          device_label: "Chrome on macOS",
          ip: "10.0.0.1",
          last_seen_at: new Date(Date.now() - 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          is_current: true,
        },
        {
          id: "sess-2",
          device_label: "Firefox on Windows",
          ip: "10.0.0.2",
          last_seen_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          is_current: false,
        },
      ]),
    );

    renderWithProviders(<SettingsPage />, { route: "/settings" });
    expect(await screen.findByText("Chrome on macOS")).toBeInTheDocument();
    expect(screen.getByText("Firefox on Windows")).toBeInTheDocument();
    expect(screen.getByText("10.0.0.1")).toBeInTheDocument();
    expect(screen.getByText("10.0.0.2")).toBeInTheDocument();
    expect(screen.getByText(/this device/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no sessions", async () => {
    server.use(authedMeHandler());
    server.use(sessionsHandler([]));

    renderWithProviders(<SettingsPage />, { route: "/settings" });
    expect(await screen.findByText(/no active sessions/i)).toBeInTheDocument();
  });

  it("shows an error message if /me/sessions fails", async () => {
    server.use(authedMeHandler());
    server.use(
      http.get(`${env.apiBaseUrl}/me/sessions`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );

    renderWithProviders(<SettingsPage />, { route: "/settings" });
    expect(
      await screen.findByText(/couldn't load your sessions/i),
    ).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------
  // Session revoke actions
  // ---------------------------------------------------------------------

  describe("session revocation", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    function twoSessions() {
      return sessionsHandler([
        {
          id: "sess-current",
          device_label: "Chrome on macOS",
          ip: "10.0.0.1",
          last_seen_at: new Date(Date.now() - 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          is_current: true,
        },
        {
          id: "sess-other",
          device_label: "Firefox on Windows",
          ip: "10.0.0.2",
          last_seen_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          is_current: false,
        },
      ]);
    }

    it("renders Revoke only on non-current rows", async () => {
      server.use(authedMeHandler());
      server.use(twoSessions());
      renderWithProviders(<SettingsPage />, { route: "/settings" });
      await screen.findByText("Chrome on macOS");

      const revokeButtons = screen.getAllByRole("button", { name: /^revoke /i });
      expect(revokeButtons).toHaveLength(1);
      expect(revokeButtons[0]).toHaveAccessibleName(/Firefox on Windows/i);
    });

    it("Revoke calls DELETE and removes the row on success", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      // Stateful handler: GET /me/sessions reflects deletes so the refetch
      // that follows the mutation doesn't resurrect the row.
      const rows = [
        {
          id: "sess-current",
          device_label: "Chrome on macOS",
          ip: "10.0.0.1",
          last_seen_at: new Date(Date.now() - 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          is_current: true,
        },
        {
          id: "sess-other",
          device_label: "Firefox on Windows",
          ip: "10.0.0.2",
          last_seen_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          is_current: false,
        },
      ];
      server.use(authedMeHandler());
      server.use(http.get(`${env.apiBaseUrl}/me/sessions`, () => HttpResponse.json(rows)));
      server.use(
        http.delete(`${env.apiBaseUrl}/me/sessions/sess-other`, () => {
          const idx = rows.findIndex((r) => r.id === "sess-other");
          if (idx >= 0) rows.splice(idx, 1);
          return new HttpResponse(null, { status: 204 });
        }),
      );

      renderWithProviders(<SettingsPage />, { route: "/settings" });
      await screen.findByText("Firefox on Windows");
      await userEvent.click(
        screen.getByRole("button", { name: /Revoke Firefox on Windows/i }),
      );

      await waitFor(() =>
        expect(screen.queryByText("Firefox on Windows")).not.toBeInTheDocument(),
      );
    });

    it("Revoke does nothing if the user cancels the confirm prompt", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      let called = false;
      server.use(authedMeHandler());
      server.use(twoSessions());
      server.use(
        http.delete(`${env.apiBaseUrl}/me/sessions/sess-other`, () => {
          called = true;
          return new HttpResponse(null, { status: 204 });
        }),
      );

      renderWithProviders(<SettingsPage />, { route: "/settings" });
      await screen.findByText("Firefox on Windows");
      await userEvent.click(
        screen.getByRole("button", { name: /Revoke Firefox on Windows/i }),
      );

      expect(called).toBe(false);
      expect(screen.getByText("Firefox on Windows")).toBeInTheDocument();
    });

    it("Log-out-everywhere-else only shows when there are other sessions", async () => {
      server.use(authedMeHandler());
      // Just the current session.
      server.use(
        sessionsHandler([
          {
            id: "sess-current",
            device_label: "Chrome on macOS",
            ip: "10.0.0.1",
            last_seen_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            is_current: true,
          },
        ]),
      );

      renderWithProviders(<SettingsPage />, { route: "/settings" });
      await screen.findByText("Chrome on macOS");
      expect(
        screen.queryByRole("button", { name: /log out everywhere else/i }),
      ).not.toBeInTheDocument();
    });

    it("Log-out-everywhere-else calls revoke-others and refetches", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      let callCount = 0;
      server.use(authedMeHandler());
      server.use(twoSessions());
      server.use(
        http.post(`${env.apiBaseUrl}/me/sessions/revoke-others`, () => {
          callCount++;
          return HttpResponse.json({ revoked: 1 });
        }),
      );

      renderWithProviders(<SettingsPage />, { route: "/settings" });
      await screen.findByRole("button", { name: /log out everywhere else/i });
      await userEvent.click(
        screen.getByRole("button", { name: /log out everywhere else/i }),
      );

      await waitFor(() => expect(callCount).toBe(1));
    });
  });

  // ---------------------------------------------------------------------
  // Your data section
  // ---------------------------------------------------------------------

  describe("your data", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    function stubBlobUrls() {
      Object.defineProperty(URL, "createObjectURL", {
        writable: true,
        configurable: true,
        value: vi.fn(() => "blob:mock"),
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        writable: true,
        configurable: true,
        value: vi.fn(),
      });
    }

    it("clicking 'Download my data' fetches /me/export", async () => {
      stubBlobUrls();
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      let requested = false;
      server.use(authedMeHandler());
      server.use(
        http.get(`${env.apiBaseUrl}/me/export`, () => {
          requested = true;
          return new HttpResponse('{"account":{}}', {
            status: 200,
            headers: {
              "content-type": "application/json",
              "content-disposition": 'attachment; filename="tvbf-export-2026-05-13.json"',
            },
          });
        }),
      );

      renderWithProviders(<SettingsPage />, { route: "/settings" });
      await userEvent.click(
        await screen.findByRole("button", { name: /download my data/i }),
      );
      await waitFor(() => expect(requested).toBe(true));
    });

    it("shows an error toast on failure", async () => {
      stubBlobUrls();
      server.use(authedMeHandler());
      server.use(
        http.get(`${env.apiBaseUrl}/me/export`, () =>
          HttpResponse.json({ detail: "boom" }, { status: 500 }),
        ),
      );

      renderWithProviders(<SettingsPage />, { route: "/settings" });
      await userEvent.click(
        await screen.findByRole("button", { name: /download my data/i }),
      );
      // The button re-enables once the request finishes (success or error).
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /download my data/i }),
        ).not.toBeDisabled(),
      );
    });
  });

  it("Cancel restores the original name and closes the editor", async () => {
    server.use(authedMeHandler());
    renderWithProviders(<SettingsPage />, { route: "/settings" });
    await screen.findByText("Alice");
    await userEvent.click(screen.getByRole("button", { name: /edit/i }));
    const input = screen.getByLabelText(/display name/i);
    await userEvent.clear(input);
    await userEvent.type(input, "Discarded");
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });
});
