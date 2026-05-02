import { NavLink, useLocation } from "react-router";
import { useMyShows, useUpcoming, useWatchNext } from "@/api/me";
import { cn } from "@/lib/cn";
import { WatchNextList } from "@/components/home/WatchNextList";
import { UpcomingList } from "@/components/home/UpcomingList";
import { AllList } from "@/components/home/AllList";
import { WatchedList } from "@/components/home/WatchedList";

type TabKey = "watch-next" | "upcoming" | "all" | "watched";

const TAB_BY_PATH: Record<string, TabKey> = {
  "/": "watch-next",
  "/upcoming": "upcoming",
  "/all": "all",
  "/watched": "watched",
};

export function HomePage() {
  const location = useLocation();
  const tab: TabKey = TAB_BY_PATH[location.pathname] ?? "watch-next";

  // Eager fetches for tab count badges. The active tab also reads from these
  // caches via its own hook call — react-query dedupes.
  const watchNext = useWatchNext();
  const upcoming = useUpcoming();
  // Prime the my-shows cache so AllList/WatchedList render fast on switch.
  useMyShows();

  const watchNextCount = watchNext.data?.length;
  const upcomingCount = upcoming.data?.length;

  const tabLink = (key: TabKey, to: string, label: string, count?: number) => (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "px-3 py-2 text-sm whitespace-nowrap border-b-2",
          isActive
            ? "font-semibold border-foreground text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )
      }
      aria-current={tab === key ? "page" : undefined}
    >
      {label}
      {typeof count === "number" && <span className="ml-1">({count})</span>}
    </NavLink>
  );

  return (
    <div>
      <nav
        aria-label="Home tabs"
        className="sticky top-0 z-10 -mx-4 px-4 mb-4 bg-background border-b border-border overflow-x-auto"
      >
        <div className="flex">
          {tabLink("watch-next", "/", "Watch Next", watchNextCount)}
          {tabLink("upcoming", "/upcoming", "Upcoming", upcomingCount)}
          {tabLink("all", "/all", "All")}
          {tabLink("watched", "/watched", "Watched")}
        </div>
      </nav>
      {tab === "watch-next" && <WatchNextList />}
      {tab === "upcoming" && <UpcomingList />}
      {tab === "all" && <AllList />}
      {tab === "watched" && <WatchedList />}
    </div>
  );
}
