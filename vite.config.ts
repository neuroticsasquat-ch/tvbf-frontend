import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "node:path";

// Upload source maps + create a Sentry release only when an auth token is present
// (set in the prod build environment). Local/dev builds have no token and skip upload.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

export default defineConfig({
  // "hidden" emits source maps (so the Sentry plugin can upload them) but omits the
  // //# sourceMappingURL= comment — otherwise the build would reference a map that
  // filesToDeleteAfterUpload has already removed. Sentry still resolves via debug IDs.
  build: { sourcemap: sentryAuthToken ? "hidden" : false },
  plugins: [
    react(),
    tailwindcss(),
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
      host: "app.tvbf.localhost",
    },
    allowedHosts: ["app.tvbf.localhost"],
    watch: {
      usePolling: true,
      interval: 500,
    },
  },
});
