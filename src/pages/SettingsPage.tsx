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
import { FieldError } from "@/components/FieldError";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { HANDLE_SHAPE_MESSAGE, isHandleShapeValid, normaliseHandle } from "@/lib/handle";
import { formatRelativeTime } from "@/lib/relativeTime";

/** Settings page shell. The Profile section carries the display name and the
 * handle (NEU-1169 §5.2). M5/M6 stories drop additional sections in here. */
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
          Download a JSON copy of your account info, My Shows list, and full watch history.
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
          <p className="p-4 text-sm text-muted-foreground">No active sessions.</p>
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
        <span className="truncate font-medium text-foreground">{s.device_label}</span>
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
        else if (e.status === 409) setError("That email is already used by another account.");
        else if (e.status === 429) setError("Too many requests. Try again in a few minutes.");
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
            Your email won't be shown to other users, but they can find you with it to send a
            connection request.
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
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            We sent a confirmation link to <span className="text-foreground">{sent}</span>. Click
            the link in that email to finish changing your address.
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
              <span className="block text-muted-foreground mb-1">Current password</span>
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
              <button type="button" onClick={cancel} disabled={submitting} className="px-3 py-1">
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
      if (e instanceof ApiError && e.fieldErrors?.display_name) {
        // The rule lives in the schema (NEU-1194), so the server's own sentence
        // is the only one that says which rule was broken. Inline, beside the
        // input it is about, rather than in a toast that outlives the editor.
        setError(e.fieldErrors.display_name);
      } else if (e instanceof ApiError && e.status === 422) {
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
                <button type="button" onClick={cancel} disabled={submitting} className="px-3 py-1">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-base text-foreground">{user.display_name}</span>
              {/* Named, not bare: the Profile card now carries two Edit
                  controls, and "Edit" alone is the same repeated accessible
                  name the admin switch is labelled against (NEU-1169 §4.3). */}
              <button
                type="button"
                onClick={startEditing}
                aria-label="Edit display name"
                className="text-sm underline"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        <HandleEditor />
      </div>
    </section>
  );
}

/** The three consequences of changing a handle, stated **before** the Edit
 * control (§5.2). They are non-obvious, asymmetric and unguessable from an
 * edit field, and the throttle in particular has to be readable before the
 * first change: a rule first mentioned at save time has told someone after
 * they spent one. */
const HANDLE_CONSEQUENCES = [
  "People who have your old handle won't find you with it.",
  "Nobody else can ever take a handle you've used — it stays yours to reclaim.",
  "You can change it 3 times every 30 days.",
];

/** The one message for a refused handle, whatever the cause (§5.4).
 *
 * NEU-1163 §6.3 makes "held by a live account" and "released by a different
 * account" byte-identical on purpose — distinguishing them turns this form into
 * a *has this handle ever existed* oracle, including for deleted accounts.
 * Rendering two messages would leak exactly the distinction the backend hid. */
const HANDLE_TAKEN = "That handle isn't available. Try another.";

/** The one field this editor owns. A module-level constant because
 * `useFieldErrors` keys its callbacks on the list's contents. */
const HANDLE_FIELD = ["handle"];

/** The date the throttle lifts, from the server's own `Retry-After` (§5.3).
 *
 * The number stays the server's — the client only renders it. "Later" is
 * useless here: the window is 30 days and rolling, so the earliest retry is 30
 * days after the *oldest* of three changes, and someone who spent three
 * changes fixing a typo on day one is locked out until day 31. */
function retryDate(seconds: number | undefined): string | null {
  if (seconds === undefined) return null;
  const at = new Date(Date.now() + seconds * 1000);
  if (Number.isNaN(at.valueOf())) return null;
  return at.toLocaleDateString(undefined, { day: "numeric", month: "long" });
}

/** Changing the handle, in the Profile section beneath the display name —
 * the handle is the identifier and the display name is the label, so they
 * belong together.
 *
 * An inline editor mirroring the display-name one above rather than a
 * `ConfirmDialog`: this repo reserves that dialog for destructive or
 * outward-facing acts — block, disconnect, unblock, disable, delete watch
 * history — and a handle change is none of those. NEU-1163 §4.2's same-owner
 * exemption makes it reversible by the person doing it (D9). */
