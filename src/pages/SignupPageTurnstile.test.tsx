import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type * as EnvModule from "@/env";

import { AuthProvider } from "@/components/AuthContext";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { currentTurnstileWidget, renderedTurnstileWidgetCount } from "@/test/turnstile";

import { SignupPage } from "./SignupPage";

// The site key is the only thing that switches the widget on, so it is what a
// test has to control. `importOriginal` keeps `apiBaseUrl` byte-identical to
// the one the MSW handlers were built from — a second, independently-guessed
// base would make every request in this file unhandled.
vi.mock("@/env", async (importOriginal) => {
  const actual = await importOriginal<typeof EnvModule>();
  return { env: { ...actual.env, turnstileSiteKey: "test-site-key" } };
});

function renderSignup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/signup"]}>
          <Routes>
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/my-shows" element={<div>my list page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

async function fillFields() {
  await userEvent.type(screen.getByLabelText(/email/i), "x@y.com");
  await userEvent.type(screen.getByLabelText(/username/i), "X");
  await userEvent.type(screen.getByLabelText(/^handle$/i), "x_user");
  await userEvent.type(screen.getByLabelText(/password/i), "hunter2hunter2");
}

function submitButton() {
  return screen.getByRole("button", { name: /sign up/i });
}

async function solveChallenge(token = "tok-1") {
  await waitFor(() => expect(renderedTurnstileWidgetCount()).toBeGreaterThan(0));
  act(() => currentTurnstileWidget().solve(token));
}

describe("SignupPage with Turnstile enabled", () => {
  it("renders the widget with the site key from env", async () => {
    renderSignup();
    await waitFor(() => expect(renderedTurnstileWidgetCount()).toBe(1));
    expect(currentTurnstileWidget().sitekey).toBe("test-site-key");
    expect(env.turnstileSiteKey).toBe("test-site-key");
  });

  it("blocks submit until the challenge resolves, and says why", async () => {
    renderSignup();
    await fillFields();

    // Marked disabled rather than actually disabled, so the button keeps its
    // place in the tab order and the explanation is reachable.
    expect(submitButton()).toHaveAttribute("aria-disabled", "true");
    expect(submitButton()).toBeEnabled();
    const help = screen.getByText(/complete the verification check above/i);
    expect(submitButton().getAttribute("aria-describedby")).toBe(help.id);

    await solveChallenge();

    expect(submitButton()).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByText(/complete the verification check above/i)).not.toBeInTheDocument();
  });

  it("says why rather than doing nothing when the gated button is pressed", async () => {
    let requested = false;
    server.use(
      http.post(`${env.apiBaseUrl}/auth/signup`, () => {
        requested = true;
        return HttpResponse.json({ detail: "unexpected" }, { status: 500 });
      }),
    );
    renderSignup();
    await fillFields();
    await userEvent.click(submitButton());

    expect(
      await screen.findByText(/complete the verification check to continue/i),
    ).toBeInTheDocument();
    expect(requested).toBe(false);
  });

  it("sends the token with the signup request", async () => {
    let sent: unknown = null;
    server.use(
      http.post(`${env.apiBaseUrl}/auth/signup`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(
          {
            id: "u1",
            email: "x@y.com",
            display_name: "X",
            created_at: new Date().toISOString(),
            csrf_token: "test-csrf",
          },
          { status: 201 },
        );
      }),
    );
    renderSignup();
    await fillFields();
    await solveChallenge("tok-sent");
    await userEvent.click(submitButton());

    await waitFor(() => expect(screen.getByText("my list page")).toBeInTheDocument());
    expect(sent).toMatchObject({ turnstile_token: "tok-sent" });
  });

  it("blocks submit again once a solved challenge expires", async () => {
    renderSignup();
    await fillFields();
    await solveChallenge();
    expect(submitButton()).not.toHaveAttribute("aria-disabled");

    act(() => currentTurnstileWidget().expire());

    expect(submitButton()).toHaveAttribute("aria-disabled", "true");
    expect(await screen.findByRole("alert")).toHaveTextContent(/expired/i);
  });

  it("explains a rejected token and draws a fresh challenge", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/auth/signup`, () =>
        HttpResponse.json({ detail: "captcha_invalid" }, { status: 400 }),
      ),
    );
    renderSignup();
    await fillFields();
    await solveChallenge();
    await userEvent.click(submitButton());

    expect(await screen.findByText(/couldn't be confirmed/i)).toBeInTheDocument();
    // The backend spends the token verifying it, so the one in hand is used up
    // whatever the outcome — a second attempt needs a new challenge.
    await waitFor(() => expect(renderedTurnstileWidgetCount()).toBe(2));
    expect(submitButton()).toHaveAttribute("aria-disabled", "true");
  });

  it("draws a fresh challenge after a failure that is nothing to do with the captcha", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/auth/signup`, () =>
        HttpResponse.json({ detail: "email_in_use" }, { status: 409 }),
      ),
    );
    renderSignup();
    await fillFields();
    await solveChallenge();
    await userEvent.click(submitButton());

    expect(await screen.findByText(/already registered/i)).toBeInTheDocument();
    await waitFor(() => expect(renderedTurnstileWidgetCount()).toBe(2));
  });

  it("explains an unreachable verification service", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/auth/signup`, () =>
        HttpResponse.json({ detail: "captcha_unavailable" }, { status: 503 }),
      ),
    );
    renderSignup();
    await fillFields();
    await solveChallenge();
    await userEvent.click(submitButton());

    expect(await screen.findByText(/couldn't reach the verification service/i)).toBeInTheDocument();
  });

  it("explains a missing token the backend asked for", async () => {
    server.use(
      http.post(`${env.apiBaseUrl}/auth/signup`, () =>
        HttpResponse.json({ detail: "captcha_required" }, { status: 400 }),
      ),
    );
    renderSignup();
    await fillFields();
    await solveChallenge();
    await userEvent.click(submitButton());

    expect(
      await screen.findByText(/complete the verification check and try again/i),
    ).toBeInTheDocument();
  });
});
