import { useState } from "react";
import { useAuth } from "./AuthContext";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  if (!user) return null;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded border border-border px-3 py-1 text-foreground"
      >
        {user.display_name} ▾
      </button>
      {open && (
        <ul role="menu" className="absolute right-0 mt-2 w-48 rounded border border-border bg-background shadow z-10">
          <li>
            <button
              role="menuitem"
              onClick={() => { setOpen(false); setPwOpen(true); }}
              className="w-full text-left px-3 py-2 hover:bg-muted"
            >
              Change password
            </button>
          </li>
          <li>
            <button
              role="menuitem"
              onClick={() => { setOpen(false); setDelOpen(true); }}
              className="w-full text-left px-3 py-2 hover:bg-muted"
            >
              Delete account
            </button>
          </li>
          <li>
            <button
              role="menuitem"
              onClick={async () => { setOpen(false); await logout(); }}
              className="w-full text-left px-3 py-2 hover:bg-muted"
            >
              Log out
            </button>
          </li>
        </ul>
      )}
      <ChangePasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
      <DeleteAccountDialog open={delOpen} onClose={() => setDelOpen(false)} />
    </div>
  );
}
