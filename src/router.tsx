import { createBrowserRouter } from "react-router";
import { AppShell } from "@/components/AppShell";
import { SearchPage } from "@/pages/SearchPage";
import { ShowDetailPage } from "@/pages/ShowDetailPage";
import { EpisodesPage } from "@/pages/EpisodesPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { RequireAuth } from "@/components/RequireAuth";
import { MyShowsPage } from "@/pages/MyShowsPage";
import { WatchNextPage } from "@/pages/WatchNextPage";
import { UpcomingPage } from "@/pages/UpcomingPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <SearchPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "signup", element: <SignupPage /> },
      { path: "shows/:id", element: <ShowDetailPage /> },
      { path: "shows/:id/episodes", element: <EpisodesPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: "my-shows", element: <MyShowsPage /> },
          { path: "watch-next", element: <WatchNextPage /> },
          { path: "upcoming", element: <UpcomingPage /> },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
