import { http, HttpResponse } from "msw";
import { env } from "@/env";

export const VERIFIED_AT = "2026-01-01T00:00:00Z";

/** A signed-in `GET /me`. Verification state is the only thing callers vary,
 * so it is the only parameter — everything else is a plain, ordinary account.
 * The default handler in `handlers.ts` is a 401, so a test that wants a logged
 * -in viewer serves this. */
export function meHandler(emailVerifiedAt: string | null) {
  return http.get(`${env.apiBaseUrl}/me`, () =>
    HttpResponse.json({
      id: "u1",
      email: "alice@example.com",
      display_name: "Alice",
      created_at: "2026-01-01T00:00:00Z",
      email_verified_at: emailVerifiedAt,
      csrf_token: "test-csrf",
      activity_feed_enabled: true,
      is_admin: false,
    }),
  );
}
