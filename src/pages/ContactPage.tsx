import { useCallback, useState } from "react";
import { ApiError } from "@/api/client";
import { submitContact } from "@/api/contact";
import { ErrorState } from "@/components/ErrorState";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { env } from "@/env";
import { cn } from "@/lib/cn";

const CAPTCHA_MESSAGES: Record<string, string> = {
  captcha_required: "Please complete the verification check and try again.",
  captcha_invalid: "The verification check couldn't be confirmed. Please try it again.",
  captcha_unavailable: "We couldn't reach the verification service. Please try again in a moment.",
};

const CAPTCHA_MISCONFIGURED = "Contact form is temporarily unavailable. Please try again shortly.";

function stringDetail(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const body = err.body;
  if (!body || typeof body !== "object" || !("detail" in body)) return null;
  const detail = (body as { detail: unknown }).detail;
  return typeof detail === "string" ? detail : null;
}

export function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const [success, setSuccess] = useState(false);
  const siteKey = env.turnstileSiteKey;
  const captchaEnabled = siteKey.length > 0;
  const handleCaptchaToken = useCallback((token: string | null) => setCaptchaToken(token), []);
  const captchaBlocked = captchaEnabled && !captchaToken;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRateLimited(false);
    if (captchaEnabled && !captchaToken) {
      setError("Please complete the verification check to continue.");
      return;
    }
    setSubmitting(true);
    try {
      await submitContact({
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        turnstileToken: captchaToken ?? undefined,
      });
      setSuccess(true);
      setName("");
      setEmail("");
      setMessage("");
      setCaptchaToken(null);
      setCaptchaNonce((n) => n + 1);
    } catch (err) {
      const detail = stringDetail(err);
      if (err instanceof ApiError && err.status === 429) {
        setRateLimited(true);
      } else if (detail === "captcha_required" && !captchaEnabled) {
        setError(CAPTCHA_MISCONFIGURED);
      } else if (detail !== null && detail in CAPTCHA_MESSAGES) {
        setError(CAPTCHA_MESSAGES[detail]);
      } else if (err instanceof ApiError && err.status === 422) {
        setError("Please check your input and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
      if (captchaEnabled) {
        setCaptchaToken(null);
        setCaptchaNonce((n) => n + 1);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-prose py-8">
        <h1 className="text-3xl font-semibold mb-4">Contact</h1>
        <p className="text-green-700">Message sent &mdash; we&apos;ll get back to you.</p>
        <footer className="mt-8">
          <time dateTime="2026-08-21">Last updated: 2026-08-21</time>
        </footer>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-prose py-8">
      <h1 className="text-3xl font-semibold mb-4">Contact</h1>
      {rateLimited ? (
        <div className="mb-6">
          <ErrorState message="Too many messages have been sent from your network. Please wait a while before trying again." />
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="contact-name" className="block text-sm">
            Name
          </label>
          <input
            id="contact-name"
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="block text-sm">
            Email
          </label>
          <input
            id="contact-email"
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="contact-message" className="block text-sm">
            Message
          </label>
          <textarea
            id="contact-message"
            required
            maxLength={5000}
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        {captchaEnabled ? (
          <TurnstileWidget key={captchaNonce} siteKey={siteKey} onToken={handleCaptchaToken} />
        ) : null}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          aria-disabled={captchaBlocked || undefined}
          aria-describedby={captchaBlocked ? "contact-captcha-gate-help" : undefined}
          className={cn(
            "w-full rounded bg-black text-white py-2 disabled:opacity-50",
            captchaBlocked && "opacity-50",
          )}
        >
          {submitting ? "Sending…" : "Send message"}
        </button>
        {captchaBlocked ? (
          <p id="contact-captcha-gate-help" className="text-xs text-gray-500">
            Complete the verification check above to continue.
          </p>
        ) : null}
      </form>
      <footer className="mt-8">
        <time dateTime="2026-08-21">Last updated: 2026-08-21</time>
      </footer>
    </div>
  );
}
