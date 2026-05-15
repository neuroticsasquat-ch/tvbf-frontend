import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthContext";
import * as authApi from "@/api/auth";
import { ApiError } from "@/api/client";
import { downloadMyData } from "@/api/export";
import { useUpdatePreferences } from "@/api/me";
import {
  useMySessions,
  useRevokeOtherSessions,
  useRevokeSession,
  type SessionSummary,
} from "@/api/sessions";
import { formatRelativeTime } from "@/lib/relativeTime";

/** Settings page shell. Today this only carries the Profile section
 * (display-name edit). M2/M5/M6 stories drop additional sections in here. */
export function SettingsPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <ProfileSection />
      <EmailSection />
      <PrivacySection />
      <SessionsSection />
      <YourDataSection />
    </div>
  );
}

function YourDataSection() {
  const [downloading, setDownloading] = useState(false);

  async function onDownload() {
    setDownloading(true);
    try {
      await downloadMyData();
    } catch {
      toast.error("Couldn't download your data. Try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section aria-labelledby="your-data-heading" className="space-y-4">
      <h2 id="your-data-heading" className="text-lg font-semibold">
        Your data
      </h2>
      <div className="rounded border border-border p-4 space-y-3 text-sm">
        <p className="text-muted-foreground">
          Download a JSON copy of your account info, My Shows list, and full
          watch history.
        </p>
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading}
          className="rounded bg-foreground text-background px-3 py-1 disabled:opacity-50"
        >
          {downloading ? "Preparing download…" : "Download my data"}
        </button>
      </div>
    </section>
  );
}

function SessionsSection() {
  const { data, isLoading, isError } = useMySessions();
  const revokeOthers = useRevokeOtherSessions();

  const otherCount = (data ?? []).filter((s) => !s.is_current).length;

  async function logOutEverywhereElse() {
    if (otherCount === 0) return;
    if (
      !window.confirm(
        otherCount === 1
          ? "Log out the other session?"
          : `Log out the ${otherCount} other sessions?`,
      )
    ) {
      return;
    }
    try {
      const res = await revokeOthers.mutateAsync();
      toast.success(
        res.revoked === 1
          ? "Logged out 1 other session."
          : `Logged out ${res.revoked} other sessions.`,
      );
    } catch {
      toast.error("Couldn't log out other sessions.");
    }
  }

  return (
    <section aria-labelledby="sessions-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="sessions-heading" className="text-lg font-semibold">
          Sessions
        </h2>
        {otherCount > 0 && (
          <button
            type="button"
            onClick={logOutEverywhereElse}
            disabled={revokeOthers.isPending}
            className="rounded border border-border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
          >
            {revokeOthers.isPending ? "Logging out…" : "Log out everywhere else"}
          </button>
        )}
      </div>

      <div className="rounded border border-border">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground" role="status">
            Loading sessions…
          </p>
        ) : isError ? (
          <p className="p-4 text-sm text-red-600" role="alert">
            Couldn't load your sessions. Try again later.
          </p>
        ) : !data || data.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No active sessions.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SessionRow({ session: s }: { session: SessionSummary }) {
  const revoke = useRevokeSession();

  async function onRevoke() {
    if (
      !window.confirm(
        `Log out ${s.device_label} (${s.ip ?? "Unknown IP"})? This device will be signed out immediately.`,
      )
    ) {
      return;
    }
    try {
      await revoke.mutateAsync(s.id);
      toast.success("Session revoked.");
    } catch {
      toast.error("Couldn't revoke that session.");
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-sm">
      <div className="flex flex-1 min-w-0 items-center gap-2">
        <span className="truncate font-medium text-foreground">
          {s.device_label}
        </span>
        {s.is_current && (
          <span className="text-xs rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
            This device
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground sm:text-right">
        <p>{s.ip ?? "Unknown IP"}</p>
        <p>
          <span aria-label={`Last active ${new Date(s.last_seen_at).toLocaleString()}`}>
            Last active {formatRelativeTime(s.last_seen_at)}
          </span>
        </p>
      </div>
      {!s.is_current && (
        <button
          type="button"
          onClick={onRevoke}
          disabled={revoke.isPending}
          aria-label={`Revoke ${s.device_label}`}
          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          {revoke.isPending ? "Revoking…" : "Revoke"}
        </button>
      )}
    </li>
  );
}

function EmailSection() {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  if (!user) return null;

  function start() {
    setEditing(true);
    setError(null);
    setSent(null);
    setNewEmail("");
    setPassword("");
  }

  function cancel() {
    setEditing(false);
    setError(null);
    setNewEmail("");
    setPassword("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!newEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      await authApi.requestEmailChange({
        new_email: newEmail,
        current_password: password,
      });
      setSent(newEmail);
      setEditing(false);
      setNewEmail("");
      setPassword("");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) setError("That password is incorrect.");
        else if (e.status === 409)
          setError("That email is already used by another account.");
        else if (e.status === 429)
          setError("Too many requests. Try again in a few minutes.");
        else setError("Couldn't request the change. Try again.");
      } else {
        setError("Couldn't request the change. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const verified = user.email_verified_at !== null;

  return (
    <section aria-labelledby="email-heading" className="space-y-4">
      <h2 id="email-heading" className="text-lg font-semibold">
        Email
      </h2>

      <div className="rounded border border-border p-4 space-y-3">
        <div className="text-sm">
          <p className="text-muted-foreground mb-1">Current email</p>
          <p className="text-xs text-muted-foreground mb-2">
            Your email won't be shown to other users, but they can find you with
            it to send a connection request.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-base text-foreground">{user.email}</span>
            <span
              className={
                verified
                  ? "text-xs rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                  : "text-xs rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
              }
            >
              {verified ? "Verified" : "Unverified"}
            </span>
          </div>
        </div>

        {sent && (
          <p
            role="status"
            aria-live="polite"
            className="text-sm text-muted-foreground"
          >
            We sent a confirmation link to{" "}
            <span className="text-foreground">{sent}</span>. Click the link in
            that email to finish changing your address.
          </p>
        )}

        {editing ? (
          <form onSubmit={submit} className="space-y-2">
            <label className="block text-sm">
              <span className="block text-muted-foreground mb-1">New email</span>
              <input
                type="email"
                required
                autoFocus
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full rounded border border-border px-3 py-2 bg-background"
              />
            </label>
            <label className="block text-sm">
              <span className="block text-muted-foreground mb-1">
                Current password
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-border px-3 py-2 bg-background"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-foreground text-background px-3 py-1 disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Send confirmation link"}
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={submitting}
                className="px-3 py-1"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={start} className="text-sm underline">
            Change email
          </button>
        )}
      </div>
    </section>
  );
}

function ProfileSection() {
  const { user, updateDisplayName } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  function startEditing() {
    setDraft(user?.display_name ?? "");
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    setError(null);
    if (trimmed.length < 1 || trimmed.length > 80) {
      setError("Display name must be 1–80 characters.");
      return;
    }
    if (trimmed === user?.display_name) {
      setEditing(false);
      return;
    }
    setSubmitting(true);
    try {
      await updateDisplayName(trimmed);
      toast.success("Display name updated.");
      setEditing(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        toast.error("That display name isn't allowed. Use 1–80 characters.");
      } else {
        toast.error("Could not update display name. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="profile-heading" className="space-y-4">
      <h2 id="profile-heading" className="text-lg font-semibold">
        Profile
      </h2>

      <div className="rounded border border-border p-4 space-y-3">
        <div className="text-sm">
          <p className="text-muted-foreground mb-1">Display name</p>
          <p className="text-xs text-muted-foreground mb-2">
            This is the name other users will see on the site.
          </p>
          {editing ? (
            <form onSubmit={save} className="space-y-2">
              <input
                type="text"
                autoFocus
                value={draft}
                maxLength={80}
                onChange={(e) => setDraft(e.target.value)}
                aria-label="Display name"
                className="w-full rounded border border-border px-3 py-2 bg-background"
              />
              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded bg-foreground text-background px-3 py-1 disabled:opacity-50"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  disabled={submitting}
                  className="px-3 py-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-base text-foreground">{user.display_name}</span>
              <button type="button" onClick={startEditing} className="text-sm underline">
                Edit
              </button>
            </div>
          )}
        </div>

      </div>
    </section>
  );
}

function PrivacySection() {
  const { user } = useAuth();
  const update = useUpdatePreferences();
  if (!user) return null;
  const checked = user.activity_feed_enabled;
  return (
    <section aria-labelledby="privacy-heading" className="space-y-3">
      <h2 id="privacy-heading" className="text-lg font-semibold">
        Privacy
      </h2>
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-base text-foreground">Share my activity with friends</span>
          <span className="block text-sm text-muted-foreground">
            When off, your adds, watches, and ratings won't appear in friends' activity feeds.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label="Share my activity with friends"
          checked={checked}
          disabled={update.isPending}
          onChange={(e) =>
            update.mutate({ activity_feed_enabled: e.currentTarget.checked })
          }
          className="h-5 w-5"
        />
      </label>
    </section>
  );
}
