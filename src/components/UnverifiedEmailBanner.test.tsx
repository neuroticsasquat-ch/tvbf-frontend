import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { meHandler, VERIFIED_AT } from "@/test/msw/me";
import { env } from "@/env";
import { renderWithProviders } from "@/test/renderWithProviders";
import { BANNER_DISMISS_KEY } from "@/lib/verification";
import { UnverifiedEmailBanner } from "./UnverifiedEmailBanner";

describe("UnverifiedEmailBanner", () => {
  afterEach(() => sessionStorage.clear());

  it("doesn't render when the user is verified", async () => {
    server.use(meHandler(VERIFIED_AT));
    const { container } = renderWithProviders(<UnverifiedEmailBanner />);
    // Wait for the /me query to resolve, then assert the banner isn't shown.
    await waitFor(() => {
      expect(container.querySelector('[role="status"]')).not.toBeInTheDocument();
    });
  });

  it("renders the one-more-step prompt and the resend button works on success", async () => {
    server.use(meHandler(null));

    renderWithProviders(<UnverifiedEmailBanner />);
    expect(await screen.findByText(/one more step/i)).toBeInTheDocument();
    expect(screen.getByText(/connect with people and let them find you/i)).toBeInTheDocument();

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
    await screen.findByText(/one more step/i);
    await userEvent.click(screen.getByRole("button", { name: /resend verification/i }));
    expect(await screen.findByText(/too many emails/i)).toBeInTheDocument();
    // Button should still be there so the user can retry later.
    expect(screen.getByRole("button", { name: /resend verification/i })).toBeInTheDocument();
  });

  it("dismisses for this tab, and comes back once sessionStorage is cleared", async () => {
    server.use(meHandler(null));

    const first = renderWithProviders(<UnverifiedEmailBanner />);
    await screen.findByText(/one more step/i);
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    await waitFor(() => expect(screen.queryByText(/one more step/i)).not.toBeInTheDocument());
    expect(sessionStorage.getItem(BANNER_DISMISS_KEY)).not.toBeNull();

    // A later mount in the same tab stays dismissed …
    first.unmount();
    const second = renderWithProviders(<UnverifiedEmailBanner />);
    await waitFor(() => expect(second.container).toBeEmptyDOMElement());

    // … and the next visit gets the prompt back.
    second.unmount();
    sessionStorage.clear();
    renderWithProviders(<UnverifiedEmailBanner />);
    expect(await screen.findByText(/one more step/i)).toBeInTheDocument();
  });
});
