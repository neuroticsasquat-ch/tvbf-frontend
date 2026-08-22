import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import * as authApi from "@/api/auth";
import { ApiError } from "@/api/client";
import { FieldError } from "@/components/FieldError";
import { useFieldErrors } from "@/hooks/useFieldErrors";

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

const BAD_LINK = "This reset link is invalid or has expired. Request a new one.";

/** The request fields this form has an input for. `token` is deliberately not
 * one: it comes from the link the user followed, so a message about it belongs
 * in the banner beside the expired-link copy rather than under an input the
 * user cannot see or fix. */
const OWN_FIELDS = ["new_password"];

/** Unauthed page consumed from the password-reset email. */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { fieldErrors, fieldProps, clearField, capture, reset } = useFieldErrors(OWN_FIELDS);

  if (!token) {
    return (
      <div className="mx-auto max-w-sm py-12 space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <p role="alert">This link is missing its reset token.</p>
        <Link to="/forgot-password" className="inline-block underline">
          Request a new link
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    reset();
    if (pw.length < MIN_PASSWORD || pw.length > MAX_PASSWORD) {
      setError(`Password must be between ${MIN_PASSWORD} and ${MAX_PASSWORD} characters.`);
      return;
    }
    if (pw !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPassword({ token: token!, new_password: pw });
      toast.success("Password updated. Log in with your new password.");
      navigate("/login", { replace: true });
    } catch (e) {
      // Field messages first: the server's own sentence says which rule the
      // password broke, where the generic one below can only guess.
      const captured = capture(e);
      if (captured.handled) {
        // `token` is the one field here with no input, and a schema complaint
        // about it is the same condition the 400 branch already has copy for —
        // so it gets that sentence. The raw one names a field the user cannot
        // see and would replace the only text telling them what to do next.
        setError(captured.unowned.token ? BAD_LINK : captured.banner);
      } else if (e instanceof ApiError && e.status === 400) {
        setError(BAD_LINK);
      } else if (e instanceof ApiError && e.status === 422) {
        setError("That password isn't allowed. Pick a different one.");
      } else {
        setError("Couldn't reset your password. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="text-2xl font-semibold mb-6">Reset password</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="pw" className="block text-sm">
            New password
          </label>
          <input
            id="pw"
            type="password"
            required
            minLength={MIN_PASSWORD}
            maxLength={MAX_PASSWORD}
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              clearField("new_password");
            }}
            {...fieldProps("new_password", "pw-help")}
            className="mt-1 w-full rounded border px-3 py-2"
          />
          <FieldError name="new_password" message={fieldErrors.new_password} />
          <p id="pw-help" className="mt-1 text-xs text-muted-foreground">
            {MIN_PASSWORD}–{MAX_PASSWORD} characters.
          </p>
        </div>
        <div>
          <label htmlFor="confirm" className="block text-sm">
            Confirm new password
          </label>
          <input
            id="confirm"
            type="password"
            required
            minLength={MIN_PASSWORD}
            maxLength={MAX_PASSWORD}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-black text-white py-2 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save new password"}
        </button>
        <p className="text-sm">
          <Link to="/login" className="underline">
            Back to log in
          </Link>
        </p>
      </form>
    </div>
  );
}
