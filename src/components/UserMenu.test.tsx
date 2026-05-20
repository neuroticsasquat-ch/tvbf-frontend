import { describe, expect, it, afterEach, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { renderWithProviders } from "@/test/renderWithProviders";
import { UserMenu } from "./UserMenu";

function meHandler(is_admin: boolean) {
  return http.get(`${env.apiBaseUrl}/me`, () =>
    HttpResponse.json({
      id: "u1",
      email: "a@x.com",
      display_name: "Alice",
      created_at: "2026-01-01T00:00:00Z",
      email_verified_at: "2026-01-01T00:00:00Z",
      csrf_token: "csrf",
      activity_feed_enabled: true,
      is_admin,
    }),
  );
}

afterEach(() => server.resetHandlers());

describe("UserMenu admin link", () => {
  it("does not show the Admin link for non-admins", async () => {
    server.use(meHandler(false));
    renderWithProviders(
      <UserMenu
        onChangePassword={() => {}}
        onDeleteAccount={() => {}}
        onSendFeedback={() => {}}
      />,
    );
    const trigger = await screen.findByRole("button", { name: /account menu/i });
    await userEvent.click(trigger);
    expect(screen.queryByRole("menuitem", { name: /admin/i })).not.toBeInTheDocument();
  });

  it("shows the Admin link for admins", async () => {
    server.use(meHandler(true));
    renderWithProviders(
      <UserMenu
        onChangePassword={() => {}}
        onDeleteAccount={() => {}}
        onSendFeedback={() => {}}
      />,
    );
    const trigger = await screen.findByRole("button", { name: /account menu/i });
    await userEvent.click(trigger);
    expect(await screen.findByRole("menuitem", { name: /admin/i })).toBeInTheDocument();
  });
});

describe("UserMenu Send feedback", () => {
  it("invokes onSendFeedback when 'Send feedback' is clicked", async () => {
    server.use(meHandler(false));
    const onSendFeedback = vi.fn();
    renderWithProviders(
      <UserMenu
        onChangePassword={() => {}}
        onDeleteAccount={() => {}}
        onSendFeedback={onSendFeedback}
      />,
    );
    const trigger = await screen.findByRole("button", { name: /account menu/i });
    await userEvent.click(trigger);
    await userEvent.click(await screen.findByRole("menuitem", { name: /send feedback/i }));
    expect(onSendFeedback).toHaveBeenCalledTimes(1);
  });
});
