# Verification-required states on connect and people search

**Ticket:** [NEU-1167](https://linear.app/neuroticsasquatch/issue/NEU-1167/frontend-verification-required-states-on-connect-and-people-search)
**Parent:** [NEU-1152](https://linear.app/neuroticsasquatch/issue/NEU-1152/gate-social-actions-on-a-verified-email) · **Milestone:** 1. Trust boundary · **Project:** TVBF: Open Registration
**Backend half:** [NEU-1161](https://linear.app/neuroticsasquatch/issue/NEU-1161/backend-require-a-verified-email-for-connection-requests-and-search) — **merged 2026-08-19**. Its contract is `tvbf-backend/docs/specs/NEU-1161-a-verified-email-as-the-price-of-social-access.md` §4, cited throughout below.

## 1. Problem

NEU-1161 shipped the gate: `POST /connection-requests` now answers **403
`{"detail": "email_not_verified"}`** to an unverified caller, and `GET /users/search` filters
unverified people out of its rows. Nothing in the SPA knows this.

Today an unverified user opens Connections → Find People, searches, sees results, presses
**Connect** — and gets `toast.error("Could not send request. Try again.")`, because
`FindPeople`'s `onError` has a branch for 409 and a generic fallback for everything else. Trying
again produces the same 403 forever. That is precisely the "mystery 403" NEU-1152's second child
exists to prevent.

**Evidence:** `src/components/connections/FindPeople.tsx:47-54` — the `onError` handler, with no
403 branch; the button at `:137-141` is enabled unconditionally.

## 2. What already exists, and what this ticket actually adds

The ticket's ACs were written before the frontend was audited and assume less than is there. What
is **already shipped and needs no work**:

- **`UnverifiedEmailBanner`** (`src/components/UnverifiedEmailBanner.tsx`), mounted in `AppShell`
  behind `{user && …}`, rendering while `user.email_verified_at === null`. It carries a resend
  button wired to `authApi.requestEmailVerification()` → **`POST /me/email/verification`**, and it
  already maps **429** to "You've requested too many emails recently. Try again in a few minutes."
  **That closes AC 3 and the resend half of AC 2 as-is.**
- **The route correction.** AC 2 names `POST /email-verification`. That route does not exist and
  never did; the shipped client already calls the right one (NEU-1161 §4's correction). No change,
  recorded so the next reader does not "fix" the client to match the ticket.
- **The post-verification refresh.** `VerifyEmailPage` awaits `refresh()` before showing success,
  so the banner and every gated affordance unlock without a manual reload — the ticket's closing
  note, already satisfied.
- **`email_verified_at` on `AuthedUserOut`**, read through `useAuth()`. No API or type change.

What this ticket adds is three things: the **disabled connect state**, the banner's **dismiss
control and tone**, and a **403 backstop**.

## 3. Decisions

### 3.1 The connect affordance is `aria-disabled`, not `disabled`

Every **Connect** button in `FindPeople` is gated while the viewer is unverified, and the gate is
expressed exactly as NEU-1160 expressed the Turnstile gate on `SignupPage` — `aria-disabled` plus
`aria-describedby`, never the `disabled` attribute, with the real refusal in the click handler:

```tsx
aria-disabled={blocked || undefined}
aria-describedby={blocked ? "verify-gate-help" : undefined}
```

That comment (`SignupPage.tsx:219-224`) states the reason and it transfers verbatim: *a disabled
button leaves the tab order, taking the explanation of why it is disabled with it — the dead button
the AC exists to prevent.* Keyboard users reach the button, hear the description, and pressing it
hits the guard rather than the network.

**Rejected:** the `disabled` attribute with a `title` tooltip. Tooltips do not exist on touch, which
is where a phone-sized `FindPeople` row is most likely read, and a `disabled` control is skipped by
keyboard navigation entirely.

### 3.2 The explanation is one notice above the results, not one per row

A single `role="note"` line sits between the search box and the results list, holding the sentence
**and** a resend action, and every row's button points at it through `aria-describedby`. One copy of
the sentence for twenty rows.

**Why a second explanation exists at all, given the banner says the same thing:** §3.3 makes the
banner dismissible. A user who dismissed it and then walks to Find People would otherwise meet a
row of inert buttons with no reason anywhere on the page. The in-context notice is therefore **not
dismissible** — it is the floor the banner's dismissal cannot go below. It is also the answer to
NEU-1161 §3.1's deliberate choice to keep the search route answering `200`: the live page is what
gives this explanation somewhere to live.

**Rejected:** replacing the results with the explanation. It discards a working search page — and
the row the user wants is still findable, still worth seeing, and connectable the moment they
verify.

### 3.3 Dismissal lasts for the tab, and is keyed in `sessionStorage`

The banner gains a **Dismiss** control. Dismissal is stored in `sessionStorage` under
`tvbf.unverified-banner-dismissed`, so it is gone for this tab and back on the next visit.

That is what keeps "persistent but dismissible" honest in both directions: the prompt gets out of
the way of someone mid-task, and it does not vanish for good for someone who never verifies and
will keep meeting the gate. `localStorage` was rejected for that second reason — a day-one dismissal
would leave the account permanently unable to discover why Connect does nothing.

`usePersistedString` is **not** used: it is documented as unvalidated, returning whatever string is
stored, and this is a boolean-shaped flag read on every render of the shell. A three-line
`sessionStorage` read/write in the component is the whole mechanism; anything more is a hook nobody
else calls.

**Not in scope:** cross-tab dismissal sync. A second tab keeps its own banner, which is the correct
outcome for a per-tab dismissal anyway.

### 3.4 The 403 is read through one helper, not re-derived at call sites

`isEmailNotVerified(err)` lands beside `ApiError` in `src/api/client.ts`:

```ts
export function isEmailNotVerified(e: unknown): boolean {
  return (
    e instanceof ApiError &&
    e.status === 403 &&
    (e.body as { detail?: unknown } | null)?.detail === "email_not_verified"
  );
}
```

It reads the **wire shape** NEU-1161 §4 publishes — status *and* `detail`, because `csrf_invalid`
is also a 403 on the same route and must not be reported as a verification problem. This is the one
place in the SPA that knows the string. It does **not** re-implement the rule about *which* routes
are gated: that is one definition on the server (`require_verified_user`), exactly as
`recommendations/exclusion.py` is for suppression, and a client-side list of gated routes is a
second expression of it that drifts.

`FindPeople` uses it for an inline branch; anything else that catches an `ApiError` can use it for
an intelligible message. **AC 4's "any route" is served by the helper being callable, not by an
interceptor.**

**Rejected:** detecting the 403 inside `apiFetch` and firing a toast globally. It makes one status
special in the transport layer, and every call site wanting an inline state — which is this
ticket's whole point — would have to opt out of it.

### 3.5 The gate is on the send, never on the accept

`RequestsInbox`'s accept action is untouched, and a test says so. NEU-1152's asymmetry is
deliberate — *"an unverified user who was invited by a real person should still be able to say
yes"* — and NEU-1161 §3.3 kept the backend honest about it by never consulting the addressee. A
frontend that greys out **Accept** would re-impose the gate the backend went out of its way not
to.

Likewise untouched: browse, My Shows, Watch Next, Upcoming, every watch and rating control,
blocking, declining and disconnecting.

### 3.6 One copy of the sentence, one resend behaviour

The message and the resend flow are now needed in three places — the banner, the Find People
notice, and `VerifyEmailPage`'s error branch, which has its own copy today. Three is this repo's
own extraction threshold (NEU-1193 at the third focus-after-removal, NEU-1057 at the third library
mark), so:

- `src/lib/verification.ts` holds the copy strings.
- `src/hooks/useResendVerification.ts` holds the `idle | sending | sent | rate_limited | error`
  state machine and the 429 mapping, returning `{ status, resend }`.

`VerifyEmailPage` is migrated onto the hook in this ticket rather than left as a fourth copy —
that is the extraction, not scope creep; leaving it behind is what makes the next 429 copy change
miss a surface.

## 4. Copy

Tone is load-bearing here: this is shown to someone who signed up minutes ago and has done nothing
wrong, so it reads as *one more step*, never as an accusation or a security warning.

| Surface | Text |
|---|---|
| Banner | **One more step:** verify your email to connect with people and let them find you. |
| Banner actions | `Resend verification email` · `Dismiss` |
| Find People notice | Verify your email to connect with people — and to let them find you. |
| Connect button description | (the notice, via `aria-describedby`) |
| 403 backstop / inline | Verify your email first — check your inbox, or resend from the banner at the top. |
| Resend sent | Verification email sent. Check your inbox. |
| Resend 429 | You've requested too many emails recently. Try again in a few minutes. |

"and let them find you" is doing real work: it is the only place the SPA tells a user that
NEU-1161 §3.2 excluded them from other people's search results. Without it, being undiscoverable is
invisible.

## 5. Acceptance criteria

- [ ] An unverified viewer sees the Find People notice above the results, and every **Connect**
      button carries `aria-disabled` + `aria-describedby` pointing at it; a verified viewer sees
      neither and the buttons are ordinary.
- [ ] Clicking a gated **Connect** issues **no** request — asserted by the API spy, not by the
      absence of a toast.
- [ ] The notice renders whether or not the banner has been dismissed.
- [ ] The banner has a **Dismiss** control; dismissing removes it, and it returns when
      `sessionStorage` is cleared. A verified user never sees it, dismissed or not.
- [ ] `isEmailNotVerified` returns true only for 403 **with** `detail === "email_not_verified"`,
      and false for a 403 `csrf_invalid`, a 401, and a non-`ApiError`.
- [ ] A 403 `email_not_verified` from `POST /connection-requests` renders the §4 message rather
      than "Could not send request. Try again." (the backstop for a state the button gate missed —
      a verification that lapsed between page load and click).
- [ ] `RequestsInbox` accept works for an unverified viewer, asserted.
- [ ] At least one personal-tracking control (a My Shows toggle or an episode watch) is asserted
      to work for an unverified viewer.
- [ ] `useResendVerification` covers 202 → `sent` and 429 → `rate_limited`; the banner, the notice
      and `VerifyEmailPage` all go through it.
- [ ] MSW handlers exist for `GET /users/search`, `POST /connection-requests` (both the 201 and the
      403 `email_not_verified` shape) and `POST /me/email/verification` (202 and 429), so the wire
      shape is exercised rather than a hand-built `ApiError`.
- [ ] `task test`, `task lint`, `task typecheck` green.

## 6. Not in scope

- **Any backend change.** NEU-1161 shipped the contract; this ticket consumes it.
- **Cross-tab dismissal or cross-tab unlock** (§3.3). Verifying in another tab updates this one on
  the next `["me"]` refetch, which is the existing 60s `staleTime`.
- **A verification-required state on any other surface.** `POST /connection-requests` is the only
  route that emits the 403 (NEU-1161 §4), and no other affordance in the SPA sends one.
- **`invite_code` becoming optional** — NEU-1165, and the signup flow generally.
- **Bounce handling / losing verification once earned.** NEU-1159; NEU-1161 §3.5 records that
  nothing clears `email_verified_at` today, which is why no surface here handles a user who *had*
  access and lost it.
