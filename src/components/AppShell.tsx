import { useCallback, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import {
  PlayCircle as WatchNextIcon,
  Calendar as CalendarIcon,
  Library as MyShowsIcon,
  Search as SearchIcon,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { UserMenu } from "./UserMenu";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { cn } from "@/lib/cn";

type Placement = "desktop" | "mobile-header" | "mobile-bottom";

export function AppShell() {
  const { user } = useAuth();
  const location = useLocation();
  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const onWatchNext = location.pathname === "/";

  const handleWatchNextClick = useCallback(
    (e: React.MouseEvent) => {
      if (onWatchNext) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [onWatchNext],
  );

  const linkCls = (placement: Placement) =>
    placement === "mobile-bottom"
      ? "flex flex-col items-center justify-center flex-1 py-2 text-xs gap-0.5"
      : placement === "mobile-header"
        ? "inline-flex items-center justify-center h-9 w-9 rounded hover:bg-accent"
        : "inline-flex items-center h-9 px-3 rounded hover:bg-accent gap-1.5 text-sm";
  const activeCls = (placement: Placement) =>
    placement === "mobile-bottom" ? "text-foreground" : "text-foreground bg-accent";
  const inactiveCls = "text-muted-foreground hover:text-foreground";

  const showLabel = (placement: Placement) => placement !== "mobile-header";
  const userMenuVariant = (placement: Placement) =>
    placement === "mobile-bottom"
      ? "bottom-tab"
      : placement === "mobile-header"
        ? "icon-only"
        : "icon";

  const primaryLinks = (placement: Placement) => (
    <>
      <NavLink
        to="/"
        end
        onClick={handleWatchNextClick}
        className={({ isActive }) =>
          cn(linkCls(placement), isActive ? activeCls(placement) : inactiveCls)
        }
        aria-label="Watch Next"
      >
        <WatchNextIcon className="h-5 w-5" aria-hidden />
        {showLabel(placement) && <span>Watch Next</span>}
      </NavLink>
      <NavLink
        to="/upcoming"
        className={({ isActive }) =>
          cn(linkCls(placement), isActive ? activeCls(placement) : inactiveCls)
        }
        aria-label="Upcoming"
      >
        <CalendarIcon className="h-5 w-5" aria-hidden />
        {showLabel(placement) && <span>Upcoming</span>}
      </NavLink>
      <NavLink
        to="/my-shows"
        className={({ isActive }) =>
          cn(linkCls(placement), isActive ? activeCls(placement) : inactiveCls)
        }
        aria-label="My Shows"
      >
        <MyShowsIcon className="h-5 w-5" aria-hidden />
        {showLabel(placement) && <span>My Shows</span>}
      </NavLink>
    </>
  );

  const utilityLinks = (placement: Placement) => (
    <>
      <NavLink
        to="/search"
        className={({ isActive }) =>
          cn(linkCls(placement), isActive ? activeCls(placement) : inactiveCls)
        }
        aria-label="Search"
      >
        <SearchIcon className="h-5 w-5" aria-hidden />
        {showLabel(placement) && <span>Search</span>}
      </NavLink>
      <UserMenu
        onChangePassword={() => setPwOpen(true)}
        onDeleteAccount={() => setDelOpen(true)}
        variant={userMenuVariant(placement)}
      />
    </>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold">
            TV Binge Friend
          </Link>
          {user && (
            <>
              <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
                {primaryLinks("desktop")}
                {utilityLinks("desktop")}
              </nav>
              <nav className="md:hidden flex items-center gap-1" aria-label="Utility">
                {utilityLinks("mobile-header")}
              </nav>
            </>
          )}
        </div>
      </header>

      <main className={cn("mx-auto w-full max-w-6xl flex-1 px-4 py-6", user && "pb-20 md:pb-6")}>
        <Outlet />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground">
          TV data and images provided by{" "}
          <a
            href="https://www.tvmaze.com"
            target="_blank"
            rel="noreferrer noopener"
            className="underline hover:text-foreground"
          >
            TVmaze
          </a>
          , licensed under{" "}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noreferrer noopener"
            className="underline hover:text-foreground"
          >
            CC BY-SA 4.0
          </a>
          .
        </div>
      </footer>

      {user && (
        <nav
          aria-label="Primary"
          className="md:hidden fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
        >
          {primaryLinks("mobile-bottom")}
        </nav>
      )}

      <ChangePasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
      <DeleteAccountDialog open={delOpen} onClose={() => setDelOpen(false)} />
    </div>
  );
}
