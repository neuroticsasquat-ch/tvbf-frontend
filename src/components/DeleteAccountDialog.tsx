import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "./AuthContext";
import { ApiError } from "@/api/client";

export function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await deleteAccount(pw);
      onClose();
      navigate("/");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setErr("Password is incorrect.");
      else setErr("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Delete account"
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-20"
    >
      <div className="bg-background rounded p-6 w-96 border border-border">
        <h2 className="text-lg font-semibold mb-2">Delete account</h2>
        <p className="text-sm text-muted-foreground mb-4">
          This permanently deletes your account, your watchlist, and all watch history. This cannot
          be undone.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            placeholder="Confirm with your password"
            required
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="w-full rounded border border-border px-3 py-2 bg-background"
          />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-3 py-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-red-600 text-white px-3 py-1 disabled:opacity-50"
            >
              {submitting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
