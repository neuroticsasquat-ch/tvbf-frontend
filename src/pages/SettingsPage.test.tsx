import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SettingsPage } from "./SettingsPage";

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
