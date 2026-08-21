import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Routes, Route } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { renderedTurnstileWidgetCount } from "@/test/turnstile";
import { env } from "@/env";
import { AuthProvider } from "@/components/AuthContext";
import { SignupPage } from "./SignupPage";

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/my-shows" element={<div>my list page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

async function fillCommonFields(invite = "test-invite") {
  await userEvent.type(screen.getByLabelText(/invite code/i), invite);
  await userEvent.type(screen.getByLabelText(/email/i), "x@y.com");
  await userEvent.type(screen.getByLabelText(/username/i), "X");
  await userEvent.type(screen.getByLabelText(/^handle$/i), "x_user");
  await userEvent.type(screen.getByLabelText(/password/i), "hunter2hunter2");
}

describe("SignupPage", () => {
  it("creates an account and redirects", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "auth_required" }, { status: 401 }),
      ),
      http.post(`${env.apiBaseUrl}/auth/signup`, () =>
        HttpResponse.json(
          {
            id: "u1",
            email: "x@y.com",
            display_name: "X",
            created_at: new Date().toISOString(),
            csrf_token: "test-csrf",
          },
          { status: 201 },
        ),
      ),
    );
    renderAt("/signup");
    await fillCommonFields();
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    await waitFor(() => expect(screen.getByText("my list page")).toBeInTheDocument());
  });

  it("surfaces email_in_use", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "auth_required" }, { status: 401 }),
      ),
      http.post(`${env.apiBaseUrl}/auth/signup`, () =>
        HttpResponse.json({ detail: "email_in_use" }, { status: 409 }),
      ),
    );
    renderAt("/signup");
    await fillCommonFields();
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    await waitFor(() => expect(screen.getByText(/already registered/i)).toBeInTheDocument());
  });

  it("distinguishes handle_unavailable from email_in_use on the same 409", async () => {
    // Both conflicts share the status and name different fields (NEU-1163
    // §6.3). Read as one message, a taken handle would tell the visitor their
    // email was already registered — a refusal pointing at the wrong input, on
    // the one form submitting both.
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "auth_required" }, { status: 401 }),
      ),
      http.post(`${env.apiBaseUrl}/auth/signup`, () =>
        HttpResponse.json({ detail: "handle_unavailable" }, { status: 409 }),
      ),
    );
    renderAt("/signup");
    await fillCommonFields();
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    await waitFor(() => expect(screen.getByText(/already taken/i)).toBeInTheDocument());
    expect(screen.queryByText(/already registered/i)).not.toBeInTheDocument();
  });

  it("puts a 422 about the handle under the handle input", async () => {
    // The form has an input for it, so the message lands there rather than in
    // the banner (NEU-1196). This is what NEU-1163 §2 buys by making the shape
    // rules schema rules.
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "auth_required" }, { status: 401 }),
      ),
      http.post(`${env.apiBaseUrl}/auth/signup`, () =>
        HttpResponse.json(
          { detail: [{ loc: ["body", "handle"], msg: "handle is not available", type: "value_error" }] },
          { status: 422 },
        ),
      ),
    );
    renderAt("/signup");
    await fillCommonFields();
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));

    const message = await screen.findByText(/handle is not available/i);
    expect(message).toBeInTheDocument();
    expect(screen.getByLabelText(/^handle$/i)).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining("handle-error"),
    );
  });

  it("sends the handle as typed and lets the server normalise it", async () => {
    // The server strips whitespace and one leading `@` and lowercases
    // (NEU-1163 §1.1), so normalising here would be a second copy of a rule
    // that already has exactly one — and a divergent one the day it changes.
    let sent: Record<string, unknown> | null = null;
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "auth_required" }, { status: 401 }),
      ),
      http.post(`${env.apiBaseUrl}/auth/signup`, async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            id: "u1",
            email: "x@y.com",
            display_name: "X",
            handle: "tomboone",
            created_at: new Date().toISOString(),
            csrf_token: "test-csrf",
          },
          { status: 201 },
        );
      }),
    );
    renderAt("/signup");
    await userEvent.type(screen.getByLabelText(/invite code/i), "test-invite");
    await userEvent.type(screen.getByLabelText(/email/i), "x@y.com");
    await userEvent.type(screen.getByLabelText(/username/i), "X");
    await userEvent.type(screen.getByLabelText(/^handle$/i), "@TomBoone");
    await userEvent.type(screen.getByLabelText(/password/i), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => expect(screen.getByText("my list page")).toBeInTheDocument());
    expect(sent).toMatchObject({ handle: "@TomBoone" });
  });

  it("surfaces invalid_invite (403)", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "auth_required" }, { status: 401 }),
      ),
      http.post(`${env.apiBaseUrl}/auth/signup`, () =>
        HttpResponse.json({ detail: "invalid_invite" }, { status: 403 }),
      ),
    );
    renderAt("/signup");
    await fillCommonFields("bogus-code");
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    await waitFor(() => expect(screen.getByText(/invite code is invalid/i)).toBeInTheDocument());
  });

  it("renders no verification widget when no site key is configured", async () => {
    renderAt("/signup");
    await fillCommonFields();
    // The backend's own default is verification off (NEU-1160 §6), so an
    // unconfigured SPA must submit exactly as it did before rather than
    // demanding a challenge it has no key to draw.
    expect(renderedTurnstileWidgetCount()).toBe(0);
    expect(screen.getByRole("button", { name: /sign up/i })).toBeEnabled();
  });

  it("reports a temporary outage when the backend wants a token this build cannot draw", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "auth_required" }, { status: 401 }),
      ),
      http.post(`${env.apiBaseUrl}/auth/signup`, () =>
        HttpResponse.json({ detail: "captcha_required" }, { status: 400 }),
      ),
    );
    renderAt("/signup");
    await fillCommonFields();
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));

    // Verification is on server-side but no site key is configured here, so
    // there is no widget to point at — telling the user to complete one would
    // be the silently-unusable form the ticket calls the worst outcome.
    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/complete the verification check/i)).not.toBeInTheDocument();
  });

  it("shows a page-level error state for the IP throttle's 429", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "auth_required" }, { status: 401 }),
      ),
      http.post(`${env.apiBaseUrl}/auth/signup`, () =>
        HttpResponse.json(
          { detail: "rate_limited" },
          { status: 429, headers: { "Retry-After": "3600" } },
        ),
      ),
    );
    renderAt("/signup");
    await fillCommonFields();
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/too many sign-up attempts/i);
    // Distinct from a validation error: the machine token never reaches the
    // page, and nothing is marked invalid.
    expect(screen.queryByText("rate_limited")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).not.toHaveAttribute("aria-invalid");
  });

  it("pre-fills the invite code from the ?invite= query param", () => {
    renderAt("/signup?invite=abc123");
    const input = screen.getByLabelText(/invite code/i) as HTMLInputElement;
    expect(input.value).toBe("abc123");
  });

  it("pre-fills invite code and email from ?invite= and ?email= query params", () => {
    renderAt("/signup?invite=XYZ&email=foo%40bar.com");
    const invite = screen.getByLabelText(/invite code/i) as HTMLInputElement;
    const email = screen.getByLabelText(/email/i) as HTMLInputElement;
    expect(invite.value).toBe("XYZ");
    expect(email.value).toBe("foo@bar.com");
  });

  it("blocks submit when invite code is empty", async () => {
    renderAt("/signup");
    // Fill everything EXCEPT invite code.
    await userEvent.type(screen.getByLabelText(/email/i), "x@y.com");
    await userEvent.type(screen.getByLabelText(/username/i), "X");
  await userEvent.type(screen.getByLabelText(/^handle$/i), "x_user");
    await userEvent.type(screen.getByLabelText(/password/i), "hunter2hunter2");
    // The browser's `required` attribute prevents form submission and triggers
    // its own validation UI before any network call. The form's onSubmit never
    // runs in this case, so we just confirm no API call was made by checking
    // the page doesn't navigate away.
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    expect(screen.queryByText("my list page")).not.toBeInTheDocument();
  });

  it("shows a 422 field message against the display-name input", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "auth_required" }, { status: 401 }),
      ),
      http.post(`${env.apiBaseUrl}/auth/signup`, () =>
        HttpResponse.json(
          {
            detail: [
              {
                type: "value_error",
                loc: ["body", "display_name"],
                msg: "Value error, display_name must not be an email address",
                input: "a@b.c",
              },
            ],
          },
          { status: 422 },
        ),
      ),
    );
    renderAt("/signup");
    await fillCommonFields();
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));

    const message = await screen.findByText("display_name must not be an email address");
    const input = screen.getByLabelText(/username/i);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(message.id);
    expect(screen.queryByText(/check your input/i)).not.toBeInTheDocument();
  });

  it("falls back to the generic sentence when a 422 names no field", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "auth_required" }, { status: 401 }),
      ),
      http.post(`${env.apiBaseUrl}/auth/signup`, () =>
        HttpResponse.json({ detail: { unexpected: "shape" } }, { status: 422 }),
      ),
    );
    renderAt("/signup");
    await fillCommonFields();
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    expect(await screen.findByText(/check your input/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).not.toHaveAttribute("aria-invalid");
  });

  it("keeps a message for a field this form has no input for in the banner", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "auth_required" }, { status: 401 }),
      ),
      http.post(`${env.apiBaseUrl}/auth/signup`, () =>
        HttpResponse.json(
          { detail: [{ type: "missing", loc: ["body", "handle"], msg: "Field required" }] },
          { status: 422 },
        ),
      ),
    );
    renderAt("/signup");
    await fillCommonFields();
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    expect(await screen.findByText("Field required")).toBeInTheDocument();
  });

  it("renders field messages on a non-422 carrying the list shape", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "auth_required" }, { status: 401 }),
      ),
      http.post(`${env.apiBaseUrl}/auth/signup`, () =>
        HttpResponse.json(
          {
            detail: [
              { type: "value_error", loc: ["body", "email"], msg: "Value error, already taken" },
            ],
          },
          { status: 409 },
        ),
      ),
    );
    renderAt("/signup");
    await fillCommonFields();
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));

    expect(await screen.findByText("already taken")).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(/already registered/i)).not.toBeInTheDocument();
  });

  it("clears a field's message once the user edits that field", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "auth_required" }, { status: 401 }),
      ),
      http.post(`${env.apiBaseUrl}/auth/signup`, () =>
        HttpResponse.json(
          {
            detail: [
              {
                type: "value_error",
                loc: ["body", "display_name"],
                msg: "Value error, display_name must not be an email address",
              },
            ],
          },
          { status: 422 },
        ),
      ),
    );
    renderAt("/signup");
    await fillCommonFields();
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    await screen.findByText("display_name must not be an email address");

    const username = screen.getByLabelText(/username/i);
    await userEvent.type(username, "y");
    expect(screen.queryByText("display_name must not be an email address")).not.toBeInTheDocument();
    expect(username).not.toHaveAttribute("aria-invalid");

    // A different field's message is untouched by that edit.
    expect(screen.getByLabelText(/email/i)).not.toHaveAttribute("aria-invalid");
  });

  it("predicts the normalised handle, and only when normalisation changes something", async () => {
    // The server accepts `TomBoone`, `@TomBoone` and `  @tomboone ` and stores
    // `tomboone` for all three (NEU-1163 §1.1); this line is where a visitor
    // finds out what they will actually be called.
    renderAt("/signup");
    const field = screen.getByLabelText(/^handle$/i);

    await userEvent.type(field, "TomBoone");
    expect(screen.getByText("You'll be @tomboone")).toBeInTheDocument();

    await userEvent.clear(field);
    await userEvent.type(field, "tom_b");
    // Echoing `@tom_b` back at someone who typed `tom_b` is noise (D3).
    expect(screen.queryByText(/You'll be/)).not.toBeInTheDocument();
  });

  it("accepts a pasted sigil without a form error", async () => {
    renderAt("/signup");
    const field = screen.getByLabelText(/^handle$/i);
    await userEvent.type(field, "@tom_b");
    await userEvent.tab();

    expect(screen.getByText("You'll be @tom_b")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("blocks submission on a bad shape and sends no request", async () => {
    let requests = 0;
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "auth_required" }, { status: 401 }),
      ),
      http.post(`${env.apiBaseUrl}/auth/signup`, () => {
        requests += 1;
        return HttpResponse.json({ id: "u1" }, { status: 201 });
      }),
    );
    renderAt("/signup");
    await userEvent.type(screen.getByLabelText(/invite code/i), "test-invite");
    await userEvent.type(screen.getByLabelText(/email/i), "x@y.com");
    await userEvent.type(screen.getByLabelText(/username/i), "X");
    await userEvent.type(screen.getByLabelText(/^handle$/i), "tom-boone");
    await userEvent.type(screen.getByLabelText(/password/i), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));

    const message = await screen.findByRole("alert");
    expect(message).toHaveTextContent(/3–30 characters/);
    expect(screen.getByLabelText(/^handle$/i)).toHaveAttribute("aria-invalid", "true");
    expect(requests).toBe(0);
  });

  it("submits a reserved word and the anonymised shape, leaving both to the server", async () => {
    // The client stops at shape (D2): `RESERVED_HANDLES` is a snapshot nothing
    // tracks, and a third copy would drift toward permissive.
    const sent: string[] = [];
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "auth_required" }, { status: 401 }),
      ),
      http.post(`${env.apiBaseUrl}/auth/signup`, async ({ request }) => {
        const body = (await request.json()) as { handle: string };
        sent.push(body.handle);
        return HttpResponse.json(
          {
            detail: [{ type: "value_error", loc: ["body", "handle"], msg: "Value error, handle is not available" }],
          },
          { status: 422 },
        );
      }),
    );
    renderAt("/signup");
    await userEvent.type(screen.getByLabelText(/invite code/i), "test-invite");
    await userEvent.type(screen.getByLabelText(/email/i), "x@y.com");
    await userEvent.type(screen.getByLabelText(/username/i), "X");
    await userEvent.type(screen.getByLabelText(/^handle$/i), "admin");
    await userEvent.type(screen.getByLabelText(/password/i), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => expect(sent).toEqual(["admin"]));
    // The server's own sentence, rendered against the input it names.
    expect(await screen.findByRole("alert")).toHaveTextContent("handle is not available");
  });
});
