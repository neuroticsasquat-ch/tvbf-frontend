import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { useAuth } from "./AuthContext";
import { UserMenu } from "./UserMenu";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Auto-close the mobile drawer on route change.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const linkClass = "hover:text-foreground";
  const drawerLink =
    "block px-4 py-3 text-foreground hover:bg-muted border-b border-border";
  const drawerButton =
    "block w-full text-left px-4 py-3 text-foreground hover:bg-muted border-b border-border";

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold">
            TV Binge Friend
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
            {user ? (
              <>
                <Link to="/" className={linkClass}>
                  Search
                </Link>
                <Link to="/my-shows" className={linkClass}>
                  My Shows
                </Link>
                <Link to="/watch-next" className={linkClass}>
                  Watch Next
                </Link>
                <Link to="/upcoming" className={linkClass}>
                  Upcoming
                </Link>
                <UserMenu
                  onChangePassword={() => setPwOpen(true)}
                  onDeleteAccount={() => setDelOpen(true)}
                />
              </>
            ) : (
              <>
                <Link to="/login" className={linkClass}>
                  Log in
                </Link>
                <Link to="/signup" className={linkClass}>
                  Sign up
                </Link>
              </>
            )}
          </nav>

          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded border border-border text-foreground"
          >
            {menuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18" />
                <path d="M3 12h18" />
                <path d="M3 18h18" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <nav id="mobile-menu" className="md:hidden border-t border-border">
            {user ? (
              <ul className="text-base">
                <li>
                  <Link to="/" className={drawerLink}>
                    Search
                  </Link>
                </li>
                <li>
                  <Link to="/my-shows" className={drawerLink}>
                    My Shows
                  </Link>
                </li>
                <li>
                  <Link to="/watch-next" className={drawerLink}>
                    Watch Next
                  </Link>
                </li>
                <li>
                  <Link to="/upcoming" className={drawerLink}>
                    Upcoming
                  </Link>
                </li>
                <li className="px-4 py-3 text-sm text-muted-foreground border-b border-border">
                  Signed in as {user.display_name}
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setPwOpen(true);
                    }}
                    className={drawerButton}
                  >
                    Change password
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setDelOpen(true);
                    }}
                    className={drawerButton}
                  >
                    Delete account
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      await logout();
                    }}
                    className={drawerButton}
                  >
                    Log out
                  </button>
                </li>
              </ul>
            ) : (
              <ul className="text-base">
                <li>
                  <Link to="/login" className={drawerLink}>
                    Log in
                  </Link>
                </li>
                <li>
                  <Link to="/signup" className={drawerLink}>
                    Sign up
                  </Link>
                </li>
              </ul>
            )}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>

      <ChangePasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
      <DeleteAccountDialog open={delOpen} onClose={() => setDelOpen(false)} />
    </div>
  );
}
