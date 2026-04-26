import { Link, Outlet } from "react-router";
import { useAuth } from "./AuthContext";
import { UserMenu } from "./UserMenu";

export function AppShell() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold">
            TV Binge Friend
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              Search
            </Link>
            {user ? (
              <>
                <Link to="/my-shows" className="hover:text-foreground">
                  My Shows
                </Link>
                <Link to="/watch-next" className="hover:text-foreground">
                  Watch Next
                </Link>
                <Link to="/upcoming" className="hover:text-foreground">
                  Upcoming
                </Link>
                <UserMenu />
              </>
            ) : (
              <>
                <Link to="/login" className="hover:text-foreground">
                  Log in
                </Link>
                <Link to="/signup" className="hover:text-foreground">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
