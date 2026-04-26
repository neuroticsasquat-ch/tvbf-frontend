import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Routes, Route } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { AuthProvider } from "./AuthContext";
import { RequireAuth } from "./RequireAuth";

function setup(initial = "/secret") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <MemoryRouter initialEntries={[initial]}>
          <Routes>
            <Route element={<RequireAuth />}>
              <Route path="/secret" element={<div>secret content</div>} />
            </Route>
            <Route path="/login" element={<div>login page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("RequireAuth", () => {
  it("redirects to /login when unauthenticated", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "auth_required" }, { status: 401 }),
      ),
    );
    setup();
    await waitFor(() => expect(screen.getByText("login page")).toBeInTheDocument());
  });

  it("renders children when authenticated", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({
          id: "u1",
          email: "a@b.com",
          display_name: "A",
          created_at: new Date().toISOString(),
        }),
      ),
    );
    setup();
    await waitFor(() => expect(screen.getByText("secret content")).toBeInTheDocument());
  });
});
