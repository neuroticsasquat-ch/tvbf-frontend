import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { renderWithProviders } from "@/test/renderWithProviders";
import { UnverifiedEmailBanner } from "./UnverifiedEmailBanner";

function meHandler(emailVerifiedAt: string | null) {
  return http.get(`${env.apiBaseUrl}/me`, () =>
    HttpResponse.json({
      id: "u1",
      email: "alice@example.com",
      display_name: "Alice",
      created_at: new Date().toISOString(),
      email_verified_at: emailVerifiedAt,
      csrf_token: "csrf",
    }),
  );
}

describe("UnverifiedEmailBanner", () => {
  it("doesn't render when the user is verified", async () => {
    server.use(meHandler("2026-01-01T00:00:00Z"));
    const { container } = renderWithProviders(<UnverifiedEmailBanner />);
    // Wait for the /me query to resolve, then assert the banner isn't shown.
    await waitFor(() => {
      expect(container.querySelector('[role="status"]')).not.toBeInTheDocument();
    });
  });

  it("renders when the user is unverified and the resend button works on success", async () => {
    server.use(meHandler(null));
    server.use(
      http.post(`${env.apiBaseUrl}/me/email/verification`, () => new HttpResponse(null, { status: 202 })),
    );

    renderWithProviders(<UnverifiedEmailBanner />);
    expect(await screen.findByText(/please verify your email/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /resend verification/i }));
    expect(await screen.findByText(/verification email sent/i)).toBeInTheDocument();
    // Button disappears once we've sent.
    expect(screen.queryByRole("button", { name: /resend/i })).not.toBeInTheDocument();
  });

  it("shows a rate-limit message on 429", async () => {
    server.use(meHandler(null));
    server.use(
      http.post(`${env.apiBaseUrl}/me/email/verification`, () =>
        HttpResponse.json({ detail: "rate_limited" }, { status: 429 }),
      ),
    );

    renderWithProviders(<UnverifiedEmailBanner />);
    await screen.findByText(/please verify your email/i);
    await userEvent.click(screen.getByRole("button", { name: /resend verification/i }));
    expect(await screen.findByText(/too many emails/i)).toBeInTheDocument();
    // Button should still be there so the user can retry later.
    expect(screen.getByRole("button", { name: /resend verification/i })).toBeInTheDocument();
  });
});
