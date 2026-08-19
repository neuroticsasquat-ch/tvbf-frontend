import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { ApiError } from "@/api/client";
import { useAuth } from "@/components/AuthContext";
import { FieldError } from "@/components/FieldError";
import { useFieldErrors } from "@/hooks/useFieldErrors";

/** The request fields this form has an input for. A 422 naming anything else
 * falls back to the banner rather than being dropped silently. */
const OWN_FIELDS = ["invite_code", "email", "display_name", "password"];

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(() => params.get("email") ?? "");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState(() => params.get("invite") ?? "");
  const [error, setError] = useState<string | null>(null);
  const { fieldErrors, fieldProps, clearField, capture, reset } = useFieldErrors(OWN_FIELDS);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    reset();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!inviteCode.trim()) {
      setError("An invite code is required to sign up.");
      return;
    }
    setSubmitting(true);
    try {
      await signup(email, password, displayName, inviteCode.trim());
      navigate("/my-shows");
    } catch (err) {
      // Field messages first: every one reaches the user, the ones this form
      // has an input for against that input and anything else in the banner.
      const captured = capture(err);
      if (captured.handled) {
        setError(captured.banner);
      } else if (err instanceof ApiError && err.status === 403) {
        setError("Invite code is invalid, already used, or doesn't match this email.");
      } else if (err instanceof ApiError && err.status === 409) {
        setError("This email is already registered.");
      } else if (err instanceof ApiError && err.status === 422) {
        setError("Please check your input and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="text-2xl font-semibold mb-6">Sign up</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="invite_code" className="block text-sm">
            Invite code
          </label>
          <input
            id="invite_code"
            type="text"
            required
            value={inviteCode}
            onChange={(e) => {
              setInviteCode(e.target.value);
              clearField("invite_code");
            }}
            {...fieldProps("invite_code")}
            className="mt-1 w-full rounded border px-3 py-2"
            autoComplete="off"
          />
          <FieldError name="invite_code" message={fieldErrors.invite_code} />
          <p className="text-xs text-gray-500 mt-1">TV BingeFriend is invite-only during beta.</p>
        </div>
        <div>
          <label htmlFor="email" className="block text-sm">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearField("email");
            }}
            {...fieldProps("email", "email-help")}
            className="mt-1 w-full rounded border px-3 py-2"
          />
          <FieldError name="email" message={fieldErrors.email} />
          <p id="email-help" className="text-xs text-gray-500 mt-1">
            Your email won't be shown to other users, but they can find you with it to send a
            connection request.
          </p>
        </div>
        <div>
          <label htmlFor="display_name" className="block text-sm">
            Username
          </label>
          <input
            id="display_name"
            type="text"
            required
            maxLength={100}
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              clearField("display_name");
            }}
            {...fieldProps("display_name", "display-name-help")}
            className="mt-1 w-full rounded border px-3 py-2"
          />
          <FieldError name="display_name" message={fieldErrors.display_name} />
          <p id="display-name-help" className="text-xs text-gray-500 mt-1">
            This is the name other users will see on the site.
          </p>
        </div>
        <div>
          <label htmlFor="password" className="block text-sm">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearField("password");
            }}
            {...fieldProps("password")}
            className="mt-1 w-full rounded border px-3 py-2"
          />
          <FieldError name="password" message={fieldErrors.password} />
          <p className="text-xs text-gray-500 mt-1">At least 8 characters.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-black text-white py-2 disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        Already have an account?{" "}
        <Link to="/login" className="underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
