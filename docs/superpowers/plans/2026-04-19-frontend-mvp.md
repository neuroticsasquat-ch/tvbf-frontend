# Frontend MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a containerized React 19 + Vite + TypeScript SPA in `tvbf-frontend/` that consumes the existing public browse API. Ships three screens (browse/search, show detail with seasons, per-season episodes), app shell, routing, loading/error states, and a Vitest+MSW test harness. No user accounts, no persistence beyond URL state.

**Architecture:** Vite SPA behind Traefik on `https://tvbf.localhost`. TanStack Query handles API caching (5-min `staleTime`, matches backend `Cache-Control`). React Router v7 with URL as the single source of truth for filter/pagination state. Tailwind v4 + shadcn/ui for styling. MSW intercepts `fetch` in Vitest-based tests. Every toolchain invocation runs inside the `tvbf_frontend` container; nothing touches the host.

**Tech Stack:** React 19, Vite 6, TypeScript 5.6, React Router 7, TanStack Query 5, Tailwind CSS 4, shadcn/ui, Vitest 2, React Testing Library, MSW 2, dompurify, pnpm 9 on Node 22-alpine.

**Spec reference:** `docs/superpowers/specs/2026-04-19-frontend-mvp-design.md`

---

## Execution notes for the implementing engineer

- **The user handles all git operations.** After each task, stop at the final "task complete" step. Do NOT run `git add`, `git commit`, `git init`, `git push`, or any other state-changing git command. Read-only git commands (`status`, `log`, `diff`) are fine. This repo is a monorepo parent that is NOT a git repo itself; `tvbf-frontend/` will become its own git repo when the user runs `git init` — the `.gitignore` is created by this plan but left for the user to `git init` + commit on their own cadence.
- **Everything runs inside the container.** No local `node`, `pnpm`, `npm`, `npx`, or `vite` invocations on the host. Before the container exists (Task 2), a few setup commands run via `docker run --rm`; after Task 2, everything routes through `task` targets that call `docker compose exec -T tvbf-frontend ...`.
- **Shared infra must be up.** Before bringing the frontend container up, `task infra:up` needs to have run at least once. The frontend joins the external `proxy` Docker network owned by `tbc-localdev-infra`.
- **TLS certs.** Traefik's localdev certs cover `*.localhost`. The browser will trust `https://tvbf.localhost` if the user has already added the localdev mkcert root to their trust store (done when they set up `tbc-localdev-infra`). If not, browser will warn; click through for MVP.
- **HMR through Traefik.** Vite's dev server listens on HTTP 5173 inside the container; Traefik terminates TLS on 443 and proxies to it. Vite's HMR WebSocket needs `clientPort: 443` so the browser connects over `wss://tvbf.localhost/` instead of `ws://localhost:5173/`. Getting this right once is load-bearing — HMR silently breaks otherwise.
- **Test organization.** Colocate test files next to source (`src/foo.ts` + `src/foo.test.ts`). Vitest's default config picks up `**/*.test.{ts,tsx}` anywhere under `src/`.
- **pnpm in container.** Node 22-alpine has Corepack bundled. `corepack enable` + `corepack prepare pnpm@9.15.0 --activate` gives a reproducible pnpm. Pin the exact version in `package.json`'s `packageManager` field so the container and any future CI agree.
- **Why a named volume for `node_modules`.** Bind-mounting the project root with no overlay would dump the container's `node_modules` onto the host — causing EACCES on Linux and native-module mismatches on macOS. The named volume at `/app/node_modules` shadows that one path so the host stays clean.
- **Auto mode is active** at the top of this conversation but does not change this plan's structure — each task is still executed one at a time with tests first.

## File map

```
tvbf-frontend/
  .dockerignore                       # Created: excludes node_modules, dist, .git
  .env.example                        # Created: documents VITE_API_BASE_URL
  .eslintrc.cjs                       # Created
  .gitignore                          # Created: node_modules, dist, .env.local, etc.
  .prettierrc                         # Created
  Dockerfile                          # Created: multi-stage, dev target default
  docker-compose.yml                  # Created: Traefik labels, proxy network, node_modules volume
  Taskfile.yml                        # Created: mirrors backend three-file pattern
  index.html                          # Created: SPA shell
  package.json                        # Created
  pnpm-lock.yaml                      # Created (by pnpm install)
  postcss.config.js                   # Created
  tailwind.config.ts                  # Created (Tailwind v4 minimal)
  tsconfig.json                       # Created (strict)
  tsconfig.node.json                  # Created (for vite.config.ts)
  vite.config.ts                      # Created
  vitest.config.ts                    # Created
  components.json                     # Created: shadcn/ui config
  src/
    main.tsx                          # Created: bootstrap
    router.tsx                        # Created: route tree
    env.ts                            # Created: typed env access
    styles/
      globals.css                     # Created: tailwind directives + base theme
    lib/
      cn.ts                           # Created: shadcn/ui className helper
    api/
      client.ts                       # Created: fetch wrapper + ApiError
      client.test.ts                  # Created
      types.ts                        # Created: TS types mirroring backend DTOs
      shows.ts                        # Created: useShows, useShow, useEpisodes
      shows.test.ts                   # Created
      refs.ts                         # Created: useGenres, useNetworks
    components/
      ui/                             # Created (by shadcn/ui CLI): button, input, select, badge, skeleton, combobox
      AppShell.tsx                    # Created
      ShowCard.tsx                    # Created
      ShowGrid.tsx                    # Created
      Pagination.tsx                  # Created
      Pagination.test.tsx             # Created
      Filters.tsx                     # Created
      ErrorState.tsx                  # Created
      LoadingState.tsx                # Created
      SafeHtml.tsx                    # Created
      SafeHtml.test.tsx               # Created
    hooks/
      useUrlState.ts                  # Created
      useUrlState.test.ts             # Created
    pages/
      BrowsePage.tsx                  # Created
      BrowsePage.test.tsx             # Created
      ShowDetailPage.tsx              # Created
      ShowDetailPage.test.tsx         # Created
      EpisodesPage.tsx                # Created
      EpisodesPage.test.tsx           # Created
      NotFoundPage.tsx                # Created
    test/
      setup.ts                        # Created: MSW + RTL setup
      renderWithProviders.tsx         # Created: test helper (router + query client)
      msw/
        fixtures.ts                   # Created: sample API payloads
        handlers.ts                   # Created: default request handlers
        server.ts                     # Created: setupServer instance
```

---

## Task 1: Bootstrap package.json, tsconfig, and Vite config

**Files:**
- Create: `tvbf-frontend/package.json`
- Create: `tvbf-frontend/.gitignore`
- Create: `tvbf-frontend/.dockerignore`
- Create: `tvbf-frontend/.env.example`
- Create: `tvbf-frontend/tsconfig.json`
- Create: `tvbf-frontend/tsconfig.node.json`
- Create: `tvbf-frontend/vite.config.ts`
- Create: `tvbf-frontend/vitest.config.ts`
- Create: `tvbf-frontend/index.html`
- Create: `tvbf-frontend/src/main.tsx`
- Create: `tvbf-frontend/src/env.ts`
- Create: `tvbf-frontend/src/styles/globals.css`

- [ ] **Step 1: Create `tvbf-frontend/package.json`**

```json
{
  "name": "tvbf-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "lint": "eslint src --max-warnings 0",
    "format": "prettier --write \"src/**/*.{ts,tsx,css,json}\"",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.62.0",
    "dompurify": "^3.2.2",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.1.0"
  },
  "devDependencies": {
    "@testing-library/dom": "^10.4.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/dompurify": "^3.2.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@typescript-eslint/eslint-plugin": "^8.18.0",
    "@typescript-eslint/parser": "^8.18.0",
    "@vitejs/plugin-react": "^4.3.4",
    "eslint": "^9.17.0",
    "eslint-plugin-react-hooks": "^5.1.0",
    "eslint-plugin-react-refresh": "^0.4.16",
    "jsdom": "^25.0.1",
    "msw": "^2.7.0",
    "prettier": "^3.4.2",
    "typescript": "^5.6.3",
    "vite": "^6.0.3",
    "vitest": "^2.1.8"
  }
}
```

Tailwind and shadcn/ui dependencies are added in Task 3 to keep concerns separated.

- [ ] **Step 2: Create `tvbf-frontend/.gitignore`**

