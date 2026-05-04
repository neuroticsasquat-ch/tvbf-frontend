# tvbf-frontend

React SPA for TV Binge Friend. Auth, catalog browse, search, watchlist, and per-episode watch tracking against the [tvbf-backend](../tvbf-backend) API.

## Stack

React 19 · Vite 6 · TypeScript · React Router 7 · TanStack Query · Tailwind v4 · shadcn/ui · Vitest + RTL + MSW.

## Prerequisites

- Docker Desktop.
- [`go-task`](https://taskfile.dev) (`brew install go-task`).
- [`tbc-localdev-infra`](../../tbc-localdev-infra) running (Traefik + shared Postgres).
- [`tvbf-backend`](../tvbf-backend) running (this SPA needs the API).

No local Node/pnpm needed — everything runs in the `tvbf_frontend` container.

## Quick start

```sh
task infra:up   # start shared Traefik + Postgres (once per boot)
task build      # build image (first run only, or after dep changes)
task up         # start the dev container
```

Open **https://app.tvbf.localhost/**. Accept the self-signed cert; do the same once for **https://api.tvbf.localhost/** so the browser trusts the API origin and accepts cross-subdomain session cookies.

A user account is required — sign up with an invite code issued by the backend's `POST /admin/invites`.

## Commands

All `task` targets run inside the container.

| Target | Purpose |
|---|---|
| `task up` / `down` / `build` / `logs` / `shell` | container lifecycle |
| `task test` | run Vitest once (`task test -- <path>` for a single file) |
| `task test:watch` | Vitest watch mode |
| `task lint` / `format` / `typecheck` | quality gates |
| `task build:app` | production Vite build |
| `task deps:add -- <pkg>` / `deps:add-dev -- <pkg>` | add deps via pnpm |

## Architecture

```
src/
  main.tsx                  # bootstrap: QueryClientProvider + RouterProvider + AuthProvider
  router.tsx                # route tree (public + RequireAuth-gated)
  env.ts                    # typed env access (VITE_API_BASE_URL)
  api/                      # fetch client + typed endpoints (auth, shows, /me)
  components/
    AppShell, UserMenu      # sticky header, global search input, nav
    AuthContext             # session bootstrap + auth state
    SearchOverlay           # full-screen search results — covers any page
    ShowGrid / ShowList     # browse result rows (poster grid + list views)
    home/                   # FilterSheet picker + per-tab list components
    *WatchCheckbox / Toggle # mark-watched primitives (episode / season / show)
    ui/                     # shadcn/ui primitives (do not edit directly)
  pages/                    # one component per route (Login, Signup, MyShows,
                            # WatchNext, Upcoming, Search, ShowDetail, Episodes,
                            # Episode, NotFound)
  hooks/                    # localStorage-backed view/sort/filter persistence
  test/                     # Vitest setup + MSW handlers + fixtures
```

**Routing:** logged-out users see `/login` and `/signup`; everything else is gated behind `<RequireAuth>` which redirects unauthenticated visitors to `/login` and bootstraps the session via `GET /me`.

**Home tabs:** `/` is a tab layout — *My Shows*, *Watch Next*, *Upcoming*, *Search*. Each tab has its own list component under `components/home/` and persists view/sort/filter state per tab in localStorage.

**Show / season / episode pages** share a `[breadcrumbs] → [H1 = sibling-picker via FilterSheet] → [content + watched-toggle paired with prev/next]` hierarchy. Cross-boundary navigation works (prev/next traverses seasons; season prev/next traverses the show).

**URL state for browse:** filters, search, sort, and page live in the query string. Back button works; links are shareable.

**API caching:** TanStack Query `staleTime: 5 min` matches the backend's `Cache-Control: public, max-age=300`. Mutations (mark-watched, add/remove from watchlist) invalidate the relevant queries on success.

**Auth transport:** session cookie is set by the backend at login and scoped to `.tvbf.localhost`, so the SPA at `app.tvbf.localhost` sends it automatically to `api.tvbf.localhost`. No tokens, no localStorage auth, no `Authorization` header.

## Configuration

Copy `.env.example` to `.env.local` (gitignored) to override:

- `VITE_API_BASE_URL` — defaults to `https://api.tvbf.localhost`.

## Testing

MSW intercepts `fetch` in tests; handlers and fixtures live in `src/test/msw/`. To cover a new endpoint, add a handler + fixture there, then write the test. Component tests use the `renderWithProviders` helper (TanStack Query + AuthProvider + MemoryRouter).

jsdom needs `ResizeObserver` and pointer-capture polyfills for the FilterSheet (Radix Dialog) and other shadcn primitives — both wired in `src/test/setup.ts`.
