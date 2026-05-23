import { describe, expect, it, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SettingsPage } from "./SettingsPage";

function meHandler(activity_feed_enabled: boolean) {
  return http.get(`${env.apiBaseUrl}/me`, () =>
    HttpResponse.json({
      id: "u1",
      email: "a@x.com",
      display_name: "Alice",
      created_at: new Date().toISOString(),
      email_verified_at: null,
      csrf_token: "csrf",
      activity_feed_enabled,
    }),
  );
}

function sessionsHandler() {
  return http.get(`${env.apiBaseUrl}/me/sessions`, () => HttpResponse.json([]));
}

afterEach(() => server.resetHandlers());

describe("SettingsPage privacy toggle", () => {
  it("reflects activity_feed_enabled from /me", async () => {
    server.use(meHandler(false), sessionsHandler());
    renderWithProviders(<SettingsPage />, { route: "/settings" });
    const toggle = await screen.findByRole("switch", {
      name: /share my activity with friends/i,
    });
    expect(toggle).not.toBeChecked();
  });

  it("calls PATCH /me/preferences with the new value when toggled", async () => {
    const calls: Array<{ activity_feed_enabled?: boolean }> = [];
    server.use(
      meHandler(true),
      sessionsHandler(),
      http.patch(`${env.apiBaseUrl}/me/preferences`, async ({ request }) => {
        const body = (await request.json()) as { activity_feed_enabled?: boolean };
        calls.push(body);
        return HttpResponse.json({
          id: "u1",
          email: "a@x.com",
          display_name: "Alice",
          created_at: new Date().toISOString(),
          email_verified_at: null,
          csrf_token: "csrf",
          activity_feed_enabled: body.activity_feed_enabled ?? true,
        });
      }),
    );
    renderWithProviders(<SettingsPage />, { route: "/settings" });
    const toggle = await screen.findByRole("switch", {
      name: /share my activity with friends/i,
    });
    expect(toggle).toBeChecked();

    await userEvent.click(toggle);
    await waitFor(() => expect(calls).toEqual([{ activity_feed_enabled: false }]));
  });
});