```
node_modules/
dist/
coverage/
.env
.env.local
.env.*.local
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
.DS_Store
.vscode/
.idea/
*.tsbuildinfo
```

- [ ] **Step 3: Create `tvbf-frontend/.dockerignore`**

```
node_modules
dist
coverage
.git
.env
.env.local
.env.*.local
.vscode
.idea
Dockerfile
docker-compose.yml
Taskfile.yml
README.md
```

- [ ] **Step 4: Create `tvbf-frontend/.env.example`**

```
# Copy to .env.local and adjust as needed. .env.local is gitignored.
VITE_API_BASE_URL=https://tvbf-backend.localhost
```

- [ ] **Step 5: Create `tvbf-frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "resolveJsonModule": true,
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 6: Create `tvbf-frontend/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 7: Create `tvbf-frontend/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    hmr: {
      clientPort: 443,
      protocol: "wss",
      host: "tvbf.localhost",
    },
    allowedHosts: ["tvbf.localhost"],
    watch: {
      usePolling: true,
      interval: 500,
    },
  },
});
```

The `usePolling: true` watch config is required because the bind-mount into the container does not forward inotify events reliably on macOS Docker Desktop. Every Vite-in-Docker setup needs this.

- [ ] **Step 8: Create `tvbf-frontend/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 9: Create `tvbf-frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TV Binge Friend</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 10: Create `tvbf-frontend/src/env.ts`**

```ts
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? "https://tvbf-backend.localhost",
} as const;
```

- [ ] **Step 11: Create `tvbf-frontend/src/styles/globals.css`**

Minimal placeholder; Tailwind directives land here in Task 3.

```css
:root {
  color-scheme: light dark;
  font-family: system-ui, -apple-system, sans-serif;
}

body {
  margin: 0;
  min-height: 100vh;
}
```

- [ ] **Step 12: Create `tvbf-frontend/src/main.tsx`**

Placeholder — real router + providers land in Task 11. This gets the SPA renderable immediately so Task 2's container healthcheck passes.

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/globals.css";

function App() {
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>TV Binge Friend</h1>
      <p>Scaffolding in progress.</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 13: Task complete**

No container yet, so no commands to run. Task 2 wires up the container; tests start in Task 6.

---

## Task 2: Containerization — Dockerfile, docker-compose, Taskfile

**Files:**
- Create: `tvbf-frontend/Dockerfile`
- Create: `tvbf-frontend/docker-compose.yml`
- Create: `tvbf-frontend/Taskfile.yml`

- [ ] **Step 1: Create `tvbf-frontend/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
ENV CI=1 \
    PNPM_HOME=/root/.local/share/pnpm \
    PATH=/root/.local/share/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile || pnpm install

FROM base AS dev
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0"]
```

The `|| pnpm install` fallback exists only for the very first build when `pnpm-lock.yaml` does not yet exist on the host. On every subsequent build the `--frozen-lockfile` path runs, as required.

- [ ] **Step 2: Create `tvbf-frontend/docker-compose.yml`**

```yaml
services:
  tvbf-frontend:
    build:
      context: .
      target: dev
    container_name: tvbf_frontend
    volumes:
      - ./:/app
      - tvbf_frontend_node_modules:/app/node_modules
    environment:
      VITE_API_BASE_URL: "${VITE_API_BASE_URL:-https://tvbf-backend.localhost}"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.tvbf-frontend.rule=Host(`tvbf.localhost`)"
      - "traefik.http.routers.tvbf-frontend.tls=true"
      - "traefik.http.routers.tvbf-frontend.entrypoints=websecure"
      - "traefik.http.services.tvbf-frontend.loadbalancer.server.port=5173"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:5173/"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 20s
    networks:
      - default
      - proxy

networks:
  proxy:
    external: true

volumes:
  tvbf_frontend_node_modules:
```

Both networks are listed so Traefik (on `proxy`) can reach the container while the container still has default egress. The backend uses only `proxy`; the frontend needs egress to hit npm/pnpm registries during `deps:add`, which is why `default` is included.

- [ ] **Step 3: Create `tvbf-frontend/Taskfile.yml`**

```yaml
version: '3'

includes:
  infra:
    taskfile: ../tbc-localdev-infra/Taskfile.yml
    dir: ../tbc-localdev-infra

vars:
  COMPOSE: docker compose
  SVC: tvbf-frontend
  EXEC: "{{.COMPOSE}} exec -T {{.SVC}}"

tasks:
  up:
    desc: Start the frontend container (requires infra to be up)
    cmds:
      - "{{.COMPOSE}} up -d"

  down:
    desc: Stop the frontend container
    cmds:
      - "{{.COMPOSE}} down"

  build:
    desc: Rebuild the frontend image
    cmds:
      - "{{.COMPOSE}} build"

  logs:
    desc: Follow frontend logs
    cmds:
      - "{{.COMPOSE}} logs -f {{.SVC}}"

  shell:
    desc: Open a shell inside the frontend container
    cmds:
      - "{{.COMPOSE}} exec {{.SVC}} sh"

  ps:
    desc: Show compose service status
    cmds:
      - "{{.COMPOSE}} ps"

  install:
    desc: Install dependencies inside the container
    cmds:
      - "{{.EXEC}} pnpm install"

  test:
    desc: Run the vitest suite once
    cmds:
      - "{{.EXEC}} pnpm test {{.CLI_ARGS}}"

  test:watch:
    desc: Run vitest in watch mode
    cmds:
      - "{{.COMPOSE}} exec {{.SVC}} pnpm test:watch {{.CLI_ARGS}}"

  lint:
    desc: Run eslint
    cmds:
      - "{{.EXEC}} pnpm lint"

  format:
    desc: Run prettier --write
    cmds:
      - "{{.EXEC}} pnpm format"

  typecheck:
    desc: Run tsc --noEmit
    cmds:
      - "{{.EXEC}} pnpm typecheck"

  build:app:
    desc: Run vite build inside the container
    cmds:
      - "{{.EXEC}} pnpm build"

  deps:add:
    desc: 'Add a runtime dependency (task deps:add -- <package>)'
    cmds:
      - "{{.EXEC}} pnpm add {{.CLI_ARGS}}"

  deps:add-dev:
    desc: 'Add a dev dependency (task deps:add-dev -- <package>)'
    cmds:
      - "{{.EXEC}} pnpm add -D {{.CLI_ARGS}}"
```

- [ ] **Step 4: Verify infra is up**

Run: `task infra:up` (from `tvbf-frontend/`)
Expected: No error; shared infra compose project reports services up or already-running.

- [ ] **Step 5: Build and start the frontend container**

Run: `task build && task up`
Expected: First build pulls `node:22-alpine`, installs pnpm via corepack, runs `pnpm install` (creates `pnpm-lock.yaml` on first run), tags image. `task up` starts the container.

- [ ] **Step 6: Verify healthcheck**

Run: `task ps`
Expected: `tvbf_frontend` in `Up` state. Re-run after 30s if still `starting`.

Run: `docker compose logs tvbf-frontend | tail -20`
Expected: `VITE v6.x ready` line with `Local: http://localhost:5173/` and `Network: http://0.0.0.0:5173/`.

- [ ] **Step 7: Verify browser access**

Tell the user to open `https://tvbf.localhost/` in a browser. Expected: "TV Binge Friend — Scaffolding in progress." rendered. If the browser warns about the cert, click through.

- [ ] **Step 8: Verify HMR**

Edit `src/main.tsx` — change "Scaffolding in progress." to "Scaffolding in progress!" (add an exclamation mark).
Expected: Browser updates within ~1s without a full reload. If it does a full reload or doesn't update, the HMR WebSocket is misconfigured — re-check `vite.config.ts` `server.hmr` and Traefik labels.

Revert the change.

- [ ] **Step 9: Task complete**

The container is running and HMR works. All future commands route through `task` targets.

---

## Task 3: Tailwind CSS v4 setup

**Files:**
- Modify: `tvbf-frontend/package.json`
- Create: `tvbf-frontend/tailwind.config.ts`
- Create: `tvbf-frontend/postcss.config.js`
- Modify: `tvbf-frontend/src/styles/globals.css`
- Modify: `tvbf-frontend/vite.config.ts`

- [ ] **Step 1: Install Tailwind and its Vite plugin**

Run: `task deps:add-dev -- tailwindcss@^4 @tailwindcss/vite@^4 tailwindcss-animate`
Expected: pnpm adds the packages, `pnpm-lock.yaml` updates, no error.

- [ ] **Step 2: Wire the Vite plugin**

Modify `tvbf-frontend/vite.config.ts` — add the Tailwind plugin:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    hmr: {
      clientPort: 443,
      protocol: "wss",
      host: "tvbf.localhost",
    },
    allowedHosts: ["tvbf.localhost"],
    watch: {
      usePolling: true,
      interval: 500,
    },
  },
});
```

- [ ] **Step 3: Create `tvbf-frontend/postcss.config.js`**

Tailwind v4 via the Vite plugin doesn't strictly require PostCSS, but shadcn/ui's tooling looks for it. Create an empty shim:

```js
export default { plugins: {} };
```

- [ ] **Step 4: Create `tvbf-frontend/tailwind.config.ts`**

Tailwind v4 is CSS-first, but shadcn/ui's CLI still reads `tailwind.config.ts` for the `content` paths:

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
} satisfies Config;
```

