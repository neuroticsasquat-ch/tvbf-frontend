import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "@/components/AuthContext";
import { ApiError } from "@/api/client";
import { ErrorState } from "@/components/ErrorState";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRateLimited(false);
    setSubmitting(true);
    try {
      await login(email, password);
      const next = params.get("next") || "/my-shows";
      navigate(next);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Email or password is incorrect.");
      } else if (err instanceof ApiError && err.status === 429) {
        // The IP throttle covers login as well as signup (NEU-1160 §4.3), and
        // it is deliberately the one gate that does not hide behind the 401 —
        // so it gets the same distinct treatment the signup form gives it
        // rather than the generic banner, which would read as a server fault.
        setRateLimited(true);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="text-2xl font-semibold mb-6">Log in</h1>
      {rateLimited ? (
        <div className="mb-6">
          <ErrorState message="Too many sign-in attempts have come from your network. Please wait a while before trying again." />
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="text-right">
          <Link to="/forgot-password" className="text-sm underline">
            Forgot your password?
          </Link>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-black text-white py-2 disabled:opacity-50"
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        New here?{" "}
        <Link to="/signup" className="underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
