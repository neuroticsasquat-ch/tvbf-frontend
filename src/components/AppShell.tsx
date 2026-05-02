import { useCallback, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { Home as HomeIcon, Search as SearchIcon } from "lucide-react";
import { useAuth } from "./AuthContext";
import { UserMenu } from "./UserMenu";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { cn } from "@/lib/cn";

const HOME_PATHS = new Set(["/", "/upcoming", "/all", "/watched"]);

export function AppShell() {
  const { user } = useAuth();
  const location = useLocation();
  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const onHomeTab = HOME_PATHS.has(location.pathname);

  const handleHomeClick = useCallback(
    (e: React.MouseEvent) => {
      if (onHomeTab) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        // Let NavLink navigate to "/" normally.
      }
    },
    [onHomeTab],
  );

  // The icon trio used in both the desktop header and the mobile bottom bar.
  const iconNav = (placement: "header" | "bottom") => {
    const iconCls =
      placement === "header"
        ? "inline-flex items-center justify-center h-9 w-9 rounded hover:bg-accent"
        : "flex flex-col items-center justify-center flex-1 py-2 text-xs gap-0.5";
    const activeCls =
      placement === "header"
        ? "text-foreground bg-accent"
        : "text-foreground";
    const inactiveCls = "text-muted-foreground hover:text-foreground";
    return (
      <>
        <NavLink
          to="/"
          end={false}
          onClick={handleHomeClick}
          className={({ isActive }) =>
            cn(iconCls, (isActive || onHomeTab) ? activeCls : inactiveCls)
          }
          aria-label="Home"
        >
          <HomeIcon className="h-5 w-5" aria-hidden />
          {placement === "bottom" && <span>Home</span>}
        </NavLink>
        <NavLink
          to="/search"
          className={({ isActive }) =>
            cn(iconCls, isActive ? activeCls : inactiveCls)
          }
          aria-label="Search"
        >
          <SearchIcon className="h-5 w-5" aria-hidden />
          {placement === "bottom" && <span>Search</span>}
        </NavLink>
        <UserMenu
          onChangePassword={() => setPwOpen(true)}
          onDeleteAccount={() => setDelOpen(true)}
          variant={placement === "header" ? "icon" : "bottom-tab"}
        />
      </>
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold">
            TV Binge Friend
          </Link>
          {user && (
            <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
              {iconNav("header")}
            </nav>
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
          {iconNav("bottom")}
        </nav>
      )}

      <ChangePasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
      <DeleteAccountDialog open={delOpen} onClose={() => setDelOpen(false)} />
    </div>
  );
}
