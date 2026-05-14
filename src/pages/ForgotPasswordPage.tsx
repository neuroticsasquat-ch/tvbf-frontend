import { useState } from "react";
import { Link } from "react-router";
import * as authApi from "@/api/auth";

/** Unauthed form that requests a password reset email. To avoid account
 * enumeration we always show the same neutral message after submit,
 * regardless of whether the email belongs to an account, was rate-limited,
 * or the request errored. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await authApi.forgotPassword({ email });
    } catch {
      // Intentionally swallowed: the backend returns 202 in every case to
      // prevent enumeration, and any transport error we surface here would
      // leak signal about that account. Show the same confirmation copy.
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="text-2xl font-semibold mb-6">Forgot your password?</h1>

      {submitted ? (
        <div className="space-y-4">
          <p
            role="status"
            aria-live="polite"
            className="text-sm text-muted-foreground"
          >
            If that email belongs to an account, we sent a reset link. Check
            your inbox — the link expires in 1 hour.
          </p>
          <Link to="/login" className="text-sm underline">
            Back to log in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-black text-white py-2 disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send reset link"}
          </button>
          <p className="text-sm">
            <Link to="/login" className="underline">
              Back to log in
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
