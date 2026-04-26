import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { AuthProvider, useAuth } from "./AuthContext";

function ProbeUser() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{user ? user.email : "anon"}</div>;
}

function renderWithProviders(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>{node}</AuthProvider>
    </QueryClientProvider>,
  );
}

describe("AuthContext", () => {
  it("initial fetch populates user when /me returns 200", async () => {
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
    renderWithProviders(<ProbeUser />);
    await waitFor(() => expect(screen.getByText("a@b.com")).toBeInTheDocument());
  });

  it("treats 401 as anonymous", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/me`, () =>
        HttpResponse.json({ detail: "auth_required" }, { status: 401 }),
      ),
    );
    renderWithProviders(<ProbeUser />);
    await waitFor(() => expect(screen.getByText("anon")).toBeInTheDocument());
  });
});
