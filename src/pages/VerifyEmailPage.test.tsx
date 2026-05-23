import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { renderWithProviders } from "@/test/renderWithProviders";
import { VerifyEmailPage } from "./VerifyEmailPage";

describe("VerifyEmailPage", () => {
  it("shows a success message when /verify-email returns 200", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/verify-email`, () =>
        HttpResponse.json({ ok: true }),
      ),
    );
    renderWithProviders(<VerifyEmailPage />, { route: "/verify-email?token=good" });
    expect(await screen.findByText(/your email is verified/i)).toBeInTheDocument();
  });

  it("shows an expired/invalid error on 400", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/verify-email`, () =>
        HttpResponse.json({ detail: "invalid_token" }, { status: 400 }),
      ),
    );
    renderWithProviders(<VerifyEmailPage />, { route: "/verify-email?token=bad" });
    expect(
      await screen.findByText(/verification link is invalid or has expired/i),
    ).toBeInTheDocument();
  });

  it("shows missing-token state when there's no ?token=", async () => {
    renderWithProviders(<VerifyEmailPage />, { route: "/verify-email" });
    expect(await screen.findByText(/no verification token/i)).toBeInTheDocument();
  });
});
