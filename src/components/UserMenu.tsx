import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";

type UserMenuProps = {
  onChangePassword: () => void;
  onDeleteAccount: () => void;
};

export function UserMenu({ onChangePassword, onDeleteAccount }: UserMenuProps) {
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
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded border border-border px-3 py-1 text-foreground"
      >
        {user.display_name} ▾
      </button>
      {open && (
        <ul
          role="menu"
          className="absolute right-0 mt-2 w-48 rounded border border-border bg-background shadow z-10"
        >
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
