import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { renderWithProviders } from "@/test/renderWithProviders";
import { EmailChangeConfirmPage } from "./EmailChangeConfirmPage";

describe("EmailChangeConfirmPage", () => {
  it("shows a success message on 200", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/email-change/confirm`, () =>
        HttpResponse.json({ ok: true }),
      ),
    );
    renderWithProviders(<EmailChangeConfirmPage />, {
      route: "/email-change/confirm?token=good",
    });
    expect(
      await screen.findByText(/your email address has been updated/i),
    ).toBeInTheDocument();
  });

  it("shows invalid/expired copy on 400", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/email-change/confirm`, () =>
        HttpResponse.json({ detail: "invalid_token" }, { status: 400 }),
      ),
    );
    renderWithProviders(<EmailChangeConfirmPage />, {
      route: "/email-change/confirm?token=bad",
    });
    expect(
      await screen.findByText(/confirmation link is invalid or has expired/i),
    ).toBeInTheDocument();
  });

  it("shows taken-by-another-account copy on 409", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/email-change/confirm`, () =>
        HttpResponse.json({ detail: "email_in_use" }, { status: 409 }),
      ),
    );
    renderWithProviders(<EmailChangeConfirmPage />, {
      route: "/email-change/confirm?token=race",
    });
    expect(
      await screen.findByText(/already in use by another account/i),
    ).toBeInTheDocument();
  });

  it("shows missing-token state when there's no ?token=", async () => {
    renderWithProviders(<EmailChangeConfirmPage />, {
      route: "/email-change/confirm",
    });
    expect(
      await screen.findByText(/no confirmation token/i),
    ).toBeInTheDocument();
  });
});
