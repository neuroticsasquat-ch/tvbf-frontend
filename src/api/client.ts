import { env } from "@/env";
import type { ShowFilters } from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  /** Per-field messages from a FastAPI validation error, keyed by field name.
   * Undefined unless the body carried that shape — see `parseFieldErrors`. */
  readonly fieldErrors: Record<string, string> | undefined;
  /** Seconds from `Retry-After`, when the response carried one and it parsed as
   * a number. Undefined otherwise — including for the HTTP-date form, which
   * this API does not send.
   *
   * A client *capability*, not a duplicated rule (NEU-1169 §5.3): the number
   * stays the server's, exactly as `fieldErrors` has since NEU-1196. It exists
   * because `PATCH /me/handle`'s window is 30 days and rolling, so the earliest
   * retry is 30 days after the *oldest* of three changes — a value the client
   * cannot compute and which "later" describes uselessly. */
  readonly retryAfterSeconds: number | undefined;

  constructor(
    status: number,
    message: string,
    body: unknown,
    fieldErrors?: Record<string, string>,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.fieldErrors = fieldErrors;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Read `Retry-After` as a delta-seconds value.
 *
 * Only the numeric form. RFC 9110 also allows an HTTP-date, and this API sends
 * none — `str(seconds)` is what every throttled route sets — so parsing one
 * would be speculative handling of a shape that has never appeared on this
 * wire. Anything else, including an absent or empty header, is undefined
 * rather than a thrown error or a zero: a caller reading it renders a
 * vaguer sentence, which is what it would have said anyway. */
function parseRetryAfter(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const trimmed = raw.trim();
  // Guarded: `Number("")` is 0, which would read an empty header as
  // "retry immediately".
  if (trimmed.length === 0) return undefined;
  const seconds = Number(trimmed);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

/** The one place in the SPA that knows the wire shape of the verification
 * refusal NEU-1161 §4 publishes: `403 {"detail": "email_not_verified"}`.
 *
 * Both halves are checked. `csrf_invalid` and `admin_required` are also 403s
 * from the same `deps.py` vocabulary — one of them on the very route this
 * guards — and reporting either as a verification problem would send a user to
 * their inbox over a session fault.
 *
 * It deliberately does **not** know *which* routes are gated. That is one
 * definition on the server (`require_verified_user`), exactly as
 * `recommendations/exclusion.py` is for suppression, and a client-side list of
 * gated routes is a second expression of it that drifts. */
export function isEmailNotVerified(e: unknown): boolean {
  return (
    e instanceof ApiError &&
    e.status === 403 &&
    (e.body as { detail?: unknown } | null)?.detail === "email_not_verified"
  );
}

/** The location prefixes FastAPI puts ahead of the field name in `loc`. */
const LOC_PREFIXES = new Set(["body", "query", "path", "header", "cookie"]);

/** Pydantic v2 stamps the exception class onto the message it was raised with,
 * so a schema's `raise ValueError("...")` arrives as `Value error, ...`. That
 * prefix is the validator's, not the sentence the backend wrote for a user to
 * read, so it is stripped. Only this one form is stripped: it is the shape
 * measured against the live API, and Pydantic's other stamps have never
 * appeared on this wire. */
const PYDANTIC_PREFIX = /^Value error, /;

function locKey(loc: readonly unknown[]): string | null {
  const parts = loc.filter((p) => typeof p === "string" || typeof p === "number").map(String);
  if (parts.length === 0) return null;
  // Drop the "body"/"query"/... prefix so a form can index by its own field
  // name; a whole-body error (loc is the prefix alone) keeps it as the key.
  // This collapses namespaces on purpose — a `page` in the query and a `page`
  // in the body key alike, and the first one wins. No endpoint here validates
  // one name at both locations, and a form that knows only its own field names
  // is what the shape is for.
  const named = parts.length > 1 && LOC_PREFIXES.has(parts[0]) ? parts.slice(1) : parts;
  return named.join(".");
}

/** Read FastAPI's `{"detail": [{loc, msg, ...}]}` validation-error shape.
 *
 * Discriminates on the shape rather than on the status: a string `detail` (the
 * app's own hand-raised errors) and anything else fall through to `undefined`,
 * leaving the caller's existing message untouched. First entry wins per field,
 * which is the one a form should show. */
function parseFieldErrors(body: unknown): Record<string, string> | undefined {
  if (!body || typeof body !== "object" || !("detail" in body)) return undefined;
  const detail = (body as { detail: unknown }).detail;
  if (!Array.isArray(detail)) return undefined;

  const fieldErrors: Record<string, string> = {};
  for (const entry of detail) {
    if (!entry || typeof entry !== "object") continue;
    const { loc, msg } = entry as { loc?: unknown; msg?: unknown };
    if (typeof msg !== "string" || !Array.isArray(loc)) continue;
    const key = locKey(loc);
    if (key === null || key in fieldErrors) continue;
    fieldErrors[key] = msg.replace(PYDANTIC_PREFIX, "");
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}

let _csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  _csrfToken = token;
}

export function getCsrfToken(): string | null {
  return _csrfToken;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers({ Accept: "application/json", ...(init?.headers ?? {}) });

  if (method !== "GET" && method !== "HEAD") {
    if (_csrfToken) headers.set("X-CSRF-Token", _csrfToken);
  }

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    ...init,
    method,
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    let body: unknown = null;
    let message = `Request failed with status ${res.status}`;
    let fieldErrors: Record<string, string> | undefined;
    try {
      body = await res.json();
      if (body && typeof body === "object" && "detail" in body && typeof body.detail === "string") {
        message = body.detail;
      } else {
        fieldErrors = parseFieldErrors(body);
        // A caller that renders only `message` still gets a legible sentence;
        // one that indexes `fieldErrors` can put it against the right input.
        if (fieldErrors) message = Object.values(fieldErrors)[0];
      }
    } catch {
      // non-JSON body; keep generic message
    }
    throw new ApiError(
      res.status,
      message,
      body,
      fieldErrors,
      parseRetryAfter(res.headers.get("Retry-After")),
    );
  }

  // 204 and 205 are explicitly no-content; many of our 202 endpoints return
  // no body either. Avoid `res.json()` on those — empty-body parses throw.
  if (res.status === 204 || res.status === 205) return undefined as T;
  const text = await res.text();
  if (text.length === 0) return undefined as T;
  return JSON.parse(text) as T;
}

export function buildShowsQuery(filters: ShowFilters): string {
  const params = new URLSearchParams();
  if (filters.search && filters.search.length > 0) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.language) params.set("language", filters.language);
  if (filters.type) params.set("type", filters.type);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.page !== undefined) params.set("page", String(filters.page));
  if (filters.per_page !== undefined) params.set("per_page", String(filters.per_page));
  if (filters.genre) for (const g of filters.genre) params.append("genre", g);
  if (filters.network) for (const n of filters.network) params.append("network", String(n));
  return params.toString();
}
