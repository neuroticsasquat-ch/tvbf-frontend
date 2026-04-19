# tvbf-frontend

React SPA for TV Binge Friend. Read-only browse, search, and detail views over the [tvbf-backend](../tvbf-backend) API.

## Stack

React 19 · Vite 6 · TypeScript · React Router 7 · TanStack Query · Tailwind v4 · shadcn/ui · Vitest + RTL + MSW.

## Prerequisites

- Docker Desktop
- [`go-task`](https://taskfile.dev) (`brew install go-task`)
- [`tbc-localdev-infra`](../../tbc-localdev-infra) running (Traefik + shared Postgres)

No local Node/pnpm needed — everything runs in the `tvbf_frontend` container.

## Quick start

```sh
task infra:up   # start shared Traefik + Postgres (once per boot)
task build      # build image (first run only, or after dep changes)
task up         # start the dev container
```

Open **https://tvbf.localhost/**. Accept the self-signed cert; repeat for **https://tvbf-backend.localhost/** so the browser trusts the API origin.

## Commands

All `task` targets run inside the container.

| Target | Purpose |
|---|---|
| `task up` / `down` / `build` / `logs` / `shell` | Container lifecycle |
| `task test` | Run Vitest once (`task test -- <path>` for a single file) |
| `task test:watch` | Vitest watch mode |
| `task lint` / `format` / `typecheck` | Quality gates |
| `task build:app` | Production Vite build |
| `task deps:add -- <pkg>` / `deps:add-dev -- <pkg>` | Add deps via pnpm |

## Architecture

```
src/
  main.tsx              # bootstrap: QueryClientProvider + RouterProvider
  router.tsx            # route tree
  env.ts                # typed env access (VITE_API_BASE_URL)
  api/
    client.ts           # fetch wrapper + ApiError
    types.ts            # TS types mirroring backend DTOs
    shows.ts            # useShows, useShow, useShowEpisodes
    refs.ts             # useGenres, useNetworks
  hooks/useUrlState.ts  # URL as single source of truth for filters + paging
  components/
    ui/                 # shadcn/ui primitives (do not edit directly)
    AppShell, ShowCard, ShowGrid, Filters, Pagination,
    LoadingState, ErrorState, SafeHtml
  pages/
    BrowsePage, ShowDetailPage, EpisodesPage, NotFoundPage
  test/                 # Vitest setup + MSW handlers + fixtures
```

**URL state:** filters, search, sort, and page live in the query string (`?search=...&genre=...&sort=-premiered&page=3`). Back button works; links are shareable.

**API caching:** TanStack Query `staleTime: 5 min` matches the backend's `Cache-Control: public, max-age=300`.

## Configuration

Copy `.env.example` to `.env.local` (gitignored) to override:

- `VITE_API_BASE_URL` — defaults to `https://tvbf-backend.localhost`

## Testing

MSW intercepts `fetch` in tests; handlers live in `src/test/msw/`. To cover a new endpoint, add a handler + fixture there, then write the test. Component tests use the `renderWithProviders` helper (TanStack Query + MemoryRouter).
