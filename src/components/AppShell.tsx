import { Link, Outlet } from "react-router";

export function AppShell() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold">
            TV Binge Friend
          </Link>
          <nav className="text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              Browse
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
