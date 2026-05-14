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
import { WatchNextPage } from "@/pages/WatchNextPage";
import { UpcomingPage } from "@/pages/UpcomingPage";
import { MyShowsPage } from "@/pages/MyShowsPage";
import { ConnectionsPage } from "@/pages/ConnectionsPage";
import { FriendProfilePage } from "@/pages/FriendProfilePage";
import { SettingsPage } from "@/pages/SettingsPage";

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
          { index: true, element: <WatchNextPage /> },
          { path: "upcoming", element: <UpcomingPage /> },
          { path: "my-shows", element: <MyShowsPage /> },
          { path: "connections", element: <ConnectionsPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "users/:userId", element: <FriendProfilePage /> },
          // Redirects from old paths.
          { path: "watch-next", element: <Navigate to="/" replace /> },
          { path: "all", element: <Navigate to="/my-shows" replace /> },
          { path: "watched", element: <Navigate to="/my-shows" replace /> },
          { path: "my-shows/watched", element: <Navigate to="/my-shows" replace /> },
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
