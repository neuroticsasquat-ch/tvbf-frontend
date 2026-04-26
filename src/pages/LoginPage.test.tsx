import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Routes, Route } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { AuthProvider } from "@/components/AuthContext";
import { LoginPage } from "./LoginPage";

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/my-shows" element={<div>my list page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("LoginPage", () => {
  it("logs in and redirects to /my-shows", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "auth_required" }, { status: 401 }),
      ),
      http.post(`${env.apiBaseUrl}/auth/login`, () =>
        HttpResponse.json({
          id: "u1",
          email: "a@b.com",
          display_name: "A",
          created_at: new Date().toISOString(),
          csrf_token: "test-csrf",
        }),
      ),
    );
    renderAt("/login?next=/my-shows");
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/password/i), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(screen.getByText("my list page")).toBeInTheDocument());
  });

  it("shows an error message on invalid credentials", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "auth_required" }, { status: 401 }),
      ),
      http.post(`${env.apiBaseUrl}/auth/login`, () =>
        HttpResponse.json({ detail: "invalid_credentials" }, { status: 401 }),
      ),
    );
    renderAt("/login");
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    await waitFor(() => expect(screen.getByText(/incorrect/i)).toBeInTheDocument());
  });
});
