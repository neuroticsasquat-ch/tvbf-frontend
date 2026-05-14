import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ForgotPasswordPage } from "./ForgotPasswordPage";

describe("ForgotPasswordPage", () => {
  it("shows the neutral confirmation after submit on success", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/forgot-password`, () => new HttpResponse(null, { status: 202 })),
    );
    renderWithProviders(<ForgotPasswordPage />, { route: "/forgot-password" });
    await userEvent.type(screen.getByLabelText(/email/i), "alice@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(
      await screen.findByText(/if that email belongs to an account/i),
    ).toBeInTheDocument();
  });

  it("shows the same neutral confirmation when the API errors (no enumeration)", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/forgot-password`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderWithProviders(<ForgotPasswordPage />, { route: "/forgot-password" });
    await userEvent.type(screen.getByLabelText(/email/i), "ghost@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    expect(
      await screen.findByText(/if that email belongs to an account/i),
    ).toBeInTheDocument();
  });
});
