import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Sentry from "@sentry/react";
import { RouterProvider } from "react-router/dom";
import { Toaster } from "sonner";
import { router } from "./router";
import { AuthProvider } from "./components/AuthContext";
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
      <AuthProvider>
        <Sentry.ErrorBoundary fallback={<div>Something went wrong. Please refresh the page.</div>}>
          <RouterProvider router={router} />
        </Sentry.ErrorBoundary>
        <RouterProvider router={router} />
        <Toaster position="bottom-center" richColors closeButton />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
