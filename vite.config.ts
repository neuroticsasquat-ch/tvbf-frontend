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

// Upload source maps to Bugsink only when an auth token is present (set in the
// prod build environment). Without one the build still succeeds: it emits no maps
// and skips the upload, with a warning at build time (NEU-1593).
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

// The deployed commit (NEU-1593): an explicit VITE_GIT_SHA, else Cloudflare
// Pages' CF_PAGES_COMMIT_SHA, else Coolify's SOURCE_COMMIT — which is the literal
// "unknown" unless "Include SOURCE_COMMIT in build" is on, so that one is not a
// SHA. Becomes the Sentry release on both the upload and the client.
const gitSha = [
  process.env.VITE_GIT_SHA,
  process.env.CF_PAGES_COMMIT_SHA,
  process.env.SOURCE_COMMIT,
].find((sha) => sha && sha !== "unknown");

// This build's id (NEU-1504): the commit SHA where the build sets one, else a
// per-build timestamp. Compiled into the bundle as __APP_VERSION__ and written
// to dist/version.json, which useVersionCheck compares on returning to the
// foreground. Build only — dev defines neither, so the check stays inert there.
const appVersion = gitSha || String(Date.now());

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

// Logs that a build without a token skipped the source map upload (NEU-1593).
function warnSkippedUpload(): Plugin {
  return {
    name: "tvbf-warn-skipped-upload",
    apply: "build",
    buildStart() {
      this.warn("SENTRY_AUTH_TOKEN is not set: skipping the source map upload to Bugsink.");
    },
  };
}

export default defineConfig(({ command }) => ({
  define:
    command === "build"
      ? {
          __APP_VERSION__: JSON.stringify(appVersion),
          ...(gitSha ? { __GIT_SHA__: JSON.stringify(gitSha) } : {}),
        }
      : {},
  // "hidden" emits source maps (so the Sentry plugin can upload them) but omits the
  // //# sourceMappingURL= comment — otherwise the build would reference a map that
  // filesToDeleteAfterUpload has already removed. Bugsink resolves via debug IDs.
  build: { sourcemap: sentryAuthToken ? "hidden" : false },
  plugins: [
    react(),
    tailwindcss(),
    versionJson(),
    ...(sentryAuthToken
      ? [
          // Bugsink speaks Sentry's artifact-bundle upload but skips its releases
          // setup, so (as in Bugsink's Vite guide) the release is only injected
          // into the bundle, never created or finalized. Maps match events by the
          // debug IDs the plugin injects by default.
          sentryVitePlugin({
            url: process.env.SENTRY_URL,
            // Bugsink has no orgs, but the plugin skips the upload without one;
            // this is the placeholder Bugsink's own docs pass.
            org: process.env.SENTRY_ORG ?? "bugsinkhasnoorgs",
            project: process.env.SENTRY_PROJECT ?? "tvbf-frontend",
            authToken: sentryAuthToken,
            release: { name: gitSha, create: false, finalize: false, inject: true },
            // Upload the maps, then delete them from the build output so the CDN
            // never serves them.
            sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
          }),
        ]
      : [warnSkippedUpload()]),
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
