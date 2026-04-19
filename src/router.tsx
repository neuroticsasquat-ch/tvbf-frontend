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
