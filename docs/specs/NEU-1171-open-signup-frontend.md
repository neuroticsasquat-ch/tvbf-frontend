# Frontend: signup without a required invite code

**Ticket:** [NEU-1171](https://linear.app/neuroticsasquatch/issue/NEU-1171/frontend-signup-without-a-required-invite-code)
**Parent:** [NEU-1156](https://linear.app/neuroticsasquatch/issue/NEU-1156/make-the-invite-code-optional-at-signup) · **Milestone:** 3. Launch switch · **Project:** TVBF: Open Registration
**Backend half:** [NEU-1165](https://linear.app/neuroticsasquatch/issue/NEU-1165/backend-make-invite-code-optional-in-signuprequest) — Done, merged. Spec: [`tvbf-backend/docs/specs/NEU-1165-open-registration.md`](https://github.com/neuroticsasquat-ch/tvbf-backend/blob/main/docs/specs/NEU-1165-open-registration.md)
**Repo:** tvbf-frontend

## 1. Problem

`SignupPage` requires an invite code. The backend (NEU-1165) now accepts `invite_code: str | None` —
open registration is live server-side. The frontend must remove the client-side requirement so
strangers can sign up without a code, while preserving the invite-code flow for admins issuing
invites.

## 2. What changes

### 2.1 The invite code field — conditional and read-only

The field is **hidden** when no `?invite=` query param is present. A stranger arriving cold at
`/signup` sees four fields: email, display name, handle, password.

When `?invite=CODE` is present:

- The field **appears**, pre-filled with the query-param value.
- It is **read-only** (disabled input). An invite link is the only way to encounter the field;
  editing it away would silently convert an invited signup into an open one, losing pre-verification
  and auto-connect. If the code is wrong, the user needs a fresh link. Per NEU-1165 AC 2, a
  supplied code that fails validation is a hard 403 — there is no value in letting them retype it
  into the same form.

Edge case: `?invite=` (key present, value empty) is treated as no invite — field hidden, no code
sent. An empty string is not a code.

### 2.2 `?email=` pre-fill — unchanged

When `?invite=CODE&email=user@example.com` is present (the admin invite email link), both fields
are pre-filled. The email field remains **editable** — the `?email=` is a convenience, not a
security constraint (the backend enforces the `email_hint` match on the invite row).

### 2.3 API type update

`api/auth.ts` — the `signup` function's body type changes:

```ts
// before
invite_code: string;

// after
invite_code?: string;
```

The key is omitted from the JSON body when no invite code is used. The backend Pydantic model
(`str | None = None`) accepts both shapes.

### 2.4 Client-side validation

The current page checks that an invite code is non-empty before allowing submit. That check is
removed — it only applies when the field is visible (which implies a code *is* present, since it's
read-only and pre-filled from the query param).

The `403 invalid_invite` handler stays as-is with its generic message: *"Invalid invite code.
Please check the link and try again."* There is no value in distinguishing "consumed" from
"invalid" — both mean the user needs a fresh link.

### 2.5 Copy

AC 4: "Copy on the page no longer implies an invite is required."

The current page has no explicit "invite required" copy beyond the field label and the client-side
validation message. Removing the field from the default state handles this implicitly. If any
heading or description text references needing an invite, remove or rephrase it.

### 2.6 Invited-user toast

An invited signup auto-connects the inviter and invitee (NEU-1165 AC 5). The frontend should
communicate this on first arrival.

**Mechanism:** The signup page passes `{ invited: true }` via React Router's `location.state` when
navigating to `/my-shows` after a successful signup with an invite code. The My Shows page reads
the state, waits for the first `/me/connections` query to resolve, and shows a toast with the first
connection's username:

> You're now connected with @username.

The toast is transient (auto-dismiss). If `/me/connections` returns no connections (unlikely but
possible if auto-connect failed), the toast is suppressed. If the My Shows page mounts fresh (cold
load, no nav state), no toast — the toast is ephemeral by design.

**Implementation note:** The connection returned by `/me/connections` carries `display_name` and
`handle`. Use `handle` for the `@username` in the toast, since that's the identifier the user chose
and what appears throughout the app.

## 3. Acceptance criteria

- [ ] Invite code field is hidden when `?invite=` is absent from the URL.
- [ ] Invite code field appears (read-only, pre-filled) when `?invite=CODE` is present.
- [ ] `?invite=` with an empty value is treated as no invite.
- [ ] `?email=` still pre-fills the email field (editable) when present alongside `?invite=`.
- [ ] `invite_code?: string` in the `api/auth.ts` signup body type.
- [ ] Client-side validation no longer requires an invite code.
- [ ] `403 invalid_invite` still shows the generic error message; no silent fallthrough to open signup.
- [ ] Copy on the page no longer implies an invite is required.
- [ ] Invited signup navigates to `/my-shows` with `{ invited: true }` in location state.
- [ ] My Shows page shows a transient toast with the inviter's handle after the first connections query loads.
- [ ] Toast is suppressed if connections come back empty or the page mounts without nav state.
- [ ] MSW handler updated; `invite_code` optional in handler body.
- [ ] `task test`, `task lint`, `task typecheck` green.

## 4. Tests

At minimum:

- Signup with no `?invite=` renders no invite field; submit succeeds (201).
- Signup with `?invite=CODE` renders a read-only pre-filled invite field; submit includes the code.
- Signup with `?invite=INVALID` submits and shows the generic 403 error.
- `?invite=` (empty value) renders no invite field.
- `?email=` pre-fills the email field when present.
- Invited signup navigates to `/my-shows` with `{ invited: true }` state.
- My Shows shows the toast with the connection's username when state is `{ invited: true }`.
- My Shows suppresses the toast when connections are empty.

## 5. Not in scope

- Any change to the admin invite listing page.
- The `/admin/invites/email` flow (cookie-session admin UI) — unchanged.
- Adding an `invited_by` field to the signup response.
- A dedicated welcome interstitial page.
- The verification email flow — unchanged from the frontend's perspective.
