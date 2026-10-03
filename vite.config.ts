import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "node:path";

// Where the dev server forwards `/api/*`, stripped of the prefix. Unset under
// Traefik, where the SPA calls https://api.tvbf.localhost directly. Set by a dev
// environment that exposes only this server's origin (a Coder workspace): the
// browser calls `/api` on the page's own origin (VITE_API_BASE_URL=/api), so
// there is no CORS and the backend's host-only session cookie lands on it.
const apiProxyTarget = process.env.API_PROXY_TARGET;

// Upload source maps + create a Sentry release only when an auth token is present
// (set in the prod build environment). Local/dev builds have no token and skip upload.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

// This build's id (NEU-1504): the commit SHA where the build sets one, else a
// per-build timestamp. Compiled into the bundle as __APP_VERSION__ and written
// to dist/version.json, which useVersionCheck compares on returning to the
// foreground. Build only — dev defines neither, so the check stays inert there.
const appVersion = process.env.VITE_GIT_SHA || String(Date.now());

function versionJson(): Plugin {
  return {
    name: "tvbf-version-json",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ version: appVersion }),
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  define: command === "build" ? { __APP_VERSION__: JSON.stringify(appVersion) } : {},
  // "hidden" emits source maps (so the Sentry plugin can upload them) but omits the
  // //# sourceMappingURL= comment — otherwise the build would reference a map that
  // filesToDeleteAfterUpload has already removed. Sentry still resolves via debug IDs.
  build: { sourcemap: sentryAuthToken ? "hidden" : false },
  plugins: [
    react(),
    tailwindcss(),
    versionJson(),
    ...(sentryAuthToken
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG ?? "neuroticsasquatch",
            project: process.env.SENTRY_PROJECT ?? "tvbf-frontend",
            authToken: sentryAuthToken,
            release: { name: process.env.VITE_GIT_SHA },
            // Upload maps to Sentry, then delete them from the build output so they
            // aren't served publicly. Stack-trace resolution still works via the
            // debug IDs embedded in the JS.
            sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
          }),
        ]
      : []),
  ],
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
      // The hostname the browser loaded the page from. Defaults to the Traefik
      // one; a dev environment served under another name (a Coder workspace URL)
      // sets HMR_HOST, alongside Vite's own __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS
      // for the allowedHosts check below. Not VITE_-prefixed, so it stays out of
      // the client bundle.
      host: process.env.HMR_HOST ?? "app.tvbf.localhost",
    },
    allowedHosts: ["app.tvbf.localhost"],
    proxy: apiProxyTarget
      ? {
          "/api": {
            target: apiProxyTarget,
            changeOrigin: true,
            rewrite: (p) => p.replace(/^\/api/, ""),
          },
        }
      : undefined,
    watch: {
      usePolling: true,
      interval: 500,
    },
  },
}));
