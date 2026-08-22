import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { AuthProvider } from "@/components/AuthContext";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

/** Build an initial entry for MemoryRouter. Pass `route` as a plain string
 * when no location state is needed — this preserves backward compatibility with
 * existing callers that pass `?query` params in the route string. */
function makeInitialEntry(
  route: string,
  state?: Record<string, unknown>,
): string | { pathname: string; state?: Record<string, unknown> } {
  return state !== undefined ? { pathname: route, state } : route;
}

interface ProviderOptions extends Omit<RenderOptions, "wrapper"> {
  route?: string;
  locationState?: Record<string, unknown>;
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    route = "/",
    locationState,
    queryClient = createTestQueryClient(),
    ...options
  }: ProviderOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={[makeInitialEntry(route, locationState)]}>
            {children}
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
  }
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}
