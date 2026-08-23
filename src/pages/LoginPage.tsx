import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "@/components/AuthContext";
import { ApiError } from "@/api/client";
import { ErrorState } from "@/components/ErrorState";
import {
  PlayCircle,
  Calendar,
  Library,
  Users,
  Tv,
  Sparkles,
} from "lucide-react";

const FEATURES = [
  {
    icon: PlayCircle,
    title: "Watch Next",
    description: "See what episode to watch next for every show you follow.",
  },
  {
    icon: Calendar,
    title: "Upcoming",
    description: "Never miss a premiere with a curated view of upcoming episodes.",
  },
  {
    icon: Library,
    title: "My Shows",
    description: "Track your entire watchlist and see your progress at a glance.",
  },
  {
    icon: Users,
    title: "Friends",
    description: "Connect with friends to see what they're watching and share recommendations.",
  },
];

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
        setRateLimited(true);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-8 py-12 md:grid-cols-2 md:items-start">
      {/* Hero / Marketing */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <Tv className="h-6 w-6" aria-hidden />
          TV BingeFriend
        </div>
        <p className="text-lg text-muted-foreground">
          Track your TV shows, discover what to watch next, and keep up with
          what your friends are bingeing.
        </p>
        <ul className="flex flex-col gap-4">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex gap-3">
              <div className="mt-0.5 shrink-0 rounded border p-1.5">
                <f.icon className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="font-medium leading-tight">{f.title}</p>
                <p className="text-sm text-muted-foreground leading-snug">
                  {f.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 text-sm text-muted-foreground border-t pt-4">
          <Sparkles className="h-4 w-4" aria-hidden />
          <span>Powered by TMDB data — browse 200,000+ shows</span>
        </div>
      </div>

      {/* Login form */}
      <div className="w-full">
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
    </div>
  );
}
