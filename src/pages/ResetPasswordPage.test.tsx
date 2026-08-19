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
    await userEvent.type(screen.getByLabelText(/confirm new password/i), "brandnew12345");
    await userEvent.click(screen.getByRole("button", { name: /save new password/i }));

    // After success the form disappears (navigation happens).
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /save new password/i })).not.toBeInTheDocument(),
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
    await userEvent.type(screen.getByLabelText(/confirm new password/i), "brandnew12345");
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
    await userEvent.type(screen.getByLabelText(/confirm new password/i), "brandnew12345");
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
    await userEvent.type(screen.getByLabelText(/confirm new password/i), "different12345");
    await userEvent.click(screen.getByRole("button", { name: /save new password/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/don't match/i);
  });

  it("shows missing-token state when there's no ?token=", async () => {
    renderWithProviders(<ResetPasswordPage />, { route: "/reset-password" });
    expect(await screen.findByText(/missing its reset token/i)).toBeInTheDocument();
  });

  it("shows a field message against the new-password input", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/reset-password`, () =>
        HttpResponse.json(
          {
            detail: [
              {
                type: "value_error",
                loc: ["body", "new_password"],
                msg: "Value error, new_password is too common",
              },
            ],
          },
          { status: 422 },
        ),
      ),
    );
    renderWithProviders(<ResetPasswordPage />, { route: "/reset-password?token=good" });
    await userEvent.type(screen.getByLabelText(/^new password$/i), "password1234");
    await userEvent.type(screen.getByLabelText(/confirm new password/i), "password1234");
    await userEvent.click(screen.getByRole("button", { name: /save new password/i }));

    const message = await screen.findByText("new_password is too common");
    const input = screen.getByLabelText(/^new password$/i);
    expect(input).toHaveAttribute("aria-invalid", "true");
    // The message is announced alongside the length hint the input already had.
    expect(input.getAttribute("aria-describedby")).toBe(`${message.id} pw-help`);
    expect(screen.queryByText(/isn't allowed/i)).not.toBeInTheDocument();
  });

  it("answers a schema complaint about the token with the bad-link copy", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/reset-password`, () =>
        HttpResponse.json(
          { detail: [{ type: "missing", loc: ["body", "token"], msg: "Field required" }] },
          { status: 422 },
        ),
      ),
    );
    renderWithProviders(<ResetPasswordPage />, { route: "/reset-password?token=good" });
    await userEvent.type(screen.getByLabelText(/^new password$/i), "brandnew12345");
    await userEvent.type(screen.getByLabelText(/confirm new password/i), "brandnew12345");
    await userEvent.click(screen.getByRole("button", { name: /save new password/i }));

    // Not the raw `Field required`: it names a field with no input on this
    // page, and it would replace the only copy saying what to do next.
    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(screen.queryByText("Field required")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^new password$/i)).not.toHaveAttribute("aria-invalid");
  });

  it("clears the field message once the user edits the password", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/reset-password`, () =>
        HttpResponse.json(
          {
            detail: [
              {
                type: "value_error",
                loc: ["body", "new_password"],
                msg: "Value error, new_password is too common",
              },
            ],
          },
          { status: 422 },
        ),
      ),
    );
    renderWithProviders(<ResetPasswordPage />, { route: "/reset-password?token=good" });
    const input = screen.getByLabelText(/^new password$/i);
    await userEvent.type(input, "password1234");
    await userEvent.type(screen.getByLabelText(/confirm new password/i), "password1234");
    await userEvent.click(screen.getByRole("button", { name: /save new password/i }));
    await screen.findByText("new_password is too common");

    await userEvent.type(input, "x");
    expect(screen.queryByText("new_password is too common")).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute("aria-invalid");
    // The length hint it always had is still announced.
    expect(input.getAttribute("aria-describedby")).toBe("pw-help");
  });
});
