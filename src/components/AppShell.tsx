import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import {
  PlayCircle as WatchNextIcon,
  Calendar as CalendarIcon,
  Library as MyShowsIcon,
  Users as FriendsIcon,
  Search as SearchIcon,
  Tv as TvIcon,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { UserMenu } from "./UserMenu";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { SearchOverlay } from "./SearchOverlay";
import { UnverifiedEmailBanner } from "./UnverifiedEmailBanner";
import { cn } from "@/lib/cn";

type Placement = "desktop" | "mobile-header" | "mobile-bottom";

export function AppShell() {
  const { user } = useAuth();
  const location = useLocation();
  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const searchFormRef = useRef<HTMLFormElement>(null);
  const overlayRef = useRef<HTMLElement>(null);

  // Clear search overlay whenever the user navigates anywhere.
  const [prevLocationKey, setPrevLocationKey] = useState(location.key);
  if (prevLocationKey !== location.key) {
    setPrevLocationKey(location.key);
    setSearchInput("");
  }

  const overlayActive = !!user && searchInput.trim().length > 0;

  // Hide the mobile bottom nav while a text input is focused. On iOS Safari
  // the layout viewport doesn't shrink for the keyboard, so a fixed-bottom
  // nav otherwise floats above the keyboard with a transparent strip of
  // Safari chrome between them.
  const [inputFocused, setInputFocused] = useState(false);
  useEffect(() => {
    function isTextInput(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false;
      if (t.isContentEditable) return true;
      if (t.tagName === "TEXTAREA") return true;
      if (t.tagName === "INPUT") {
        const type = (t as HTMLInputElement).type;
        return type !== "checkbox" && type !== "radio" && type !== "button" && type !== "submit";
      }
      return false;
    }
    const onFocusIn = (e: FocusEvent) => {
      if (isTextInput(e.target)) setInputFocused(true);
    };
    const onFocusOut = () => setInputFocused(false);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  // Click outside the search box or overlay clears the input.
  useEffect(() => {
    if (!overlayActive) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (searchFormRef.current?.contains(target)) return;
      if (overlayRef.current?.contains(target)) return;
      // Radix Dialog content (FilterSheet) renders into a portal, so its DOM
      // sits outside the overlay's subtree. Treat any open dialog as inside-the-overlay
      // for dismiss purposes.
      if (target instanceof Element && target.closest('[role="dialog"][data-state="open"]')) return;
      setSearchInput("");
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [overlayActive]);

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
      <NavLink
        to="/friends"
        className={({ isActive }) =>
          cn(linkCls(placement), isActive ? activeCls(placement) : inactiveCls)
        }
        aria-label="Friends"
      >
        <FriendsIcon className="h-5 w-5" aria-hidden />
        {showLabel(placement) && <span>Friends</span>}
      </NavLink>
    </>
  );

  const utilityLinks = (placement: Placement) => (
    <>
      <UserMenu
        onChangePassword={() => setPwOpen(true)}
        onDeleteAccount={() => setDelOpen(true)}
        variant={userMenuVariant(placement)}
      />
    </>
  );

  return (
    // pb-20 reserves space at the document bottom on mobile so the fixed
    // bottom nav doesn't visually cover the footer. Removed at md+.
    <div className={cn("flex min-h-screen flex-col", user && "pb-20 md:pb-0")}>
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="inline-flex shrink-0 items-center gap-2 text-lg font-semibold hover:underline"
            aria-label="TV Binge Friend home"
          >
            <TvIcon className="h-5 w-5" aria-hidden />
            TV Binge Friend
          </Link>
          {user && (
            <>
              <HeaderSearch
                ref={searchFormRef}
                value={searchInput}
                onChange={setSearchInput}
                className="order-last w-full md:order-none md:ml-auto md:w-auto md:max-w-md md:flex-1"
              />
              <nav className="hidden md:flex shrink-0 items-center gap-1" aria-label="Primary">
                {primaryLinks("desktop")}
                {utilityLinks("desktop")}
              </nav>
              <nav
                className="md:hidden flex ml-auto shrink-0 items-center gap-1"
                aria-label="Utility"
              >
                {utilityLinks("mobile-header")}
              </nav>
            </>
          )}
        </div>
      </header>

      {user && <UnverifiedEmailBanner />}

      {overlayActive ? (
        <section
          ref={overlayRef}
          role="region"
          aria-label="Search results"
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-6"
        >
          <SearchOverlay search={searchInput} />
        </section>
      ) : (
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          <Outlet />
        </main>
      )}

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

      {user && !inputFocused && (
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

function HeaderSearch({
  value,
  onChange,
  ref,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  ref?: React.Ref<HTMLFormElement>;
  className?: string;
}) {
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
  }

  return (
    <form
      ref={ref}
      role="search"
      onSubmit={onSubmit}
      className={cn("flex", className)}
      aria-label="Search shows"
    >
      <div className="relative w-full">
        <SearchIcon
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search shows"
          aria-label="Search shows"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
          // text-base (16px) on mobile prevents iOS Safari auto-zoom on focus;
          // sm:text-sm restores the tighter desktop visual.
          className="w-full rounded border border-border bg-background py-1.5 pl-7 pr-2 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
        />
      </div>
    </form>
  );
}
