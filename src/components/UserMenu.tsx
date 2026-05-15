import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { User as UserIcon } from "lucide-react";
import { useAuth } from "./AuthContext";
import { cn } from "@/lib/cn";

type UserMenuProps = {
  onChangePassword: () => void;
  onDeleteAccount: () => void;
  variant?: "icon" | "bottom-tab" | "icon-only";
};

export function UserMenu({ onChangePassword, onDeleteAccount, variant = "icon" }: UserMenuProps) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  if (!user) return null;

  const triggerCls =
    variant === "bottom-tab"
      ? cn(
          "flex flex-col items-center justify-center flex-1 py-2 text-xs gap-0.5",
          open ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )
      : variant === "icon-only"
        ? cn(
            "inline-flex items-center justify-center h-9 w-9 rounded hover:bg-accent",
            open ? "text-foreground bg-accent" : "text-muted-foreground hover:text-foreground",
          )
        : cn(
            "inline-flex items-center h-9 px-3 rounded hover:bg-accent gap-1.5 text-sm",
            open ? "text-foreground bg-accent" : "text-muted-foreground hover:text-foreground",
          );

  // Bottom-tab menu opens upward so it doesn't get clipped by the screen edge.
  const menuPositionCls =
    variant === "bottom-tab"
      ? "absolute right-0 bottom-full mb-2 w-48"
      : "absolute right-0 mt-2 w-48";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.display_name}`}
        className={triggerCls}
      >
        <UserIcon className="h-5 w-5" aria-hidden />
        {variant !== "icon-only" && <span>Account</span>}
      </button>
      {open && (
        <ul
          role="menu"
          className={cn(menuPositionCls, "rounded border border-border bg-background shadow z-50")}
        >
          <li className="px-3 py-2 text-xs text-muted-foreground border-b border-border">
            Signed in as {user.display_name}
          </li>
          <li>
            <Link
              role="menuitem"
              to="/settings"
              onClick={() => setOpen(false)}
              className="block w-full text-left px-3 py-2 hover:bg-muted"
            >
              Settings
            </Link>
          </li>
          {user.is_admin && (
            <li>
              <Link
                role="menuitem"
                to="/admin"
                onClick={() => setOpen(false)}
                className="block w-full text-left px-3 py-2 hover:bg-muted"
              >
                Admin
              </Link>
            </li>
          )}
          <li>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onChangePassword();
              }}
              className="w-full text-left px-3 py-2 hover:bg-muted"
            >
              Change password
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDeleteAccount();
              }}
              className="w-full text-left px-3 py-2 hover:bg-muted"
            >
              Delete account
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                setOpen(false);
                await logout();
              }}
              className="w-full text-left px-3 py-2 hover:bg-muted"
            >
              Log out
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
