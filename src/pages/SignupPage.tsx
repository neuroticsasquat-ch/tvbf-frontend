import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/components/AuthContext";
import { ApiError } from "@/api/client";

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await signup(email, password, displayName);
      navigate("/my-shows");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
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
          <label htmlFor="email" className="block text-sm">Email</label>
          <input
            id="email" type="email" required
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="display_name" className="block text-sm">Display name</label>
          <input
            id="display_name" type="text" required maxLength={100}
            value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm">Password</label>
          <input
            id="password" type="password" required minLength={8}
            value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">At least 8 characters.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={submitting}
          className="w-full rounded bg-black text-white py-2 disabled:opacity-50">
          {submitting ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        Already have an account? <Link to="/login" className="underline">Log in</Link>
      </p>
    </div>
  );
}