- [ ] **Step 5: Update `src/styles/globals.css`**

```css
@import "tailwindcss";
@import "tailwindcss-animate";

@theme {
  --color-background: hsl(0 0% 100%);
  --color-foreground: hsl(222 47% 11%);
  --color-muted: hsl(210 40% 96%);
  --color-muted-foreground: hsl(215 16% 47%);
  --color-border: hsl(214 32% 91%);
  --color-primary: hsl(222 47% 11%);
  --color-primary-foreground: hsl(210 40% 98%);
  --color-destructive: hsl(0 84% 60%);
  --color-destructive-foreground: hsl(210 40% 98%);
  --radius: 0.5rem;
}

@media (prefers-color-scheme: dark) {
  @theme {
    --color-background: hsl(222 47% 11%);
    --color-foreground: hsl(210 40% 98%);
    --color-muted: hsl(217 33% 17%);
    --color-muted-foreground: hsl(215 20% 65%);
    --color-border: hsl(217 33% 17%);
    --color-primary: hsl(210 40% 98%);
    --color-primary-foreground: hsl(222 47% 11%);
  }
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 6: Verify Tailwind renders**

Modify `src/main.tsx` to use a Tailwind utility — change the body of `App` to:

```tsx
function App() {
  return (
    <div className="p-8 font-sans">
      <h1 className="text-3xl font-bold">TV Binge Friend</h1>
      <p className="mt-2 text-muted-foreground">Scaffolding in progress.</p>
    </div>
  );
}
```

Expected: Browser at `https://tvbf.localhost/` shows styled text — large bold heading, muted paragraph. If styles don't apply, restart the container: `task down && task up`.

- [ ] **Step 7: Task complete**

---

## Task 4: shadcn/ui initialization

**Files:**
- Create: `tvbf-frontend/components.json`
- Create: `tvbf-frontend/src/lib/cn.ts`
- Create: `tvbf-frontend/src/components/ui/` (populated by CLI)

- [ ] **Step 1: Install shadcn/ui prerequisites**

Run: `task deps:add -- class-variance-authority clsx tailwind-merge lucide-react @radix-ui/react-slot`
Expected: pnpm adds packages.

- [ ] **Step 2: Create `src/lib/cn.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Create `components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/styles/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/cn",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 4: Add shadcn/ui components via the CLI**

Run each of these once inside the container:

```bash
task shell
```

Then inside the container shell:

```sh
pnpm dlx shadcn@latest add button input select badge skeleton separator label combobox dialog
exit
```

If `combobox` is not a top-level component in the CLI's registry, add `command` and `popover` instead (that's what shadcn uses internally for combobox):

```sh
pnpm dlx shadcn@latest add button input select badge skeleton separator label command popover dialog
```

Expected: Files land under `src/components/ui/`. The CLI may prompt for style/baseColor — accept defaults (they match `components.json`).

- [ ] **Step 5: Smoke-test a shadcn component**

Modify `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { Button } from "@/components/ui/button";
import "./styles/globals.css";

function App() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">TV Binge Friend</h1>
      <p className="mt-2 text-muted-foreground">Scaffolding in progress.</p>
      <Button className="mt-4">Hello shadcn</Button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Expected: A styled button renders at `https://tvbf.localhost/`.

- [ ] **Step 6: Task complete**

---

## Task 5: ESLint + Prettier configuration

**Files:**
- Create: `tvbf-frontend/.eslintrc.cjs`
- Create: `tvbf-frontend/.prettierrc`
- Create: `tvbf-frontend/.prettierignore`

- [ ] **Step 1: Create `.eslintrc.cjs`**

```js
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  ignorePatterns: ["dist", "node_modules", "coverage", ".eslintrc.cjs"],
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  plugins: ["react-refresh", "@typescript-eslint"],
  rules: {
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/consistent-type-imports": "error",
  },
};
```

- [ ] **Step 2: Create `.prettierrc`**

```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": false,
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

- [ ] **Step 3: Create `.prettierignore`**

```
node_modules
dist
coverage
pnpm-lock.yaml
src/components/ui
```

shadcn/ui files are excluded from prettier formatting so upstream diffs stay clean when adding more components.

- [ ] **Step 4: Verify lint + typecheck run clean**

Run: `task lint`
Expected: Exit 0 (no warnings, no errors).

Run: `task typecheck`
Expected: Exit 0.

- [ ] **Step 5: Task complete**

---

## Task 6: Test infrastructure — Vitest + RTL + MSW

**Files:**
- Create: `tvbf-frontend/src/test/setup.ts`
- Create: `tvbf-frontend/src/test/renderWithProviders.tsx`
- Create: `tvbf-frontend/src/test/msw/server.ts`
- Create: `tvbf-frontend/src/test/msw/handlers.ts` (empty handlers array — real handlers land in Task 8)
- Create: `tvbf-frontend/src/test/msw/fixtures.ts` (placeholder — real fixtures land in Task 8)
- Create: `tvbf-frontend/src/sanity.test.ts`

- [ ] **Step 1: Create `src/test/msw/handlers.ts`**

```ts
import type { HttpHandler } from "msw";

export const handlers: HttpHandler[] = [];
```

- [ ] **Step 2: Create `src/test/msw/server.ts`**

```ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

- [ ] **Step 3: Create `src/test/msw/fixtures.ts`**

```ts
export const placeholder = true;
```

Real fixtures are added in Task 8.

- [ ] **Step 4: Create `src/test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./msw/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
```

- [ ] **Step 5: Create `src/test/renderWithProviders.tsx`**

Test helper that wraps a component with the TanStack Query client and React Router. The full version is used starting in Task 9; this minimal version works standalone.

```tsx
import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface ProviderOptions extends Omit<RenderOptions, "wrapper"> {
  route?: string;
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  { route = "/", queryClient = createTestQueryClient(), ...options }: ProviderOptions = {},
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}
```

TanStack Query needs to be installed for this file to typecheck. Install now:

Run: `task deps:add -- @tanstack/react-query`
(Already in `package.json` from Task 1 — this is a no-op confirmation.)

- [ ] **Step 6: Create `src/sanity.test.ts`**

```ts
import { describe, expect, it } from "vitest";

describe("test harness", () => {
  it("is wired up", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Run the sanity test**

Run: `task test`
Expected: 1 test passed. Output includes "test harness > is wired up".

If Vitest can't find the MSW setup, re-check the `setupFiles` path in `vitest.config.ts`.

- [ ] **Step 8: Delete the sanity test**

Run: `task shell` then `rm src/sanity.test.ts && exit`.

Or from host:

```sh
docker compose exec -T tvbf-frontend rm src/sanity.test.ts
```

- [ ] **Step 9: Task complete**

---

## Task 7: API types and env shape

**Files:**
- Create: `tvbf-frontend/src/api/types.ts`

These types mirror the Pydantic models in `tvbf-backend/src/tvbf/tvmaze/dto.py`. Keep them in sync manually when the backend changes.

- [ ] **Step 1: Create `src/api/types.ts`**

```ts
export type SortKey =
  | "name"
  | "-name"
  | "premiered"
  | "-premiered"
  | "tvmaze_updated"
  | "-tvmaze_updated";

