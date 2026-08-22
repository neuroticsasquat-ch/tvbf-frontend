import { useCallback, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { ApiError } from "@/api/client";
import { useAuth } from "@/components/AuthContext";
import { ErrorState } from "@/components/ErrorState";
import { FieldError } from "@/components/FieldError";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { env } from "@/env";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { cn } from "@/lib/cn";
import { HANDLE_SHAPE_MESSAGE, isHandleShapeValid, normaliseHandle } from "@/lib/handle";

/** The request fields this form has an input for. A 422 naming anything else
 * falls back to the banner rather than being dropped silently.
 *
 * `invite_code` is always in the list even when the field is hidden — a 422
 * about it would be anomalous (the server only validates a supplied code), but
 * dropping it from the list would silently swallow the message. */
const OWN_FIELDS = ["invite_code", "email", "display_name", "handle", "password"];

/** The backend's four abuse-gate outcomes carry a plain-string `detail`
 * (NEU-1160 §7), which is a machine token rather than a sentence — so each is
 * mapped here rather than being surfaced through `ApiError.message`. */
const CAPTCHA_MESSAGES: Record<string, string> = {
  captcha_required: "Please complete the verification check and try again.",
  captcha_invalid: "The verification check couldn't be confirmed. Please try it again.",
  captcha_unavailable: "We couldn't reach the verification service. Please try again in a moment.",
};

/** The backend's switch (`TURNSTILE_ENABLED`) and this one (a site key) live in
 * different systems, and nothing reconciles them — so verification can be on
 * server-side while the SPA has no key and draws no widget. Every signup then
 * gets `captcha_required`, and telling the visitor to complete a check that is
 * not on the page is the silently-unusable form AC 4 calls the worst outcome.
 * It is a misconfiguration rather than anything they can act on, so it is
 * reported as one. */
const CAPTCHA_MISCONFIGURED = "Sign-up is temporarily unavailable. Please try again shortly.";

function stringDetail(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const body = err.body;
  if (!body || typeof body !== "object" || !("detail" in body)) return null;
  const detail = (body as { detail: unknown }).detail;
  return typeof detail === "string" ? detail : null;
}

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(() => params.get("email") ?? "");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const rawInvite = params.get("invite");
  // `?invite=` with no value is treated as no invite (NEU-1171 §2.1).
  const hasInvite = rawInvite !== null && rawInvite.length > 0;
  const inviteCode = rawInvite ?? "";
  const [error, setError] = useState<string | null>(null);
  const { fieldErrors, fieldProps, clearField, setFieldError, capture, reset } =
    useFieldErrors(OWN_FIELDS);
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Bumping this remounts the widget, which is how a spent token is replaced —
  // the backend verifies the token before it can fail for any other reason, so
  // every rejected attempt leaves the one in hand already used up.
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const siteKey = env.turnstileSiteKey;
  const captchaEnabled = siteKey.length > 0;
  const handleCaptchaToken = useCallback((token: string | null) => setCaptchaToken(token), []);
  const captchaBlocked = captchaEnabled && !captchaToken;
  // The prediction, shown **only when normalisation actually changed
  // something** (D3). Echoing `@tom_b` back at someone who typed `tom_b` is
  // noise; telling someone who typed `@TomBoone` what they will actually be
  // called is the whole point, and this input draws a fixed `@` outside itself,
  // so a pasted sigil reads as `@@tom_b` until this line explains it.
  const normalisedHandle = normaliseHandle(handle);
  const handlePreview =
    handle.length > 0 && normalisedHandle !== handle && normalisedHandle.length > 0
      ? normalisedHandle
      : null;
  /** The shape check, run on blur and on submit — never per keystroke: `t` is
   * invalid until the third character, and erroring on it mid-word is hostile
   * (§3.1). Reserved words, the `user_<8 hex>` pattern and uniqueness are the
   * server's and are deliberately not checked here. */
  function checkHandleShape(): boolean {
    if (handle.length === 0 || isHandleShapeValid(handle)) {
      clearField("handle");
      return true;
    }
    setFieldError("handle", HANDLE_SHAPE_MESSAGE);
    return false;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRateLimited(false);
    reset();
    // Before the password and invite checks, so the first thing wrong with the
    // form is what the visitor is told about. It blocks submission, which is
    // the round trip it exists to save.
    if (!checkHandleShape()) {
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (captchaEnabled && !captchaToken) {
      setError("Please complete the verification check to continue.");
      return;
    }
    setSubmitting(true);
    try {
      await signup({
        email,
        password,
        displayName,
        handle,
        ...(hasInvite ? { inviteCode: inviteCode.trim() } : {}),
        turnstileToken: captchaToken ?? undefined,
      });
      navigate("/my-shows", hasInvite ? { state: { invited: true } } : undefined);
    } catch (err) {
      const detail = stringDetail(err);
      // Field messages first: every one reaches the user, the ones this form
      // has an input for against that input and anything else in the banner.
      const captured = capture(err);
      if (captured.handled) {
        setError(captured.banner);
      } else if (err instanceof ApiError && err.status === 429) {
        // Not a validation error and not this form's fault, so it gets the
        // page-level treatment rather than a line under an input (AC 5).
        setRateLimited(true);
      } else if (detail === "captcha_required" && !captchaEnabled) {
        setError(CAPTCHA_MISCONFIGURED);
      } else if (detail !== null && detail in CAPTCHA_MESSAGES) {
        setError(CAPTCHA_MESSAGES[detail]);
      } else if (err instanceof ApiError && err.status === 403) {
        setError("Invite code is invalid, already used, or doesn't match this email.");
      } else if (err instanceof ApiError && err.status === 409) {
        // Two conflicts share this status and they name different fields
        // (NEU-1163 §6.3), so the branch has to read `detail`. Left as one
        // message, a taken handle would tell the visitor their email was
        // already registered — a refusal pointing at the wrong input, on the
        // one form submitting both.
        setError(
          detail === "handle_unavailable"
            ? "That username is already taken. Please choose another."
            : "This email is already registered.",
        );
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

  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="text-2xl font-semibold mb-6">Sign up</h1>
      {rateLimited ? (
        <div className="mb-6">
          <ErrorState message="Too many sign-up attempts have come from your network. Please wait a while before trying again." />
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-4">
        {hasInvite ? (
          <div>
            <label htmlFor="invite_code" className="block text-sm">
              Invite code
            </label>
            <input
              id="invite_code"
              type="text"
              disabled
              readOnly
              value={inviteCode}
              {...fieldProps("invite_code")}
              className="mt-1 w-full rounded border bg-muted px-3 py-2 text-muted-foreground"
              autoComplete="off"
            />
            <FieldError name="invite_code" message={fieldErrors.invite_code} />
            <p className="text-xs text-gray-500 mt-1">You were invited with this code.</p>
          </div>
        ) : null}
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
          <label htmlFor="handle" className="block text-sm">
            Handle
          </label>
          <div className="mt-1 flex items-center rounded border focus-within:ring-2 focus-within:ring-ring">
            <span aria-hidden="true" className="pl-3 text-gray-500 select-none">
              @
            </span>
            <input
              id="handle"
              type="text"
              required
              minLength={3}
              maxLength={30}
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value);
                clearField("handle");
              }}
              onBlur={checkHandleShape}
              {...fieldProps(
                "handle",
                handlePreview ? "handle-preview handle-help" : "handle-help",
              )}
              className="w-full rounded-r bg-transparent px-1 py-2 focus:outline-none"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          <FieldError name="handle" message={fieldErrors.handle} />
          {handlePreview && (
            <p id="handle-preview" className="text-xs text-gray-500 mt-1">
              You&apos;ll be @{handlePreview}
            </p>
          )}
          <p id="handle-help" className="text-xs text-gray-500 mt-1">
            3–30 characters: lowercase letters, numbers and underscores, starting with a letter.
            This is how people tell you apart when two of you share a name, and you can change it
            later.
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
        {captchaEnabled ? (
          <TurnstileWidget key={captchaNonce} siteKey={siteKey} onToken={handleCaptchaToken} />
        ) : null}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          // `aria-disabled` rather than `disabled` while the challenge is
          // outstanding: a disabled button leaves the tab order, taking the
          // explanation of why it is disabled with it — the dead button AC 3
          // exists to prevent. Focusable means the description is announced,
          // and pressing it hits the guard in `onSubmit`, which says the same
          // thing in the banner.
          aria-disabled={captchaBlocked || undefined}
          aria-describedby={captchaBlocked ? "captcha-gate-help" : undefined}
          className={cn(
            "w-full rounded bg-black text-white py-2 disabled:opacity-50",
            captchaBlocked && "opacity-50",
          )}
        >
          {submitting ? "Creating account…" : "Sign up"}
        </button>
        {captchaBlocked ? (
          <p id="captcha-gate-help" className="text-xs text-gray-500">
            Complete the verification check above to continue.
          </p>
        ) : null}
      </form>
      <p className="mt-4 text-xs text-muted-foreground">
        By signing up, you agree to our{" "}
        <Link to="/terms" className="underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link to="/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
      <p className="mt-4 text-sm">
        Already have an account?{" "}
        <Link to="/login" className="underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
