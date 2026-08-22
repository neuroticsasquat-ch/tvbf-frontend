# NEU-1168 — Admin disable toggle and report-user action

**Ticket:** [NEU-1168](https://linear.app/neuroticsasquatch/issue/NEU-1168/frontend-admin-disable-toggle-and-report-user-action)
**Story:** [NEU-1153](https://linear.app/neuroticsasquatch/issue/NEU-1153/account-moderation-disable-and-report) · **Project:** TVBF: Open Registration · Milestone 1, Trust boundary
**Repo:** `tvbf-frontend` only. The backend half is
[NEU-1162](https://linear.app/neuroticsasquatch/issue/NEU-1162/backend-add-user-disable-flag-admin-route-and-report-user-endpoint),
merged as `a4b3ec7`; its spec is `docs/specs/NEU-1162-disable-and-report.md` and
**§7 is the request contract this one codes against**.
**Written:** 2026-08-20

Moderation exists on the wire and nowhere on screen. `PATCH
/admin/users/{id}/disabled` and `POST /reports` both shipped, and neither has a
caller: an admin can only disable an account with `curl`, and a user has no way
at all to say that another user is a problem. This spec is the two surfaces that
make the shipped capability reachable.

It resolves the ticket's one open question — the Notes' "typed confirmation or
at minimum a distinct dialog" — in favour of **a distinct dialog and no typed
string**, and records why in §4.2.

---

## 1. What is already decided elsewhere

Three things arrive settled from NEU-1162 and are restated here because getting
any of them wrong is invisible until it is in front of a user.

- **A disabled user's 401 is byte-identical to a logged-out one** (§2.2). There
  is no `account_disabled` detail and no new status code, deliberately. The SPA
  therefore needs **nothing** for that half: `RequireAuth` already handles the
  401 it has always handled.
- **Reporting is not gated on a verified email** (§7.2). NEU-1161's rule is that
  a verified mailbox is the price of *outreach*; a report touches Tom, not the
  reported user. Gating it would silence the newest accounts — exactly who a
  griefer targets — against the abuse they are most exposed to. `FindPeople`'s
  `gated` / `isEmailNotVerified` pattern is therefore **not** copied onto the
  report control. This is the single easiest mistake to make in this ticket,
  because the report button sits two lines from a Connect button that *is*
  gated.
- **Disable is reversible, and that is the point** (§1). Nothing is deleted;
  clearing the flag restores the account exactly, minus the sessions. Every word
  of copy below is written to make that true on screen, because a remedy the
  admin is afraid of is the remedy nobody reaches for.

## 2. Where a report action goes

AC 3 says "`FriendProfilePage` and wherever else a user is surfaced". Eight
components render another user's display name today, and "wherever else" is not
a rule, so here is one:

> **A report action goes where the person is the subject of the row — never
> where their name is a byline on a piece of content.**

| Surface | Report? | Why |
|---|---|---|
| `FriendProfilePage` header | yes | the page *is* a person |
| `ConnectionsList` row | yes | the row is a person |
| `RequestsInbox` — **incoming** row | yes | a stranger reaching you is the harassment case |
| `BlockedList` row | yes | blocking is private; reporting is the escalation from it |
| `RequestsInbox` — outgoing row | no | someone you chose to contact |
| `FindPeople` results | no | see below |
| `FriendRatingsList` | no | byline on a show |
| `FeedItemRow` / `FriendActivity` | no | byline on an activity |
| `OwnerFacts` | no | a fact about a person and a show, not a person |

**Search results were considered and rejected.** An abusive display name can
reach you through search before any interaction, which is a real
open-registration risk — but a report affordance beside every hit puts a
moderation control on the surface people scan fastest, and the reporter's 5-a-day
budget (NEU-1162 §6) is then spendable on strangers they have never dealt with.
If display-name abuse in search turns out to be the live problem, milestone 2
(Identity) is where it belongs, not here.

**The content surfaces lose nothing**, because every one of them links the name
to `/users/{id}`, which carries the labelled action.

## 3. The report control and its dialog

### 3.1 One component, owning everything

`components/ReportUserButton.tsx` owns the button, the dialog, the `POST
/reports` mutation and the block hand-off:

```tsx
<ReportUserButton
  userId={string}
  userName={string}
  variant="labelled" | "compact"   // default "compact"
  canBlock={boolean}               // default true
  onBlocked={(userId: string) => void}  // optional
/>
```

That is `DismissRecommendationButton`'s seam verbatim — the control owns its
mutation, and the optional callback reports *that something landed* so the
surface can react, rather than being the mutation coming back up. `MyShowCard`'s
`onRemoved` and `RecommendedForYou`'s `onDismissed` are the same shape, which is
why it is not re-argued here.

### 3.2 `labelled` on the profile, `compact` on rows

This is NEU-1187's labelled/compact pair one control over, and it is a
measurement, not a preference. `RequestsInbox`'s incoming row already carries
**Accept / Reject / Block**. At a 375px viewport the row is ~351px inside its
padding, and a fourth `size="sm"` button plus gaps runs the action group to
~275px, leaving ~75px for the display name — enough to truncate most real names
to two or three characters. A `Flag` icon chip is ~32px instead of ~66px and
keeps ~110px.

- `labelled` — a `size="sm" variant="outline"` button reading **Report**, in the
  `FriendProfilePage` header beside the name.
- `compact` — an icon-only `Flag` chip reusing `DismissRecommendationButton`'s
  shell treatment, in the three list rows' action groups.

**Both variants' accessible name carries the person's name** —
`Report {userName}` — for the reason NEU-1187 requires it of `MyShowsButton`:
the compact chip has no visible text at all, and a list of twenty rows renders
twenty identical controls. `Flag` is the glyph; it is not shared with any other
control in the app.

### 3.3 Two steps, one dialog

Built on the shadcn `ui/dialog` (Radix), like `FeedbackDialog` — a form and a
considered second decision both need a real modal.

**Step 1 — the form.** A `DialogDescription` that says a person reads every
report, one labelled `Textarea`, and Cancel / Send. Send is disabled until the
trimmed value is non-empty; `maxLength` is 5000. That is `FeedbackDialog`'s
shape and `FeedbackIn.body`'s bounds, which NEU-1162 §7.2 matched `reason` to on
purpose.

**The reason is bare free text.** A category `Select` was rejected: the backend
stores one `reason` column and no category, so a taxonomy could only be a
client-side string convention the server cannot enforce, parse or filter on —
and it is wrong the first time a report does not fit the boxes. Quick-pick chips
that prefill the textarea were rejected for the softer version of the same
problem: the report then arrives half-templated, and the specific detail is the
part most likely to be left off. §1.1 of NEU-1162 is explicit that the
reporter's own words are what an admin wants to re-read three months later.

**Step 2 — the confirmation.** On `204` the *same dialog* swaps to a panel that
says a human will read it and that **nothing happens to the reported account
automatically** (AC 4), then offers Block as a separate act (AC 5), then Done.

A toast was rejected for this: AC 4's sentence is precisely the kind that a
disappearing toast fails to deliver, and a considered second decision does not
belong in something that auto-dismisses. An inline panel on the page was
rejected because four surfaces would each need somewhere to put it.

**The dialog closing at any point is a complete flow.** The report is filed the
moment the 204 lands; step 2 is information and an offer, never a required step.

### 3.4 The block offer, and who knows whether to make it

`canBlock` is a prop the caller passes. `BlockedList` passes `false` — the
person is already blocked — and step 2 then says so instead of offering it. The
other three pass the default.

This is `MyShowsButton`'s contract: **the control takes the answer, never the
sources.** Reading `["blocks"]` inside the dialog was rejected because it fires
a `GET /me/blocks` from the profile page and the requests inbox to learn
something the calling surface already knows, and it is a second expression of a
fact that has an owner. Always offering it was rejected because offering an
action the app knows is pointless is the small dishonesty AC 5 exists against.

**Pressing Block calls the existing `useBlockUser` and closes the dialog.** The
block confirms itself by the row disappearing, which is exactly how the
row-level Block button beside it already confirms itself. `FriendProfilePage` is
the one exception: it resolves the friend out of `listConnections`, so a block
would leave the reader on a **"User not found"** screen as the direct result of
a deliberate act. It passes `onBlocked` and navigates to
`/friends?section=connections`.

### 3.5 Failure

| Status | What the user sees |
|---|---|
| `429 rate_limited` | step 1 stays open, **the typed reason is preserved**, and a distinct message says several reports have been filed recently and another can be filed tomorrow |
| `404 reported_user_not_found` | step 1 stays open with a generic failure line |
| `400 cannot_report_self` | backstop only — no surface renders the control on the viewer |
| anything else | the same generic failure line |

Three things about the 429, which is AC 6.

**It is not the generic banner.** The user did nothing wrong and the refusal is
temporary, which is the same distinction `useResendVerification` draws for its
own 429 and `LoginPage` draws for the IP throttle.

**It names no number and parses no header.** The cap is
`REPORT_THROTTLE_MAX`, a *configurable* server constant, so "5 a day" in client
copy is a second place for it to be wrong. The `Retry-After` header the backend
sends is invisible to the SPA — `ApiError` carries `status`, `message` and
`body` and no headers — and extending it was rejected: that is a change to
`api/client.ts`, the module every request passes through, for one route's
benefit, and it invites every other 429 handler to be rewritten to match. A
24-hour window makes "tomorrow" correct in every case but the one where the user
retries early and simply reads the same sentence again.

**The typed reason survives**, because destroying someone's written account of
harassment over a refusal that is explicitly temporary is the worst outcome
available here.

`400 cannot_report_self` cannot be reached today: none of the four surfaces ever
renders the viewer, and `FriendProfilePage` resolves the viewer's own id to
"User not found" already. It is handled anyway, as the same generic line.

## 4. The admin half

### 4.1 The row

`AdminUserRow` gains `disabled_at: string | null`, which `AdminUserOut` has
carried since NEU-1162 §7.1.

A disabled account shows a **`Disabled` badge** (`ui/badge`, `destructive`)
beside the display name, and **`Disabled 12 Aug`** appended to the existing
`Joined …` meta line. The date is shown because §1.1 made `disabled_at` the
*only* record the act leaves anywhere — there is no `disabled_by` and no
`disabled_reason`.

**No reordering and no new filter.** Floating disabled rows to the top was
rejected: it abandons the `created_at` order the backend returns and re-sorts
under the admin the moment they act. A "Disabled only" filter was rejected as
speculative at today's user count — the existing search box already answers
"find this person", and NEU-1197's report queue is the surface that will really
answer "who needs attention".

### 4.2 The control, and how heavy the confirmation is

A **button**, not a switch: a switch reads as a preference, and this is an act
on a person. It reads `Disable` or `Enable` depending on the row's state and
opens a dialog.

**No typed confirmation.** The ticket's Notes offered "a typed confirmation or at
minimum a distinct dialog", and the distinct dialog is the right end of that
range. Typed confirmation is the ceremony this app spends on irreversibility —
`DeleteAccountDialog` spends a password on it — and spending it here teaches the
admin that disable ≈ delete, which is the confusion AC 2 exists to prevent and
the confusion that makes disable a remedy nobody reaches for. The real value a
typed string would buy is guarding against acting on the wrong adjacent row in a
filtered list; the dialog naming the person in its title buys most of that for
none of the cost.

**Both directions confirm.** Re-admitting an account you disabled for abuse is a
real decision — arguably heavier than disabling, since the person on the other
side is one you already judged — and an accidental click should not silently
reopen the door.

Copy, which is AC 2 and is load-bearing:

- **Disable *{name}*** — "They will be signed out everywhere and cannot log in.
  Their watch history is kept, and you can re-enable them at any time. **This is
  not account deletion.**"
- **Enable *{name}*** — "They will be able to log in again. Their sessions ended
  when they were disabled, so they will need to sign in."

### 4.3 The viewer's own row

The Disable button is **not rendered** on the viewer's own row. A control that
exists only to be dead is worse than an absent one, and the row carries the
viewer's own email, so it needs no label to be recognised. No `[You]` badge is
added. The admin switch keeps its existing `disabled={isSelf}`.

The `403 cannot_disable_self` stays as a mutation backstop for a stale list.

### 4.4 The mutation is not optimistic

`useToggleDisabled` in `api/admin.ts`:

- `onSuccess` writes the returned `AdminUserOut` over that row in
  `["admin-users"]`.
- `onError` shows a generic `toast.error` **and invalidates** `["admin-users"]`,
  because a 403 or 404 here means the list the admin is reading is stale.

**Deliberately unlike `useToggleAdminFlag`, which is optimistic.** `is_admin` is
a boolean the client already knows the next value of; `disabled_at` is a
timestamp the *server* chooses, so an optimistic update would have to invent one
and then be corrected. That is NEU-1178's rule for the same situation, and the
route returning the full row makes `setQueryData` on success exact rather than
approximate.

## 5. `ConfirmDialog` is promoted

`components/connections/ConfirmDialog.tsx` moves to
`components/ConfirmDialog.tsx` and is **reimplemented over `ui/dialog`**, props
unchanged (`title`, `description`, `confirmLabel`, `destructive`, `pending`,
`onConfirm`, `onClose`).

The existing one is a hand-rolled `role="dialog"` overlay with **no focus trap,
no Escape, no `aria-modal` and no focus restore**. The two admin confirmations
are exactly the ceremony AC 2 is about, so inheriting an untrapped modal for
them is the wrong trade; and a second area needing the component is this repo's
own extraction threshold (NEU-1193 at the third focus-after-removal, NEU-1057 at
the third library mark).

Its three existing callers — `ConnectionsList`, `RequestsInbox`, `BlockedList` —
are updated to the new path and silently gain the four behaviours above.

`ConnectionsList`'s inline `RemoveConfirmDialog` is **converted to it as well**:
it is the same picture built differently, sitting in the one file that already
renders a `ConfirmDialog`, which is the state that made this a decision at all.
The mutation stays where it is; only the presentation is replaced.

`DeleteAccountDialog` and `ChangePasswordDialog` are **left alone**. They hold
input fields, so they are forms rather than confirmations, and folding them in
would widen this component's contract. Converting the account-deletion flow in a
moderation ticket is also where a regression is most expensive.

## 6. Testing (AC 7)

- A **default `POST /reports` → 204** handler in `src/test/msw/handlers.ts`, so
  any surface test that renders the control does not fail on an unhandled
  request. Its failure paths (`429`, `404`) are per-test `server.use` overrides.
- `PATCH /admin/users/:id/disabled` is stubbed **per-test**, matching how
  `GET /admin/users` and the existing admin toggle are already handled in
  `AdminPage.test.tsx` — those routes are not in the global handler set.
- The four report call sites do **not** each re-test the dialog. `ReportUserButton`
  owns one test for the flow, the variants, the copy and the failure branches;
  each surface asserts only that it renders the control with the right props,
  which is the discipline `ShowPoster.test.tsx` established (placement asserted
  once, surfaces assert `[data-show-poster]`).

## 7. Acceptance criteria

1. `AdminUsersTab` renders a `Disabled` badge and a `Disabled <date>` meta line
   for any row whose `disabled_at` is non-null, and neither for a row where it
   is null.
2. Each other user's row carries a `Disable` / `Enable` button reflecting that
   row's state; the viewer's own row carries **no** such button.
3. Clicking `Disable` opens a dialog naming that user whose body states all
   three of: sessions are revoked, login is blocked, it is reversible — and
   which says it is not deletion. No request is issued until Confirm.
4. Clicking `Enable` opens its own dialog, and no request is issued until
   Confirm. Cancel on either dialog issues nothing.
5. A successful toggle updates that row from the response body without a
   refetch; a failed one shows a toast and invalidates `["admin-users"]`.
6. `ReportUserButton` renders labelled in the `FriendProfilePage` header and
   compact in `ConnectionsList`, `RequestsInbox`'s incoming rows and
   `BlockedList` — and is **absent** from outgoing request rows, `FindPeople`,
   `FriendRatingsList`, `FeedItemRow` and `OwnerFacts`.
7. Both variants expose an accessible name containing the reported user's
   display name.
8. Submitting a reason `POST`s `{reported_user_id, reason}` and, on 204, swaps
   the same dialog to a confirmation that states a person will read it and that
   nothing happens to the account automatically.
9. Step 2 offers Block where `canBlock` is true and does not on `BlockedList`;
   pressing it calls the existing block mutation and closes the dialog.
10. Reporting from `FriendProfilePage` and then blocking navigates to
    `/friends?section=connections` rather than leaving the reader on "User not
    found".
11. A `429` leaves the dialog on step 1 **with the typed reason intact** and
    renders a rate-limit message distinct from the generic failure; a `404`
    renders the generic failure.
12. An **unverified** account can open, submit and complete the report flow —
    no verification gate, no `email_not_verified` handling on this path.
13. `components/ConfirmDialog.tsx` is built on `ui/dialog` and is the component
    used by `ConnectionsList` (both dialogs), `RequestsInbox`, `BlockedList` and
    both admin dialogs; no `ConfirmDialog` remains under
    `components/connections/`.
14. `task test`, `task lint`, `task typecheck` all green.

## 8. Out of scope

- **The report queue UI.** `GET /admin/reports` does not exist —
  [NEU-1197](https://linear.app/neuroticsasquatch/issue/NEU-1197/backend-admin-read-route-for-user-reports)
  is the backend for it and is still in Backlog. Until then a filed report
  becomes visible through Linear and the maintainer email, and the admin's only
  handle on a reported account is the disable button this ticket adds.
- **Focus after a block removes its row.** Focus falls to `<body>`, which is
  what the row's existing Block button has always done. Fixing only the new path
  would leave the identical older path broken; `useFocusAfterRemoval` would also
  need its key widening from `number` to `string`, since users are UUIDs. One
  later ticket closes both paths at once.
- **Anything for the disabled-user 401** (NEU-1162 §2.2) — it is deliberately
  indistinguishable from logged-out, and `RequireAuth` already handles it.
- **A report action on search results** (§2).
- **A category taxonomy for reports** (§3.3) — needs a backend column first.
- **Surfacing `Retry-After`** (§3.5) — an `api/client.ts` change with one
  beneficiary.
- **Converting `DeleteAccountDialog` / `ChangePasswordDialog`** to Radix (§5).

## 9. Notes for the implementation

- `AdminUserRow` in `src/api/types.ts` gains `disabled_at: string | null`. It is
  the only type change; `UserOut` and `AuthedUserOut` deliberately do not carry
  it (NEU-1162 AC 13).
- `useBlockUser` lives at `components/connections/useBlockUser.ts` and is
  imported by `ReportUserButton` from outside that folder. That is fine and
  deliberate — it is the one blocking mutation in the app, and it already
  reconciles all three connection caches optimistically.
- Copy stays inside the components. `lib/verification.ts`'s extraction was
  earned by *three surfaces* saying the same sentences; here one component says
  them at four call sites, so there is nothing to extract.
- `ReportUserButton`'s dialog state is per-instance, matching
  `RemoveWatchHistoryButton`. It is not hoisted to the surface the way
  `ConnectionsList` hoists `pendingBlock`, because the control owning its own
  mutation is what makes the four call sites one-liners.
- Neither `docs/adr/` nor `CONTEXT.md` gains an entry: both live in
  `tvbf-backend/`, and every decision here is a frontend presentation choice
  already recorded in this file.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