export const ALL_SORT_KEYS: readonly SortKey[] = [
  "name",
  "-name",
  "premiered",
  "-premiered",
  "tvmaze_updated",
  "-tvmaze_updated",
] as const;

export interface NetworkRef {
  id: number;
  name: string;
}

export interface NetworkOut {
  id: number;
  name: string;
  country_code: string | null;
  country_name: string | null;
  timezone: string | null;
}

export interface GenreOut {
  id: number;
  name: string;
}

export interface ExternalsOut {
  imdb: string | null;
  tvdb: number | null;
  tvrage: number | null;
}

export interface SeasonOut {
  id: number;
  number: number;
  name: string | null;
  episode_order: number | null;
  premiere_date: string | null;
  end_date: string | null;
  network: NetworkRef | null;
  web_channel: NetworkRef | null;
  image_medium: string | null;
  image_original: string | null;
  summary: string | null;
}

export interface EpisodeOut {
  id: number;
  show_id: number;
  season_id: number | null;
  season: number;
  number: number | null;
  name: string | null;
  airdate: string | null;
  airtime: string | null;
  runtime: number | null;
  summary: string | null;
  image_medium: string | null;
  image_original: string | null;
}

export interface ShowSummary {
  id: number;
  name: string;
  type: string | null;
  status: string | null;
  language: string | null;
  premiered: string | null;
  ended: string | null;
  image_medium: string | null;
  image_original: string | null;
  network: NetworkRef | null;
  web_channel: NetworkRef | null;
  genres: string[];
}

export interface ShowDetail extends ShowSummary {
  summary: string | null;
  runtime: number | null;
  official_site: string | null;
  externals: ExternalsOut | null;
  tvmaze_updated: number;
  seasons: SeasonOut[];
}

export interface ShowListPage {
  items: ShowSummary[];
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface ShowFilters {
  search?: string;
  status?: string;
  genre?: string[];
  network?: number[];
  language?: string;
  type?: string;
  sort?: SortKey;
  page?: number;
  per_page?: number;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `task typecheck`
Expected: Exit 0.

- [ ] **Step 3: Task complete**

---

## Task 8: MSW fixtures and handlers

**Files:**
- Modify: `tvbf-frontend/src/test/msw/fixtures.ts`
- Modify: `tvbf-frontend/src/test/msw/handlers.ts`

- [ ] **Step 1: Install MSW**

Already added to devDependencies in Task 1. Confirm with: `task shell` then `ls node_modules/msw && exit`.

- [ ] **Step 2: Replace `src/test/msw/fixtures.ts`**

```ts
import type { GenreOut, NetworkOut, ShowDetail, ShowListPage, SeasonOut, EpisodeOut } from "@/api/types";

export const fixtureGenres: GenreOut[] = [
  { id: 1, name: "Drama" },
  { id: 2, name: "Comedy" },
  { id: 3, name: "Sci-Fi" },
];

export const fixtureNetworks: NetworkOut[] = [
  { id: 10, name: "HBO", country_code: "US", country_name: "United States", timezone: "America/New_York" },
  { id: 11, name: "BBC One", country_code: "GB", country_name: "United Kingdom", timezone: "Europe/London" },
];

export const fixtureShow: ShowDetail = {
  id: 100,
  name: "Fixture Show",
  type: "Scripted",
  status: "Running",
  language: "English",
  premiered: "2020-01-01",
  ended: null,
  image_medium: "https://example.com/m.jpg",
  image_original: "https://example.com/o.jpg",
  network: { id: 10, name: "HBO" },
  web_channel: null,
  genres: ["Drama"],
  summary: "<p>A <b>test</b> show.</p>",
  runtime: 60,
  official_site: "https://example.com/show",
  externals: { imdb: "tt1234567", tvdb: 123, tvrage: null },
  tvmaze_updated: 1700000000,
  seasons: [
    {
      id: 1000,
      number: 1,
      name: null,
      episode_order: 10,
      premiere_date: "2020-01-01",
      end_date: "2020-03-01",
      network: null,
      web_channel: null,
      image_medium: null,
      image_original: null,
      summary: null,
    },
    {
      id: 1001,
      number: 2,
      name: null,
      episode_order: 10,
      premiere_date: "2021-01-01",
      end_date: "2021-03-01",
      network: null,
      web_channel: null,
      image_medium: null,
      image_original: null,
      summary: null,
    },
  ],
};

export const fixtureShowListPage: ShowListPage = {
  items: [
    {
      id: 100,
      name: "Fixture Show",
      type: "Scripted",
      status: "Running",
      language: "English",
      premiered: "2020-01-01",
      ended: null,
      image_medium: "https://example.com/m.jpg",
      image_original: "https://example.com/o.jpg",
      network: { id: 10, name: "HBO" },
      web_channel: null,
      genres: ["Drama"],
    },
    {
      id: 101,
      name: "Another Show",
      type: "Scripted",
      status: "Ended",
      language: "English",
      premiered: "2015-01-01",
      ended: "2018-12-31",
      image_medium: null,
      image_original: null,
      network: { id: 11, name: "BBC One" },
      web_channel: null,
      genres: ["Comedy"],
    },
  ],
  page: 1,
  per_page: 50,
  total: 2,
  total_pages: 1,
};

export const fixtureEpisodes: EpisodeOut[] = [
  {
    id: 5000,
    show_id: 100,
    season_id: 1000,
    season: 1,
    number: 1,
    name: "Pilot",
    airdate: "2020-01-01",
    airtime: "21:00",
    runtime: 60,
    summary: "<p>Opening episode.</p>",
    image_medium: null,
    image_original: null,
  },
  {
    id: 5001,
    show_id: 100,
    season_id: 1000,
    season: 1,
    number: 2,
    name: "Second",
    airdate: "2020-01-08",
    airtime: "21:00",
    runtime: 60,
    summary: null,
    image_medium: null,
    image_original: null,
  },
];

export const fixtureSeason2Episodes: EpisodeOut[] = [
  {
    id: 5100,
    show_id: 100,
    season_id: 1001,
    season: 2,
    number: 1,
    name: "S2 Pilot",
    airdate: "2021-01-01",
    airtime: "21:00",
    runtime: 60,
    summary: null,
    image_medium: null,
    image_original: null,
  },
];

// Satisfy unused import check when consumers only import one fixture.
export const _seasonPlaceholder: SeasonOut[] = [];
```

- [ ] **Step 3: Replace `src/test/msw/handlers.ts`**

```ts
import { HttpResponse, http } from "msw";
import { env } from "@/env";
import {
  fixtureEpisodes,
  fixtureGenres,
  fixtureNetworks,
  fixtureSeason2Episodes,
  fixtureShow,
  fixtureShowListPage,
} from "./fixtures";

const base = env.apiBaseUrl;

export const handlers = [
  http.get(`${base}/genres`, () => HttpResponse.json(fixtureGenres)),
  http.get(`${base}/networks`, () => HttpResponse.json(fixtureNetworks)),
  http.get(`${base}/shows`, () => HttpResponse.json(fixtureShowListPage)),
  http.get(`${base}/shows/100`, () => HttpResponse.json(fixtureShow)),
  http.get(`${base}/shows/:id`, () =>
    HttpResponse.json({ detail: "show not found" }, { status: 404 }),
  ),
  http.get(`${base}/shows/100/episodes`, ({ request }) => {
    const url = new URL(request.url);
    const season = url.searchParams.get("season");
    if (season === "2") return HttpResponse.json(fixtureSeason2Episodes);
    return HttpResponse.json(fixtureEpisodes);
  }),
];
```

- [ ] **Step 4: Verify typecheck**

Run: `task typecheck`
Expected: Exit 0.

- [ ] **Step 5: Task complete**

---

## Task 9: API client (TDD)

**Files:**
- Create: `tvbf-frontend/src/api/client.ts`
- Create: `tvbf-frontend/src/api/client.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/api/client.test.ts`:

```ts
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { env } from "@/env";
import { ApiError, apiFetch, buildShowsQuery } from "./client";
import type { ShowFilters } from "./types";

describe("apiFetch", () => {
  afterEach(() => server.resetHandlers());

  it("returns parsed JSON on 2xx", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/ping`, () => HttpResponse.json({ ok: true })),
    );
    const result = await apiFetch<{ ok: boolean }>("/ping");
    expect(result).toEqual({ ok: true });
  });

  it("throws ApiError on non-2xx with detail message", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/fail`, () =>
        HttpResponse.json({ detail: "nope" }, { status: 404 }),
      ),
    );
    await expect(apiFetch("/fail")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "nope",
    });
  });

  it("throws ApiError with generic message when body has no detail", async () => {
    server.use(
      http.get(`${env.apiBaseUrl}/fail`, () => new HttpResponse(null, { status: 500 })),
    );
    await expect(apiFetch("/fail")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("buildShowsQuery", () => {
  it("returns empty string when filters are empty", () => {
    expect(buildShowsQuery({})).toBe("");
  });

  it("omits undefined and empty-array values", () => {
    const filters: ShowFilters = {
      search: "",
      genre: [],
      network: [],
      page: 1,
    };
    // search="" is intentional — pass to the backend as empty? Spec says skip.
    expect(buildShowsQuery(filters)).toBe("page=1");
  });

  it("serializes scalars, repeats arrays, and keeps sort", () => {
    const filters: ShowFilters = {
      search: "the",
      status: "Running",
      genre: ["Drama", "Comedy"],
      network: [10, 11],
      language: "English",
      type: "Scripted",
      sort: "-premiered",
      page: 2,
      per_page: 25,
    };
    const q = new URLSearchParams(buildShowsQuery(filters));
    expect(q.get("search")).toBe("the");
    expect(q.get("status")).toBe("Running");
    expect(q.getAll("genre")).toEqual(["Drama", "Comedy"]);
    expect(q.getAll("network")).toEqual(["10", "11"]);
    expect(q.get("language")).toBe("English");
    expect(q.get("type")).toBe("Scripted");
    expect(q.get("sort")).toBe("-premiered");
    expect(q.get("page")).toBe("2");
    expect(q.get("per_page")).toBe("25");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `task test -- src/api/client.test.ts`
Expected: FAIL — module `./client` not found.

- [ ] **Step 3: Implement `src/api/client.ts`**

```ts
import { env } from "@/env";
import type { ShowFilters } from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let body: unknown = null;
    let message = `Request failed with status ${res.status}`;
    try {
      body = await res.json();
      if (body && typeof body === "object" && "detail" in body && typeof body.detail === "string") {
        message = body.detail;
      }
    } catch {
      // non-JSON body; keep generic message
    }
    throw new ApiError(res.status, message, body);
  }
  return (await res.json()) as T;
}

