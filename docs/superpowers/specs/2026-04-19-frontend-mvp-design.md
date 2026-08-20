# Frontend MVP — Design

**Date:** 2026-04-19
**Status:** Approved (brainstorming)
**Scope:** A read-only React SPA that consumes the existing public browse API (`2026-04-19-browse-api-design.md`). Covers three screens — browse/search list, show detail with embedded seasons, and per-season episode list — plus the app shell, routing, and loading/error states needed to make those screens usable. User accounts, watchlist, friends, and any per-user state are explicitly deferred.

## Context

The backend already exposes a public, CORS-allowlisted browse API over the TV Maze catalog mirror. No frontend exists yet. CLAUDE.md pins several constraints:

- Hostname `https://tvbf.localhost`, served via the shared Traefik infra.
- Join the external `proxy` Docker network.
- Containerized toolchain only — no local Node, mirror the backend's `Dockerfile` + `docker-compose.yml` + `Taskfile.yml` pattern.
- No secrets in the SPA; admin operations stay server-to-server.
- First milestone is read-only browse/search/detail. Watch tracking and friends arrive with the user service later.

This spec is the smallest thing that makes the catalog visible to a human in a browser. It is intentionally strict MVP: no local-storage stubs, no features that don't map directly to an existing endpoint.

## Goals

1. Ship a working browse experience against the existing API with no backend changes.
2. Stay containerized end-to-end — every `pnpm`, `vite`, `tsc`, `eslint`, `vitest` invocation runs in the `tvbf_frontend` container.
3. Keep URL the source of truth for filter/pagination state so links are shareable and back-button behavior is sane.
4. Leave clean seams for the later user-service work: no global state soup, no premature abstraction around auth.

## Non-goals

- Auth, user accounts, watchlist, friends, per-user state.
- SSR or SEO — the SPA is client-rendered only.
- i18n, analytics, PWA/offline support.
- Discovery surfaces (trending, recent, recommended) — deferred until the backend offers them.
- Production Docker stage and deploy pipeline — the initial `Dockerfile` targets dev only.
- End-to-end browser tests (Playwright). Component tests backed by MSW cover MVP flows.

## Decisions

### D1. Vite + React 19 + TypeScript (SPA)

Client-rendered SPA built with Vite. No Next.js / Remix / TanStack Start. The browse API is public and already CORS-allowlisted, so there is no server-side secret to protect and no SEO story yet. Adding a Node runtime only creates a second deployable that needs its own Dockerfile, Traefik rule, and env wiring for no current benefit. Vite's dev server containerizes cleanly and HMR works through Traefik's `websecure` entrypoint.

### D2. Tailwind CSS v4 + shadcn/ui

Utility CSS plus copy-paste Radix-based primitives. Gives accessible building blocks (dialog, select, combobox) without locking the app into a component library's visual identity. Styling stays colocated with components. Alternatives considered: CSS Modules (too much design-system work for MVP), Mantine/Chakra (more opinionated visual identity, harder to restyle later).

### D3. TanStack Query for API state

All reads go through TanStack Query hooks. The backend sets `Cache-Control: public, max-age=300` on browse responses; the client mirrors that with a 5-minute `staleTime` so navigating back to a previously viewed list is instant. Query keys are derived from filter state so cache entries don't collide across filter combinations.

### D4. React Router v7 with URL as source of truth

Filter state, search string, sort key, and page number all live in the URL query string. A typed `useUrlState` hook parses and writes `URLSearchParams`. Form controls are controlled from URL state, not local state — no dual-source-of-truth bugs, and every view is shareable.

### D5. Numbered offset pagination

Matches the API (`?page=N&per_page=P`). Infinite scroll and "Load more" both lose shareable deep links and play badly with filter changes. If the catalog-browse UX ever needs it, cursor pagination is a backend addition, not a frontend refactor.

### D6. pnpm as package manager

Smaller install footprint, stricter dependency resolution, and a clean story if the monorepo ever grows additional frontend packages. Bound into the container image; never invoked on the host.

### D7. Containerization mirrors the backend

Three-file pattern — `Dockerfile`, `docker-compose.yml`, `Taskfile.yml`. Same conventions as `tvbf-backend/`: external `proxy` network, Traefik labels on the `websecure` entrypoint, `infra:` namespace in the Taskfile from `../tbc-localdev-infra/Taskfile.yml`.

## Architecture

### Directory layout

