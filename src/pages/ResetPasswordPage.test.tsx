import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ResetPasswordPage } from "./ResetPasswordPage";

describe("ResetPasswordPage", () => {
  it("happy path: success navigates to /login", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/reset-password`, () => HttpResponse.json({ ok: true })),
    );
    renderWithProviders(<ResetPasswordPage />, {
      route: "/reset-password?token=good",
    });
    await userEvent.type(screen.getByLabelText(/^new password$/i), "brandnew12345");
    await userEvent.type(
      screen.getByLabelText(/confirm new password/i),
      "brandnew12345",
    );
    await userEvent.click(screen.getByRole("button", { name: /save new password/i }));

    // After success the form disappears (navigation happens).
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /save new password/i }),
      ).not.toBeInTheDocument(),
    );
  });

  it("invalid/expired token returns 400 with helpful copy", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/reset-password`, () =>
        HttpResponse.json({ detail: "invalid_token" }, { status: 400 }),
      ),
    );
    renderWithProviders(<ResetPasswordPage />, {
      route: "/reset-password?token=expired",
    });
    await userEvent.type(screen.getByLabelText(/^new password$/i), "brandnew12345");
    await userEvent.type(
      screen.getByLabelText(/confirm new password/i),
      "brandnew12345",
    );
    await userEvent.click(screen.getByRole("button", { name: /save new password/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /reset link is invalid or has expired/i,
    );
  });

  it("422 from the API surfaces a password-not-allowed message", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/reset-password`, () =>
        HttpResponse.json({ detail: "invalid" }, { status: 422 }),
      ),
    );
    renderWithProviders(<ResetPasswordPage />, {
      route: "/reset-password?token=ok",
    });
    await userEvent.type(screen.getByLabelText(/^new password$/i), "brandnew12345");
    await userEvent.type(
      screen.getByLabelText(/confirm new password/i),
      "brandnew12345",
    );
    await userEvent.click(screen.getByRole("button", { name: /save new password/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/isn't allowed/i);
  });

  it("rejects mismatched confirmation client-side without calling the API", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/reset-password`, () =>
        HttpResponse.json({ detail: "must not be called" }, { status: 500 }),
      ),
    );
    renderWithProviders(<ResetPasswordPage />, {
      route: "/reset-password?token=ok",
    });
    await userEvent.type(screen.getByLabelText(/^new password$/i), "brandnew12345");
    await userEvent.type(
      screen.getByLabelText(/confirm new password/i),
      "different12345",
    );
    await userEvent.click(screen.getByRole("button", { name: /save new password/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/don't match/i);
  });

  it("shows missing-token state when there's no ?token=", async () => {
    renderWithProviders(<ResetPasswordPage />, { route: "/reset-password" });
    expect(await screen.findByText(/missing its reset token/i)).toBeInTheDocument();
  });
});