function HandleEditor() {
  const { user, changeHandle } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Every message this form can show is about the one input — the client-side
  // shape check, the server's 422 sentence, the 409 and the 429 alike — so they
  // share one store and the one `aria-describedby` join that hook owns, rather
  // than a local `useState` rebuilding it (NEU-1196).
  const { fieldErrors, fieldProps, clearField, setFieldError, capture } =
    useFieldErrors(HANDLE_FIELD);
  const error = fieldErrors.handle;

  if (!user) return null;

  const normalised = normaliseHandle(draft);
  // The same prediction the signup field draws, on the same rule: shown only
  // when normalisation actually changed something.
  const preview =
    draft.length > 0 && normalised !== draft && normalised.length > 0 ? normalised : null;

  function startEditing() {
    setDraft(user?.handle ?? "");
    clearField("handle");
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    clearField("handle");
  }

  /** The shape and nothing else — reserved words, the `user_<8 hex>` pattern
   * and uniqueness are the server's (D2). On blur and on submit, never per
   * keystroke.
   *
   * An empty draft is refused here rather than waved through, unlike the signup
   * field, whose `required` attribute makes native validation cover the same
   * hole. Without that this editor would PATCH `handle: ""` for someone who
   * cleared the box — a round trip the check exists to save. */
  function checkShape(): boolean {
    if (isHandleShapeValid(draft)) {
      clearField("handle");
      return true;
    }
    setFieldError("handle", HANDLE_SHAPE_MESSAGE);
    return false;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!checkShape()) return;
    if (normalised === user?.handle) {
      setEditing(false);
      return;
    }
    setSubmitting(true);
    try {
      // Sent as typed, exactly as signup sends it: the server owns the
      // normalisation, so lowercasing here would be a second copy of a rule
      // that already has one.
      await changeHandle(draft);
      toast.success("Handle updated.");
      setEditing(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setFieldError("handle", HANDLE_TAKEN);
      } else if (e instanceof ApiError && e.status === 429) {
        const on = retryDate(e.retryAfterSeconds);
        setFieldError(
          "handle",
          on
            ? `You've changed your handle recently. You can change it again on ${on}.`
            : "You've changed your handle recently. You can change it again once the 30-day window has passed.",
        );
      } else if (!capture(e).handled) {
        // A 422 carries the schema's own sentence — the only one that says
        // which rule was broken, since a reserved word and the `user_<8 hex>`
        // shape both arrive that way — and `capture` puts it on the input.
        setFieldError("handle", "Couldn't change your handle. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-t border-border pt-3 text-sm">
      <p className="text-muted-foreground mb-1">Handle</p>
      <p className="text-xs text-muted-foreground mb-2">
        Your handle is how people tell you apart when two of you share a display name.
      </p>
      <ul className="mb-2 list-disc pl-5 text-xs text-muted-foreground">
        {HANDLE_CONSEQUENCES.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {editing ? (
        <form onSubmit={save} className="space-y-2">
          <div className="flex items-center rounded border border-border bg-background focus-within:ring-2 focus-within:ring-ring">
            <span aria-hidden="true" className="pl-3 text-muted-foreground select-none">
              @
            </span>
            <input
              type="text"
              autoFocus
              required
              value={draft}
              minLength={3}
              maxLength={30}
              onChange={(e) => {
                setDraft(e.target.value);
                clearField("handle");
              }}
              onBlur={checkShape}
              aria-label="Handle"
              {...fieldProps("handle")}
              autoCapitalize="none"
              spellCheck={false}
              className="w-full rounded-r bg-transparent px-1 py-2 focus:outline-none"
            />
          </div>
          {preview && <p className="text-xs text-muted-foreground">You&apos;ll be @{preview}</p>}
          <FieldError name="handle" message={error} />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-foreground text-background px-3 py-1 disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={cancel} disabled={submitting} className="px-3 py-1">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="text-base text-foreground">@{user.handle}</span>
          <button
            type="button"
            onClick={startEditing}
            aria-label="Edit handle"
            className="text-sm underline"
          >
            Edit
          </button>
        </div>
      )}
    </div>
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
          onChange={(e) => update.mutate({ activity_feed_enabled: e.currentTarget.checked })}
          className="h-5 w-5"
        />
      </label>
    </section>
  );
}