```
tvbf-frontend/
  Dockerfile
  docker-compose.yml
  Taskfile.yml
  package.json
  pnpm-lock.yaml
  tsconfig.json
  vite.config.ts
  postcss.config.js
  tailwind.config.ts
  components.json              # shadcn/ui config
  index.html
  .eslintrc.cjs
  .prettierrc
  src/
    main.tsx                   # bootstrap: QueryClientProvider + RouterProvider
    router.tsx                 # route tree
    env.ts                     # typed access to import.meta.env
    api/
      client.ts                # fetch wrapper, base URL, error mapping
      types.ts                 # TS types mirroring backend DTOs
      shows.ts                 # query hooks: useShows, useShow, useEpisodes, ...
      refs.ts                  # query hooks: useGenres, useNetworks
    components/
      ui/                      # shadcn/ui primitives (button, input, select, ...)
      AppShell.tsx             # header + nav + <Outlet />
      ShowCard.tsx
      ShowGrid.tsx
      Pagination.tsx
      Filters.tsx              # search, genre, network, status, sort
      ErrorState.tsx
      LoadingState.tsx         # skeleton placeholders
      SafeHtml.tsx             # dompurify wrapper for API summary HTML
    pages/
      BrowsePage.tsx           # /
      ShowDetailPage.tsx       # /shows/:id
      EpisodesPage.tsx         # /shows/:id/episodes
      NotFoundPage.tsx
    hooks/
      useUrlState.ts           # typed URLSearchParams read/write
    test/
      setup.ts                 # Vitest + RTL + MSW setup
      msw/
        handlers.ts            # default request handlers
        server.ts              # setupServer for node-env tests
        fixtures.ts            # sample API payloads
```

### Data flow

1. A route component calls a TanStack Query hook (e.g., `useShows(filters)` where `filters` is parsed from the URL by `useUrlState`).
2. The hook derives a query key from the filter object and calls into `api/client.ts`.
3. The client reads `import.meta.env.VITE_API_BASE_URL` (default `https://tvbf-backend.localhost`) and issues a `fetch`. Non-2xx responses throw a typed `ApiError` that components match on for error UI.
4. TanStack Query caches with `staleTime: 5 * 60 * 1000` (matching backend `Cache-Control`), dedupes concurrent requests, and handles background refetch on window focus.
5. User interactions (typing in search, changing a filter, paging) call `setUrlState(...)` which updates the URL; the component re-renders with new filters; the hook refetches under a new key.

### Routing

```
/                         → BrowsePage
/shows/:id                → ShowDetailPage
/shows/:id/episodes       → EpisodesPage
*                         → NotFoundPage
```

React Router v7 data APIs (`loader`) are not used; data fetching stays in TanStack Query hooks so loading/error states are uniform and cache entries are reused across navigations.

## Screens

### Browse (`/`)

Layout: filter bar at top, responsive grid of `ShowCard`, numbered pagination at bottom.

**Filter bar controls** (all optional, all URL-backed):

- `search` — debounced text input (300ms).
- `genre` — multi-select combobox populated from `/genres`.
- `network` — multi-select combobox populated from `/networks`.
- `status` — single select (`Running`, `Ended`, `To Be Determined`, `In Development`).
- `sort` — single select matching backend whitelist (`name`, `-name`, `premiered`, `-premiered`, `tvmaze_updated`, `-tvmaze_updated`; leading `-` = descending).

Changing any filter resets `page` to 1. The sort dropdown only emits whitelisted keys, so a 422 from the backend is a bug, not a user-reachable state.

**Show card**: poster (fallback placeholder when missing), name, premiered year, up to three genre chips, network name.

**Pagination**: numbered, with prev/next, current page, and total-page indicator derived from the `pagination` block on the API response.

### Show detail (`/shows/:id`)

Hero row: poster, name, year range (`premiered` – `ended` or "present"), status pill, runtime, language, genres, network. Summary HTML rendered via `SafeHtml` (dompurify, default config; strips scripts/styles/unknown tags).

Season list: table of seasons from the embedded `seasons` array — number, episode count, premiere date. Each row links to `/shows/:id/episodes?season=N`. External links (TVmaze, IMDb) render when present in `externals`.

### Episodes (`/shows/:id/episodes`)

Season dropdown at top, bound to `?season=N` in the URL. Defaults to season 1 if no query param. Below, a table of episodes for the selected season: number, name, airdate, runtime, summary snippet. Paging is not needed — the API returns all episodes for a season in one call.

### Not found

Plain page with a link back to `/`. Triggered by the catch-all route and by 404 responses from show/episode endpoints.

## Error & loading states