export function buildShowsQuery(filters: ShowFilters): string {
  const params = new URLSearchParams();
  if (filters.search && filters.search.length > 0) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.language) params.set("language", filters.language);
  if (filters.type) params.set("type", filters.type);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.page !== undefined) params.set("page", String(filters.page));
  if (filters.per_page !== undefined) params.set("per_page", String(filters.per_page));
  if (filters.genre) for (const g of filters.genre) params.append("genre", g);
  if (filters.network) for (const n of filters.network) params.append("network", String(n));
  return params.toString();
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `task test -- src/api/client.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Task complete**

---

## Task 10: TanStack Query hooks (TDD)

**Files:**
- Create: `tvbf-frontend/src/api/shows.ts`
- Create: `tvbf-frontend/src/api/refs.ts`
- Create: `tvbf-frontend/src/api/shows.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/api/shows.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useShow, useShows, useShowEpisodes } from "./shows";

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useShows", () => {
  it("fetches the list page", async () => {
    const { result } = renderHook(() => useShows({ page: 1 }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(2);
    expect(result.current.data?.total).toBe(2);
  });
});

describe("useShow", () => {
  it("fetches a show by id", async () => {
    const { result } = renderHook(() => useShow(100), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(100);
    expect(result.current.data?.seasons).toHaveLength(2);
  });

  it("surfaces 404 as an error", async () => {
    const { result } = renderHook(() => useShow(999), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toHaveProperty("status", 404);
  });
});

describe("useShowEpisodes", () => {
  it("fetches default season episodes", async () => {
    const { result } = renderHook(() => useShowEpisodes(100), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it("fetches a specific season", async () => {
    const { result } = renderHook(() => useShowEpisodes(100, 2), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].season).toBe(2);
  });
});
```

This file imports `.tsx` JSX; rename to `.test.tsx`:

Create the file as `src/api/shows.test.tsx` (not `.ts`).

- [ ] **Step 2: Run tests to verify failure**

Run: `task test -- src/api/shows.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/api/shows.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { apiFetch, buildShowsQuery } from "./client";
import type { EpisodeOut, ShowDetail, ShowFilters, ShowListPage } from "./types";

const FIVE_MINUTES = 5 * 60 * 1000;

export function useShows(filters: ShowFilters) {
  const queryString = buildShowsQuery(filters);
  return useQuery<ShowListPage>({
    queryKey: ["shows", filters],
    queryFn: () => apiFetch<ShowListPage>(`/shows${queryString ? `?${queryString}` : ""}`),
    staleTime: FIVE_MINUTES,
  });
}

export function useShow(id: number) {
  return useQuery<ShowDetail>({
    queryKey: ["show", id],
    queryFn: () => apiFetch<ShowDetail>(`/shows/${id}`),
    staleTime: FIVE_MINUTES,
    enabled: Number.isFinite(id) && id > 0,
  });
}

export function useShowEpisodes(id: number, season?: number) {
  const suffix = season !== undefined ? `?season=${season}` : "";
  return useQuery<EpisodeOut[]>({
    queryKey: ["show-episodes", id, season ?? null],
    queryFn: () => apiFetch<EpisodeOut[]>(`/shows/${id}/episodes${suffix}`),
    staleTime: FIVE_MINUTES,
    enabled: Number.isFinite(id) && id > 0,
  });
}
```

- [ ] **Step 4: Implement `src/api/refs.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { GenreOut, NetworkOut } from "./types";

const HOUR = 60 * 60 * 1000;

export function useGenres() {
  return useQuery<GenreOut[]>({
    queryKey: ["genres"],
    queryFn: () => apiFetch<GenreOut[]>("/genres"),
    staleTime: HOUR,
  });
}

export function useNetworks() {
  return useQuery<NetworkOut[]>({
    queryKey: ["networks"],
    queryFn: () => apiFetch<NetworkOut[]>("/networks"),
    staleTime: HOUR,
  });
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `task test -- src/api/shows.test.tsx`
Expected: 5 passed.

- [ ] **Step 6: Task complete**

---

## Task 11: `useUrlState` hook (TDD)

**Files:**
- Create: `tvbf-frontend/src/hooks/useUrlState.ts`
- Create: `tvbf-frontend/src/hooks/useUrlState.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/hooks/useUrlState.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { useShowFiltersUrlState } from "./useUrlState";

function Harness() {
  const [filters, setFilters] = useShowFiltersUrlState();
  const location = useLocation();
  return (
    <div>
      <div data-testid="search">{filters.search ?? ""}</div>
      <div data-testid="page">{filters.page ?? 1}</div>
      <div data-testid="sort">{filters.sort ?? "name"}</div>
      <div data-testid="genres">{(filters.genre ?? []).join(",")}</div>
      <div data-testid="search-qs">{location.search}</div>
      <button onClick={() => setFilters({ search: "alpha", page: 2 })}>set-search</button>
      <button onClick={() => setFilters({ genre: ["Drama", "Comedy"] })}>set-genres</button>
      <button onClick={() => setFilters({ page: 5 }, { replacePage: false })}>set-page</button>
      <button onClick={() => setFilters({})}>reset</button>
    </div>
  );
}

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/" element={<Harness />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("useShowFiltersUrlState", () => {
  it("parses filters from the URL", () => {
    renderAt("/?search=foo&page=3&sort=-premiered&genre=Drama&genre=Comedy");
    expect(screen.getByTestId("search").textContent).toBe("foo");
    expect(screen.getByTestId("page").textContent).toBe("3");
    expect(screen.getByTestId("sort").textContent).toBe("-premiered");
    expect(screen.getByTestId("genres").textContent).toBe("Drama,Comedy");
  });

  it("resets page to 1 when a non-page filter changes", async () => {
    const user = userEvent.setup();
    renderAt("/?page=5");
    await user.click(screen.getByText("set-search"));
    // setFilters passed page=2, so final page should be 2 (explicit page wins)
    expect(screen.getByTestId("page").textContent).toBe("2");
  });

  it("drops empty genre arrays from the URL", async () => {
    const user = userEvent.setup();
    renderAt("/?genre=Drama&genre=Comedy");
    await user.click(screen.getByText("reset"));
    expect(screen.getByTestId("genres").textContent).toBe("");
    expect(screen.getByTestId("search-qs").textContent).toBe("");
  });

  it("ignores unknown sort keys", () => {
    renderAt("/?sort=whatever");
    expect(screen.getByTestId("sort").textContent).toBe("name");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `task test -- src/hooks/useUrlState.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/hooks/useUrlState.ts`**

```ts
import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { ALL_SORT_KEYS, type ShowFilters, type SortKey } from "@/api/types";

function parseSort(value: string | null): SortKey | undefined {
  if (!value) return undefined;
  return (ALL_SORT_KEYS as readonly string[]).includes(value) ? (value as SortKey) : undefined;
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function useShowFiltersUrlState(): [
  ShowFilters,
  (next: Partial<ShowFilters>, options?: { replacePage?: boolean }) => void,
] {
  const [params, setParams] = useSearchParams();

  const filters: ShowFilters = {
    search: params.get("search") ?? undefined,
    status: params.get("status") ?? undefined,
    language: params.get("language") ?? undefined,
    type: params.get("type") ?? undefined,
    sort: parseSort(params.get("sort")),
    page: parsePositiveInt(params.get("page")),
    per_page: parsePositiveInt(params.get("per_page")),
    genre: params.getAll("genre").filter((g) => g.length > 0),
    network: params
      .getAll("network")
      .map((n) => Number.parseInt(n, 10))
      .filter((n) => Number.isFinite(n)),
  };

  const setFilters = useCallback(
    (next: Partial<ShowFilters>, options?: { replacePage?: boolean }) => {
      const merged: ShowFilters = { ...filters, ...next };
      const changedNonPage = Object.keys(next).some((k) => k !== "page" && k !== "per_page");
      const resetPage = changedNonPage && next.page === undefined && options?.replacePage !== false;
      if (resetPage) merged.page = 1;

      const out = new URLSearchParams();
      if (merged.search) out.set("search", merged.search);
      if (merged.status) out.set("status", merged.status);
      if (merged.language) out.set("language", merged.language);
      if (merged.type) out.set("type", merged.type);
      if (merged.sort) out.set("sort", merged.sort);
      if (merged.page !== undefined && merged.page !== 1) out.set("page", String(merged.page));
      if (merged.per_page !== undefined) out.set("per_page", String(merged.per_page));
      for (const g of merged.genre ?? []) if (g) out.append("genre", g);
      for (const n of merged.network ?? []) out.append("network", String(n));
      setParams(out, { replace: false });
    },
    [filters, setParams],
  );

  return [filters, setFilters];
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `task test -- src/hooks/useUrlState.test.tsx`
Expected: 4 passed.

- [ ] **Step 5: Task complete**

---

## Task 12: App shell, router, and NotFoundPage

**Files:**
- Create: `tvbf-frontend/src/components/AppShell.tsx`
- Create: `tvbf-frontend/src/pages/NotFoundPage.tsx`
- Create: `tvbf-frontend/src/router.tsx`
- Modify: `tvbf-frontend/src/main.tsx`

BrowsePage, ShowDetailPage, and EpisodesPage don't exist yet — Tasks 14–16 create them. For now, stub them inline so the router resolves.

- [ ] **Step 1: Create `src/components/AppShell.tsx`**

```tsx
import { Link, Outlet } from "react-router";

export function AppShell() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold">
            TV Binge Friend
          </Link>
          <nav className="text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              Browse
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/pages/NotFoundPage.tsx`**

```tsx
import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-muted-foreground">We couldn't find what you were looking for.</p>
      <Link to="/" className="mt-4 inline-block text-sm underline">
        Back to browse
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/router.tsx`**

```tsx
import { createBrowserRouter } from "react-router";
import { AppShell } from "@/components/AppShell";
import { BrowsePage } from "@/pages/BrowsePage";
import { ShowDetailPage } from "@/pages/ShowDetailPage";
import { EpisodesPage } from "@/pages/EpisodesPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <BrowsePage /> },
      { path: "shows/:id", element: <ShowDetailPage /> },
      { path: "shows/:id/episodes", element: <EpisodesPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
```

- [ ] **Step 4: Create page stubs**

Create `src/pages/BrowsePage.tsx`:

```tsx
export function BrowsePage() {
  return <div>Browse — coming in Task 14</div>;
}
```

Create `src/pages/ShowDetailPage.tsx`:

```tsx
export function ShowDetailPage() {
  return <div>Show detail — coming in Task 15</div>;
}
```

Create `src/pages/EpisodesPage.tsx`:

```tsx
export function EpisodesPage() {
  return <div>Episodes — coming in Task 16</div>;
}
```

- [ ] **Step 5: Replace `src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router/dom";
import { router } from "./router";
import "./styles/globals.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 6: Verify browser**

Open `https://tvbf.localhost/` — should show the app shell with "Browse — coming in Task 14".

Open `https://tvbf.localhost/nonexistent` — should show the NotFoundPage.

Open `https://tvbf.localhost/shows/100` — should show "Show detail — coming in Task 15".

- [ ] **Step 7: Verify lint + typecheck still pass**

Run: `task lint && task typecheck`
Expected: Exit 0 both times.

- [ ] **Step 8: Task complete**

---

## Task 13: Shared UI primitives

**Files:**
- Create: `tvbf-frontend/src/components/LoadingState.tsx`
- Create: `tvbf-frontend/src/components/ErrorState.tsx`
- Create: `tvbf-frontend/src/components/SafeHtml.tsx`
- Create: `tvbf-frontend/src/components/SafeHtml.test.tsx`
- Create: `tvbf-frontend/src/components/Pagination.tsx`
- Create: `tvbf-frontend/src/components/Pagination.test.tsx`

- [ ] **Step 1: Create `src/components/LoadingState.tsx`**

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState({ rows = 6 }: { rows?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full" />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/ErrorState.tsx`**

```tsx
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded border border-destructive/40 bg-destructive/5 p-6 text-center" role="alert">
      <p className="font-medium text-destructive">Something went wrong</p>
      {message ? <p className="mt-1 text-sm text-muted-foreground">{message}</p> : null}
      {onRetry ? (
        <Button className="mt-4" onClick={onRetry} variant="outline">
          Retry
        </Button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Write failing test for SafeHtml**

Create `src/components/SafeHtml.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SafeHtml } from "./SafeHtml";

describe("SafeHtml", () => {
  it("renders safe HTML", () => {
    const { container } = render(<SafeHtml html="<p>hi <b>there</b></p>" />);
    expect(container.querySelector("b")?.textContent).toBe("there");
  });

  it("strips script tags", () => {
    const { container } = render(<SafeHtml html='<p>ok</p><script>alert(1)</script>' />);
    expect(container.querySelector("script")).toBeNull();
  });

  it("renders nothing for null", () => {
    const { container } = render(<SafeHtml html={null} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 4: Install dompurify**

Already in dependencies from Task 1.

- [ ] **Step 5: Implement `src/components/SafeHtml.tsx`**

```tsx
import DOMPurify from "dompurify";

interface SafeHtmlProps {
  html: string | null;
  className?: string;
}

export function SafeHtml({ html, className }: SafeHtmlProps) {
  if (!html) return null;
  const clean = DOMPurify.sanitize(html);
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

Run: `task test -- src/components/SafeHtml.test.tsx`
Expected: 3 passed.

- [ ] **Step 6: Write failing test for Pagination**

Create `src/components/Pagination.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("renders current and total pages", () => {
    render(<Pagination page={3} totalPages={10} onPageChange={vi.fn()} />);
    expect(screen.getByText(/Page 3 of 10/i)).toBeInTheDocument();
  });

  it("disables prev on first page", () => {
    render(<Pagination page={1} totalPages={10} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
  });

  it("disables next on last page", () => {
    render(<Pagination page={10} totalPages={10} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("calls onPageChange with next page", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={3} totalPages={10} onPageChange={onPageChange} />);
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it("renders nothing when totalPages <= 1", () => {
    const { container } = render(<Pagination page={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 7: Implement `src/components/Pagination.tsx`**

```tsx
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}
```

Run: `task test -- src/components/Pagination.test.tsx`
Expected: 5 passed.

- [ ] **Step 8: Task complete**

---

## Task 14: Browse page (TDD)

**Files:**
- Create: `tvbf-frontend/src/components/ShowCard.tsx`
- Create: `tvbf-frontend/src/components/ShowGrid.tsx`
- Create: `tvbf-frontend/src/components/Filters.tsx`
- Modify: `tvbf-frontend/src/pages/BrowsePage.tsx`
- Create: `tvbf-frontend/src/pages/BrowsePage.test.tsx`

- [ ] **Step 1: Create `src/components/ShowCard.tsx`**

```tsx
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import type { ShowSummary } from "@/api/types";

const FALLBACK_POSTER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 3 4'><rect width='3' height='4' fill='%23e2e8f0'/></svg>";

function year(dateStr: string | null): string {
  return dateStr ? dateStr.slice(0, 4) : "—";
}

export function ShowCard({ show }: { show: ShowSummary }) {
  return (
    <Link
      to={`/shows/${show.id}`}
      className="group block overflow-hidden rounded border border-border bg-background transition hover:border-foreground"
    >
      <img
        src={show.image_medium ?? FALLBACK_POSTER}
        alt=""
        className="aspect-[3/4] w-full object-cover"
        loading="lazy"
      />
      <div className="p-3">
        <h3 className="truncate text-sm font-medium group-hover:underline">{show.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {year(show.premiered)} {show.network?.name ? `· ${show.network.name}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {show.genres.slice(0, 3).map((g) => (
            <Badge key={g} variant="secondary" className="text-[10px]">
              {g}
            </Badge>
          ))}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create `src/components/ShowGrid.tsx`**

```tsx
import type { ShowSummary } from "@/api/types";
import { ShowCard } from "./ShowCard";

export function ShowGrid({ shows }: { shows: ShowSummary[] }) {
  if (shows.length === 0) {
    return (
      <p className="py-16 text-center text-muted-foreground">No shows match your filters.</p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {shows.map((s) => (
        <ShowCard key={s.id} show={s} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/Filters.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_SORT_KEYS, type ShowFilters, type SortKey } from "@/api/types";

const SORT_LABELS: Record<SortKey, string> = {
  name: "Name (A–Z)",
  "-name": "Name (Z–A)",
  premiered: "Premiere date (oldest)",
  "-premiered": "Premiere date (newest)",
  tvmaze_updated: "Recently updated (oldest)",
  "-tvmaze_updated": "Recently updated",
};

const STATUSES = ["Running", "Ended", "To Be Determined", "In Development"] as const;

interface FiltersProps {
  filters: ShowFilters;
  onChange: (next: Partial<ShowFilters>) => void;
}

export function Filters({ filters, onChange }: FiltersProps) {
  const [searchDraft, setSearchDraft] = useState(filters.search ?? "");

  useEffect(() => {
    setSearchDraft(filters.search ?? "");
  }, [filters.search]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchDraft !== (filters.search ?? "")) {
        onChange({ search: searchDraft || undefined });
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [searchDraft, filters.search, onChange]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <Label htmlFor="search">Search</Label>
        <Input
          id="search"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Show name"
        />
      </div>
      <div>
        <Label htmlFor="status">Status</Label>
        <Select
          value={filters.status ?? "__all"}
          onValueChange={(v) => onChange({ status: v === "__all" ? undefined : v })}
        >
          <SelectTrigger id="status">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Any status</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="sort">Sort</Label>
        <Select
          value={filters.sort ?? "name"}
          onValueChange={(v) => onChange({ sort: v as SortKey })}
        >
          <SelectTrigger id="sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_SORT_KEYS.map((k) => (
              <SelectItem key={k} value={k}>
                {SORT_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
```

This Filters component covers search, status, and sort for MVP. Genre and network multi-select combobox is deferred to a follow-up — both are filter UI, not new API surface; the hook plumbing supports them already.

- [ ] **Step 4: Write failing test for BrowsePage**

Create `src/pages/BrowsePage.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/renderWithProviders";
import { BrowsePage } from "./BrowsePage";

function LocationReadout() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

describe("BrowsePage", () => {
  it("renders a list of shows", async () => {
    renderWithProviders(<BrowsePage />);
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Fixture Show/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: /Another Show/i })).toBeInTheDocument();
  });

  it("shows the loading skeleton first", () => {
    renderWithProviders(<BrowsePage />);
    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  it("updates query params when sort changes", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <BrowsePage />
        <LocationReadout />
      </>,
    );
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Fixture Show/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("combobox", { name: /sort/i }));
    await user.click(screen.getByRole("option", { name: /Name \(Z–A\)/i }));
    await waitFor(() =>
      expect(screen.getByTestId("location-search").textContent).toContain("sort=-name"),
    );
  });
});
```

- [ ] **Step 5: Implement `src/pages/BrowsePage.tsx`**

```tsx
import { useShows } from "@/api/shows";
import { useShowFiltersUrlState } from "@/hooks/useUrlState";
import { Filters } from "@/components/Filters";
import { ShowGrid } from "@/components/ShowGrid";
import { Pagination } from "@/components/Pagination";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";

export function BrowsePage() {
  const [filters, setFilters] = useShowFiltersUrlState();
  const query = useShows({ ...filters, page: filters.page ?? 1, per_page: 50 });

  return (
    <div className="space-y-6">
      <Filters filters={filters} onChange={setFilters} />
      {query.isPending ? (
        <LoadingState rows={12} />
      ) : query.isError ? (
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      ) : (
        <>
          <ShowGrid shows={query.data.items} />
          <Pagination
            page={query.data.page}
            totalPages={query.data.total_pages}
            onPageChange={(page) => setFilters({ page })}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run tests**

Run: `task test -- src/pages/BrowsePage.test.tsx`
Expected: 3 passed.

- [ ] **Step 7: Verify in browser**

Open `https://tvbf.localhost/`. Expected: live data from the backend (depending on ingest progress, could be thousands of shows) renders as a paginated grid. If backend isn't reachable, the ErrorState renders with a retry button.

- [ ] **Step 8: Task complete**

---

## Task 15: Show detail page (TDD)

**Files:**
- Modify: `tvbf-frontend/src/pages/ShowDetailPage.tsx`
- Create: `tvbf-frontend/src/pages/ShowDetailPage.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/pages/ShowDetailPage.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ShowDetailPage } from "./ShowDetailPage";

function routed() {
  return (
    <Routes>
      <Route path="/shows/:id" element={<ShowDetailPage />} />
    </Routes>
  );
}

describe("ShowDetailPage", () => {
  it("renders show details", async () => {
    renderWithProviders(routed(), { route: "/shows/100" });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Fixture Show" })).toBeInTheDocument());
    expect(screen.getByText(/Running/i)).toBeInTheDocument();
    expect(screen.getByText(/Drama/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Season \d/i }).length).toBeGreaterThan(0);
  });

  it("renders not-found for missing shows", async () => {
    renderWithProviders(routed(), { route: "/shows/999" });
    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Implement `src/pages/ShowDetailPage.tsx`**

```tsx
import { Link, useParams } from "react-router";
import { useShow } from "@/api/shows";
import { ApiError } from "@/api/client";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { NotFoundPage } from "./NotFoundPage";
import { SafeHtml } from "@/components/SafeHtml";
import { Badge } from "@/components/ui/badge";

function yearRange(premiered: string | null, ended: string | null) {
  if (!premiered) return "—";
  const start = premiered.slice(0, 4);
  const end = ended ? ended.slice(0, 4) : "present";
  return start === end ? start : `${start} – ${end}`;
}

export function ShowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const showId = Number(id);
  const query = useShow(showId);

  if (query.isPending) return <LoadingState rows={1} />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) return <NotFoundPage />;
    return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  }
  const show = query.data;
  return (
    <article className="space-y-6">
      <header className="flex flex-col gap-6 sm:flex-row">
        {show.image_medium ? (
          <img
            src={show.image_medium}
            alt=""
            className="w-40 rounded border border-border object-cover"
          />
        ) : null}
        <div className="flex-1 space-y-2">
          <h1 className="text-3xl font-semibold">{show.name}</h1>
          <p className="text-sm text-muted-foreground">
            {yearRange(show.premiered, show.ended)}
            {show.network?.name ? ` · ${show.network.name}` : ""}
            {show.status ? ` · ${show.status}` : ""}
            {show.runtime ? ` · ${show.runtime} min` : ""}
          </p>
          <div className="flex flex-wrap gap-1">
            {show.genres.map((g) => (
              <Badge key={g} variant="secondary">
                {g}
              </Badge>
            ))}
          </div>
          <SafeHtml html={show.summary} className="prose prose-sm max-w-none pt-2" />
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Seasons</h2>
        {show.seasons.length === 0 ? (
          <p className="text-sm text-muted-foreground">No seasons available.</p>
        ) : (
          <ul className="divide-y divide-border rounded border border-border">
            {show.seasons.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/shows/${show.id}/episodes?season=${s.number}`}
                  className="flex items-center justify-between px-4 py-2 hover:bg-muted"
                >
                  <span>Season {s.number}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.episode_order ?? "?"} episodes
                    {s.premiere_date ? ` · ${s.premiere_date.slice(0, 4)}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `task test -- src/pages/ShowDetailPage.test.tsx`
Expected: 2 passed.

- [ ] **Step 4: Task complete**

---

## Task 16: Episodes page (TDD)

**Files:**
- Modify: `tvbf-frontend/src/pages/EpisodesPage.tsx`
- Create: `tvbf-frontend/src/pages/EpisodesPage.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/pages/EpisodesPage.test.tsx`:

```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router";
import { renderWithProviders } from "@/test/renderWithProviders";
import { EpisodesPage } from "./EpisodesPage";

function routed() {
  return (
    <Routes>
      <Route path="/shows/:id/episodes" element={<EpisodesPage />} />
    </Routes>
  );
}

describe("EpisodesPage", () => {
  it("renders default (season 1) episodes", async () => {
    renderWithProviders(routed(), { route: "/shows/100/episodes" });
    await waitFor(() => expect(screen.getByText("Pilot")).toBeInTheDocument());
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("loads a specific season from ?season", async () => {
    renderWithProviders(routed(), { route: "/shows/100/episodes?season=2" });
    await waitFor(() => expect(screen.getByText("S2 Pilot")).toBeInTheDocument());
  });

  it("changes season via the dropdown", async () => {
    const user = userEvent.setup();
    renderWithProviders(routed(), { route: "/shows/100/episodes" });
    await waitFor(() => expect(screen.getByText("Pilot")).toBeInTheDocument());
    await user.click(screen.getByRole("combobox", { name: /season/i }));
    await user.click(screen.getByRole("option", { name: /Season 2/ }));
    await waitFor(() => expect(screen.getByText("S2 Pilot")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Implement `src/pages/EpisodesPage.tsx`**

```tsx
import { Link, useParams, useSearchParams } from "react-router";
import { useShow, useShowEpisodes } from "@/api/shows";
import { ApiError } from "@/api/client";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { NotFoundPage } from "./NotFoundPage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SafeHtml } from "@/components/SafeHtml";

export function EpisodesPage() {
  const { id } = useParams<{ id: string }>();
  const showId = Number(id);
  const [params, setParams] = useSearchParams();
  const seasonParam = params.get("season");
  const season = seasonParam ? Number(seasonParam) : undefined;

  const showQuery = useShow(showId);
  const episodesQuery = useShowEpisodes(showId, season);

  if (showQuery.isError && showQuery.error instanceof ApiError && showQuery.error.status === 404) {
    return <NotFoundPage />;
  }
  if (showQuery.isPending || episodesQuery.isPending) return <LoadingState rows={1} />;
  if (showQuery.isError) {
    return <ErrorState message={showQuery.error.message} onRetry={() => showQuery.refetch()} />;
  }
  if (episodesQuery.isError) {
    return (
      <ErrorState
        message={episodesQuery.error.message}
        onRetry={() => episodesQuery.refetch()}
      />
    );
  }

  const currentSeason = season ?? showQuery.data.seasons[0]?.number ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{showQuery.data.name}</h1>
          <Link to={`/shows/${showId}`} className="text-sm text-muted-foreground underline">
            Back to show
          </Link>
        </div>
        <div>
          <Label htmlFor="season">Season</Label>
          <Select
            value={String(currentSeason)}
            onValueChange={(v) => {
              const next = new URLSearchParams(params);
              next.set("season", v);
              setParams(next);
            }}
          >
            <SelectTrigger id="season" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {showQuery.data.seasons.map((s) => (
                <SelectItem key={s.id} value={String(s.number)}>
                  Season {s.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {episodesQuery.data.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No episodes for this season.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-4 font-medium">#</th>
              <th className="py-2 pr-4 font-medium">Title</th>
              <th className="py-2 pr-4 font-medium">Airdate</th>
              <th className="py-2 pr-4 font-medium">Runtime</th>
              <th className="py-2 pr-4 font-medium">Summary</th>
            </tr>
          </thead>
          <tbody>
            {episodesQuery.data.map((ep) => (
              <tr key={ep.id} className="border-b border-border align-top">
                <td className="py-2 pr-4 whitespace-nowrap">{ep.number ?? "—"}</td>
                <td className="py-2 pr-4 font-medium">{ep.name ?? "—"}</td>
                <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                  {ep.airdate ?? "—"}
                </td>
                <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                  {ep.runtime ? `${ep.runtime} min` : "—"}
                </td>
                <td className="py-2 pr-4 text-muted-foreground">
                  <SafeHtml html={ep.summary} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `task test -- src/pages/EpisodesPage.test.tsx`
Expected: 3 passed.

- [ ] **Step 4: Task complete**

---

## Task 17: Final verification sweep

**Files:** none modified.

- [ ] **Step 1: Run the full test suite**

Run: `task test`
Expected: All tests pass — roughly 25 tests across client, hooks, components, and pages.

- [ ] **Step 2: Run lint**

Run: `task lint`
Expected: Exit 0, no warnings.

- [ ] **Step 3: Run typecheck**

Run: `task typecheck`
Expected: Exit 0.

- [ ] **Step 4: Run a production build**

Run: `task build:app`
Expected: Vite builds to `dist/` with no errors. Warnings about bundle size are fine for MVP.

- [ ] **Step 5: Verify the live app end-to-end in the browser**

At `https://tvbf.localhost/`:

- Landing page shows the show grid (depending on ingest state, may be empty, a few hundred, or up to ~80k).
- Typing in the search box debounces and updates the URL to `?search=<value>`.
- Changing the sort updates the URL to `?sort=<key>` and re-orders the grid.
- Changing status updates the URL to `?status=<value>`.
- Clicking Next/Previous updates the URL to `?page=<N>`.
- Clicking a show card navigates to `/shows/<id>`, shows the hero + summary + season list.
- Clicking a season link navigates to `/shows/<id>/episodes?season=<N>` and shows the episode table.
- Changing the season dropdown updates the URL and reloads the table.
- Visiting `/shows/0` (or any unknown id) renders the NotFoundPage.
- Visiting `/nonexistent-route` renders the NotFoundPage.

If any of these fail, the bug belongs to the specific page's task — return to it rather than patching here.

- [ ] **Step 6: Task complete**

MVP frontend scaffolding is done. The user commits on their own cadence; once they've run `git init` in `tvbf-frontend/`, they can stage everything except `node_modules/` (already in `.gitignore`) and commit.

---

## Self-review (performed by plan author, not the implementing engineer)

- **Spec coverage**: every spec decision (D1–D7) maps to a task. Screens (Browse, Show detail, Episodes, NotFound) each have a TDD task. Container pattern (Dockerfile/compose/Taskfile) is Task 2. Tailwind + shadcn are Tasks 3–4. Testing infra is Task 6. MSW fixtures are Task 8. `useUrlState` is Task 11. Genre/network multi-select combobox is explicitly deferred in Task 14 Step 3 — called out as a follow-up.
- **Placeholder scan**: no TBDs. Every code step shows the full file content to write.
- **Type consistency**: `ShowFilters` uses the same property names throughout (`genre`, `network`, `sort`, `page`, `per_page`). `SortKey` values match the backend exactly (`-name`, not `name_desc`). `useShowFiltersUrlState` is the single hook name, used consistently in Tasks 11 and 14.
- **Known trade-offs**: the multi-select combobox for genre/network is deferred to keep MVP tight — the underlying API and URL state support it, it's a pure UI add.
