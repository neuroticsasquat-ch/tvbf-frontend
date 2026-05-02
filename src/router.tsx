import { createBrowserRouter, Navigate } from "react-router";
import { AppShell } from "@/components/AppShell";
import { SearchPage } from "@/pages/SearchPage";
import { ShowDetailPage } from "@/pages/ShowDetailPage";
import { EpisodesPage } from "@/pages/EpisodesPage";
import { EpisodePage } from "@/pages/EpisodePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { RequireAuth } from "@/components/RequireAuth";
import { HomePage } from "@/pages/HomePage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { path: "login", element: <LoginPage /> },
      { path: "signup", element: <SignupPage /> },
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "upcoming", element: <HomePage /> },
          { path: "all", element: <HomePage /> },
          { path: "watched", element: <HomePage /> },
          // Redirects from old paths.
          { path: "watch-next", element: <Navigate to="/" replace /> },
          { path: "my-shows", element: <Navigate to="/" replace /> },
          { path: "search", element: <SearchPage /> },
          { path: "shows/:id", element: <ShowDetailPage /> },
          { path: "shows/:id/episodes", element: <EpisodesPage /> },
          { path: "episodes/:episodeId", element: <EpisodePage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