- **Loading**: skeleton placeholders sized to the target layout. No spinners — grid and detail page both have predictable dimensions.
- **Error**: `ErrorState` component with the error's user-facing message and a "Retry" button that calls the hook's `refetch`.
- **404**: show detail and episodes pages treat a 404 API response as a hard not-found, rendering the `NotFoundPage` body inline (no redirect — preserves the URL).
- **Network error / timeout**: same `ErrorState`, generic message.

## Containerization details

### Dockerfile

Single file, multi-stage but only the dev stage is wired into compose for MVP.

- `FROM node:22-alpine AS base` — installs `corepack` and activates pnpm at the version pinned in `package.json`'s `packageManager` field.
- `FROM base AS deps` — copies `package.json` + `pnpm-lock.yaml`, runs `pnpm install --frozen-lockfile`.
- `FROM base AS dev` — copies `node_modules` from `deps`, exposes `5173`, default command is `pnpm dev --host 0.0.0.0`.
- A `build` and a `prod` stage are sketched (comments or stubbed) so the deploy work is straightforward later, but they aren't the compose default.

### docker-compose.yml

```yaml
services:
  tvbf-frontend:
    build:
      context: .
      target: dev
    container_name: tvbf_frontend
    networks:
      - default
      - proxy
    volumes:
      - ./:/app
      - tvbf_frontend_node_modules:/app/node_modules
    environment:
      VITE_API_BASE_URL: https://tvbf-backend.localhost
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.tvbf-frontend.rule=Host(`tvbf.localhost`)"
      - "traefik.http.routers.tvbf-frontend.entrypoints=websecure"
      - "traefik.http.routers.tvbf-frontend.tls=true"
      - "traefik.http.services.tvbf-frontend.loadbalancer.server.port=5173"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:5173/"]
      interval: 30s
      timeout: 5s
      retries: 3

networks:
  proxy:
    external: true

volumes:
  tvbf_frontend_node_modules:
```

The named `node_modules` volume is load-bearing — it keeps container-installed deps from showing up on the host and causing EACCES / native-module mismatches.

### Taskfile.yml

Mirrors the backend structure. Includes:

- `infra:*` — from `../tbc-localdev-infra/Taskfile.yml`
- `up`, `down`, `build`, `logs`, `shell`
- `dev` (alias for `up` + follow logs)
- `test`, `test:watch`, `test:ui`
- `lint`, `format`, `typecheck`
- `deps:add -- <pkg>`, `deps:add-dev -- <pkg>` — wrap `docker compose exec -T tvbf-frontend pnpm add [-D] <pkg>`

### Vite config

- `server.host = '0.0.0.0'`, `server.port = 5173`.
- `server.hmr.clientPort = 443` so the browser's HMR WebSocket connects over Traefik's TLS entrypoint.
- `server.allowedHosts = ['tvbf.localhost']`.

## Testing

- **Vitest** with `jsdom` environment for component tests, `node` for pure unit tests.
- **React Testing Library** for component assertions.
- **MSW** (`msw/node`) intercepts `fetch` in tests; handlers live in `src/test/msw/handlers.ts` with sample fixtures in `src/test/msw/fixtures.ts` shaped after real API responses.
- Test coverage targets:
  - `useUrlState` — parse/write round-trip, defaults, unknown keys ignored.
  - `api/client.ts` — URL construction for each filter permutation, error mapping.
  - `BrowsePage` — rendering a fixtured list, filter change updates URL, pagination advances URL, error state renders on 500, loading skeleton on pending.
  - `ShowDetailPage` — renders show, season links carry season number, 404 renders NotFound body.
  - `EpisodesPage` — season dropdown changes URL, episode table renders.
- No E2E / Playwright in MVP. Revisit when the UI has interactions (auth, watchlist) that MSW-backed component tests can't realistically cover.

## Quality gates

- `task lint` — `eslint src` with `@typescript-eslint` and the React hooks plugin.
- `task format` — `prettier --write`.
- `task typecheck` — `tsc --noEmit` in strict mode.
- `task test` — Vitest.

Pre-commit hooks are deferred — set up once the container and scripts are stable so the hook can reliably `docker compose exec -T tvbf-frontend <cmd>` the same way the backend's `.pre-commit-config.yaml` does.

## Open questions (resolved in this spec)

- **Poster images**: served directly from TV Maze CDN URLs present in the API payload. No proxying, no local caching.
- **Summary HTML**: sanitized with `dompurify` default profile. The backend already strips nothing, so the client owns sanitization.
- **Base URL in production**: deferred with the rest of the production Docker story. MVP assumes `https://tvbf-backend.localhost`.
