import { useState } from "react";
import { useAuth } from "./AuthContext";
import { ApiError } from "@/api/client";

export function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (next.length < 8) {
      setErr("New password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(current, next);
      onClose();
      setCurrent("");
      setNext("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setErr("Current password is incorrect.");
      else setErr("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div role="dialog" aria-label="Change password" className="fixed inset-0 bg-black/30 flex items-center justify-center z-20">
      <div className="bg-background rounded p-6 w-96 border border-border">
        <h2 className="text-lg font-semibold mb-4">Change password</h2>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            placeholder="Current password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="w-full rounded border border-border px-3 py-2 bg-background"
          />
          <input
            type="password"
            placeholder="New password"
            required
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="w-full rounded border border-border px-3 py-2 bg-background"
          />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-3 py-1">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded bg-foreground text-background px-3 py-1 disabled:opacity-50">
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
