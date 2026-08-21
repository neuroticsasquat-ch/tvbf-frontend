# NEU-1169 — Surface handles in signup, settings, search and profiles

**Ticket:** [NEU-1169](https://linear.app/neuroticsasquatch/issue/NEU-1169/frontend-surface-handles-in-signup-settings-search-and-profiles)
**Repo:** `tvbf-frontend`
**Parent:** [NEU-1154](https://linear.app/neuroticsasquatch/issue/NEU-1154/unique-user-handles) — Story
**Project:** TVBF: Open Registration — milestone *2. Identity*
**Blocked by:** [NEU-1163](https://linear.app/neuroticsasquatch/issue/NEU-1163) — shipped 2026-08-21
**Related:** [NEU-1198](https://linear.app/neuroticsasquatch/issue/NEU-1198) (shipped — the signup hotfix this spec inherits), [NEU-1196](https://linear.app/neuroticsasquatch/issue/NEU-1196) (shipped — the 422 field-error client)
**The contract:** [`tvbf-backend/docs/specs/NEU-1163-unique-user-handles.md`](https://github.com/neuroticsasquat-ch/tvbf-backend/blob/main/docs/specs/NEU-1163-unique-user-handles.md) — cited by section throughout
**Written:** 2026-08-21
**Status:** approved for implementation

This spec lives in this repo's `docs/specs/` because nothing in another repo
cites it: it is entirely a `tvbf-frontend` change consuming a contract that
already exists and shipped (CLAUDE.md's cross-repo-citation rule).

---

## 1. What this is

`app.user.handle` shipped on 2026-08-21. Every payload that names a user now
carries it, `PATCH /me/handle` exists, and `GET /users/search` matches on it.
The SPA collects one at signup and otherwise ignores the field entirely.

This ticket spends it: a shape check on the signup input, a way to change it in
settings, and the handle rendered beside the display name on every surface where
one user is looking at another as an entity.

The point is disambiguation at the moment of decision. NEU-1154's problem
statement is that two accounts called "Tom" are indistinguishable when someone
decides whether to accept a connection request, and that impersonating a real
friend therefore costs nothing. A handle stored but never drawn does not fix
that.

## 2. Findings that reshape the ticket

Each was established against the shipped code before any decision below.

**2.1 AC 1 is already half-shipped.** NEU-1198 was cut as a production hotfix
this morning — `POST /auth/signup` was refusing every request, because NEU-1163
made `handle` required while leaving collection to this ticket. It landed the
handle input with its `@` sigil, `handle` on the `User` DTO, `"handle"` in
`SignupPage`'s `OWN_FIELDS`, `AuthContext.signup` converted to an object
parameter, and the 409 split on `detail` so a taken handle no longer reports
`email_in_use`. What AC 1 still asks for and does not have is client-side
validation: the input carries `required`, `minLength={3}` and `maxLength={30}`
and nothing else.

**2.2 There is no way to tell a backfilled handle from a chosen one.**
`AuthedUserOut` carries `handle` and no origin field — no `handle_set_at`, no
flag. Pattern-matching `^user_[0-9a-f]{8}$` finds only the three cases where the
derivation gave up (empty, too short, reserved); it cannot distinguish
`@jeanne_briggs`-from-a-backfill from `@jeanne_briggs`-typed-at-signup. The
ticket's suggested one-time prompt therefore needs backend work that does not
exist. §8, D5.

**2.3 `ApiError` discards response headers.** `client.ts` parses the body and
throws, and the `Response` is in scope at the throw site but nothing reads it.
`ReportUserButton.tsx:231` documents this as the reason its 429 copy "parses no
header" — a limitation it worked around rather than a preference. NEU-1163
§6.2's 429 carries `Retry-After`, and its window is 30 days rather than that
route's 24 hours, so the workaround does not transfer. §5.3, D4.

**2.4 Two of the ten naming sites are prose, not entities.**
`FeedItemRow`'s `ActorLink` renders the name inside a sentence
(`Tom Boone added Severance to My Shows`) and `FriendActivity`'s `FriendList`
renders a `·`-separated enumeration, both inside a `<Link to={/users/:id}>`.
Everyone reachable through either is an **accepted connection** by construction.
§4.1, D6.

**2.5 `AdminReportUserRef` has no consumer here.** NEU-1163 §7 deliberately put
the handle on it, because NEU-1197 left `display_name` as a moderator's only
label. `AdminPage` has exactly two tabs, users and invites; `grep -rn
"admin/reports\|AdminReport" src` returns nothing. NEU-1197's frontend half is
unbuilt, so there is nothing here to surface it on. §9.

**2.6 A handle is 30 characters by contract.** NEU-1163 §1 sets the ceiling at
the width "a handle still fits beside a display name in a card caption at a
375px viewport". That is the *caption* case. On a connections row — ~343px
inside padding, less ~90px of `Connect`/`Disconnect` button — an inline
`{name} @{handle}` has ~250px, about 35 characters at `text-sm`. A 30-character
handle beside even a short display name exceeds it. §4.2, D7.

## 3. Signup

### 3.1 The shape check (D2, D3)

`SignupPage`'s handle input gains a client-side check of **the shape and
nothing else**:

```
^[a-z][a-z0-9_]{2,29}$
```

evaluated against the *normalised* form, never the raw one. Reserved words, the
`user_<8 hex>` pattern and uniqueness are not checked here — they are
server-owned and arrive as a 422 or 409 that NEU-1196's client already renders
against the field.

The check runs **on blur and on submit, not per keystroke** — `t` is invalid
until the third character, and erroring on it mid-word is hostile — and it
blocks submission, which is the round trip it exists to save.

### 3.2 Normalisation is predicted, not performed (D3)

NEU-1163 §1.1 deliberately *accepts* `TomBoone`, `@TomBoone` and
`  @tomboone `, storing `tomboone` for all three, because "a user who types
their own name the way they capitalise it, or pastes a handle with the sigil
they saw it printed with, gets the account they meant instead of a form error
about a rule they had no way to know."

So the shape check must normalise before it validates, or **the SPA becomes
stricter than the server** and refuses input the server would accept —
inverting §1.1 exactly.

A shared `normaliseHandle(raw)` — trim, strip one leading `@`, lowercase —
lives in `src/lib/handle.ts` beside the shape regex, and both write sites use
it. That mirrors the backend's own shape: one alias over one normaliser and one
validator, shared by two doors (§2), rather than a rule applied to the raw
string at one and the stripped string at the other.

Three things follow, and they are the whole of the decision:

* **The input keeps what was typed.** Nothing rewrites the field under the
  caret.
* **A preview line names the result**, rendered **only when normalisation
  actually changed something**: `You'll be @tomboone`. Echoing `@tom_b` back at
  someone who typed `tom_b` is noise. The field already draws a fixed `@` in a
  span outside the input, so someone pasting `@tom_b` sees `@@tom_b` — this is
  where they find out that is fine.
* **The raw string goes on the wire.** The server owns the normalisation; the
  preview is a *prediction* of it. This keeps `api/auth.ts`'s existing comment
  ("sent as typed — the server owns the normalisation, so lowercasing here would
  be a second copy of a rule that already has one") true rather than quietly
  making the SPA authoritative over a rule it only mirrors.

### 3.3 What deliberately does not change

The 409 split, `OWN_FIELDS`, the `@` sigil, the help text and the object-shaped
`AuthContext.signup` all shipped in NEU-1198 and are correct. This ticket adds
to that input; it does not rework it.

## 4. Rendering the handle

### 4.1 Where (D6)

Seven surfaces, each of which renders a person as an **entity** — the subject of
a row, a list item or a page header:

| Surface | Site |
|---|---|
| `connections/FindPeople` | people search results |
| `connections/RequestsInbox` | incoming (`requester`) **and** outgoing (`addressee`) |
| `connections/ConnectionsList` | the connections list |
| `connections/BlockedList` | the blocks list |
| `pages/FriendProfilePage` | the `h1` |
| `components/FriendRatingsList` | each friend's rating row |
| `components/admin/AdminUsersTab` | each user row |

**The two prose sites keep the display name alone** — `FeedItemRow`'s actor and
`FriendActivity`'s watched-by strip (§2.4). This is a boundary, not a shortcut:
everyone reachable through either is an accepted connection, and the
impersonation decision NEU-1154 exists to protect happens strictly *before* that
point. By the time someone appears in your feed you have already made the call
the handle is there to inform. `Tom Boone (@tom_boone) added Severance to My
Shows` is also a heavier sentence on a surface that runs to hundreds of rows.

The honest counter is that two *accepted* friends can both be called Tom, and
the feed is then ambiguous. That is a weaker ambiguity — they are both people
you chose, the display name is what you recognise them by, and the actor's name
is already a link to a profile that will carry the handle under this ticket.

### 4.2 `UserIdentity` (D7)

One component owns the pairing, in `src/components/UserIdentity.tsx`. That this
is one component rather than seven copies of `{name} <span>@{handle}</span>` is
this repo's settled answer: `ShowPoster` assigns every corner so no call site
decides placement, `OwnerFacts` groups a person's facts so attribution is
structural rather than per-surface discipline, and `rating.ts` owns one
vocabulary for three kinds of rating. Seven hand-rolled spans is precisely the
drift those three exist to prevent.

```tsx
interface Props {
  displayName: string;
  handle: string;
  /** Type scale, not layout. `row` is every list and card surface;
   *  `heading` is FriendProfilePage's h1. */
  size?: "row" | "heading";
}
```

**Always stacked** — display name on top, `@{handle}` beneath in muted
`text-xs`, both truncating. Not a layout choice per surface: §2.6 establishes
that inline works for the values we happen to hold today and breaks on values
the API is allowed to return. `OwnerFacts` reached the same answer the same way,
and its docstring records the reasoning — measured at the width that matters,
the inline form "wraps unpredictably at exactly the width that matters."

`size` is a **variant, not a `className`**, on `ShowPoster`'s precedent:
anything else is a new surface making a decision that belongs here.

The root carries `data-user-identity` for §7's tripwire.

**The handle is rendered with its `@`.** The sigil is not stored (NEU-1163 §1
normalises it away) and is not part of the value; it is how a handle is printed,
and printing it is what makes `@tom_boone` recognisable as the thing someone was
handed.

### 4.3 Confirmations and accessible names (D8)

Several of these surfaces build sentences and accessible names out of
`display_name`, at points that are consequential and in two cases destructive:

| Site | Today | Becomes |
|---|---|---|
| `ConnectionsList` block dialog | `Block Tom Boone? …` | `Block Tom Boone (@tom_boone)? …` |
| `ConnectionsList` disconnect dialog | `Disconnect from Tom Boone?` | `Disconnect from Tom Boone (@tom_boone)?` |
| `RequestsInbox` block dialog | `Block Tom Boone? …` | `Block Tom Boone (@tom_boone)? …` |
| `BlockedList` unblock dialog | `Unblock Tom Boone? …` | `Unblock Tom Boone (@tom_boone)? …` |
| `AdminUsersTab` switch | `aria-label="Admin status for Tom Boone"` | `…for Tom Boone (@tom_boone)` |
| `AdminUsersTab` disable/enable dialog | `title="Disable Tom Boone"` | `title="Disable Tom Boone (@tom_boone)"` |
| `ReportUserButton` | `userName={…display_name}` | `userName` gains the handle at each call site |

The admin switch is the sharpest case: it repeats down every row, so a screen
reader user moving through that list currently hears the **same accessible
name** on two different switches, one of which grants admin to the wrong person.

**Possessive prose keeps the display name.** `OwnerFacts`'s `ownerName` and
`rating.ts`'s `ratingLabel` continue to produce `Jeanne's rating: 4.0 out of 5`
and `Jeanne is caught up`. `@jeanne_briggs's rating` reads badly and
disambiguates nothing: you are already inside one named person's context, having
opened their library deliberately.

`OwnerFacts`'s docstring currently says the name truncates "because
`display_name` falls back to the account's email until NEU-1154 lands handles".
That has landed, and the answer is that this component deliberately keeps the
display name. Correct the line rather than leaving a stale forward-reference.

## 5. Changing a handle

### 5.1 The client (D9)

```ts
// src/api/auth.ts
export const updateHandle = (body: { handle: string }) =>
  apiFetch<AuthedUser>("/me/handle", { method: "PATCH", body: JSON.stringify(body) });
```

`AuthContext` gains `changeHandle`, mirroring `updateDisplayName` exactly —
`PATCH /me/handle` returns `AuthedUserOut` (NEU-1163 §6.2), so the same
`setCsrfToken(user.csrf_token)` + `qc.setQueryData(["me"], user)` pair on
success applies.

### 5.2 The form (D9)

It sits in `SettingsPage`'s existing **Profile** section, beneath the display
name, because the handle is the identifier and the display name is the label —
they belong together. An inline edit form mirroring the display-name editor one
block up: no `ConfirmDialog`. This repo reserves that dialog for destructive or
outward-facing acts — block, disconnect, unblock, disable, delete watch history
— and a handle change is none of those; NEU-1163 §4.2's same-owner exemption
makes it reversible by the person doing it.

Not editing shows the current handle with an `Edit` link, exactly as the display
name does.

**The section states all three consequences before the Edit link, not after
Save.** They are non-obvious, asymmetric, and unguessable from an edit field:

* People who have your old handle will not find you with it.
* Nobody else can ever take it — a released handle is permanently unclaimable
  by anyone but you (§4.2).
* You can change it 3 times every 30 days.

The throttle in particular has to be readable *before* the first change. A rule
first mentioned at save time has told them after they spent one.

The same `normaliseHandle` + shape check from §3.1 applies here, on blur and on
submit.

### 5.3 The 429 (D4)

`ApiError` gains a fifth constructor parameter and a field:

```ts
/** Seconds from `Retry-After`, when the response carried one and it parsed as
 *  a number. Undefined otherwise — including for the HTTP-date form, which
 *  this API does not send. */
readonly retryAfterSeconds: number | undefined;
```

parsed in `apiFetch`'s error branch, where the `Response` is already in scope.
`export.ts` constructs `ApiError` with three arguments and keeps compiling,
because the parameter is optional.

Settings renders a dated sentence:

> You've changed your handle recently. You can change it again on 20 September.

**This is a client capability, not a duplicated rule.** The number stays the
server's, exactly as `fieldErrors` has since NEU-1196. `ReportUserButton`'s
"name no number, parse no header" comment is right for a 24-hour window where
"tomorrow" is correct in almost every case; NEU-1163 §6.2's window is 30 days
and rolling, so the earliest retry is 30 days after the *oldest* of three
changes — a value the client cannot compute and which "later" describes
uselessly. Someone who spent three changes fixing a typo on day one is locked
out until day 31, and a message that will not say when sends them back to the
form daily.

`ReportUserButton` is **not** retrofitted onto the new field. It is a surface
this ticket has no other reason to open, and its existing copy is correct for
its own window.

### 5.4 The 409

One message, whatever the cause:

> That handle isn't available. Try another.

NEU-1163 §6.3 makes "held by a live account" and "released by a different
account" **byte-identical on purpose** — distinguishing them turns the surface
into a *has this handle ever existed* oracle, including for deleted accounts.
Rendering two messages would leak exactly the distinction the backend hid.

## 6. Search, types and fixtures

**`FindPeople`.** Both placeholders become `Search by display name, handle or
email`. `MIN_QUERY_LENGTH` counts the query **after** a leading `@` is stripped,
so the minimum means the same thing on both sides of the wire — the strip itself
stays server-side, since NEU-1163 §8 owns it and a client copy would be a second
definition. Nothing else changes: `@tom_b` already works today, and exact-match-
sorts-first is the server's ordering, consumed as given.

**`AdminUsersTab`.** Its client-side filter (`email` + `display_name`) gains
`handle`.

**`types.ts`** (AC 4). `handle: string` on `UserBrief`, `UserSearchResult`,
`AdminUserRow` and `FriendRatingItem`. `User` / `AuthedUser` already carry it
from NEU-1198.

**MSW** (AC 5). Every user fixture in `src/test/msw/handlers.ts` gains a handle;
a `PATCH /me/handle` handler returning the updated `AuthedUser`, with per-test
overrides for the 409 and the 429-with-`Retry-After`.

## 7. Tests

**The component owns its own assertions.** `UserIdentity.test.tsx` asserts the
stacked layout, the `@` prefix, truncation and both `size` variants. Each of the
seven surfaces asserts only that it renders through the component
(`[data-user-identity]`) and that the right props reach it.

This is `ShowPoster`'s precedent, verbatim: *"Placement is asserted once, in
`ShowPoster.test.tsx`; each surface's own test asserts only that it renders
through the component (`[data-show-poster]`), which is the tripwire against a
sixth surface hand-rolling one."* The alternative — seven tests each asserting
`@tom_boone` is on screen — looks more thorough and is weaker: it passes just as
happily when a surface hand-rolls its own span and drifts from the shared
layout, which is the failure the component exists to prevent.

Asserted at their own surfaces, because the sentences belong to the surfaces
rather than to the component:

* Each confirmation dialog's copy and each changed `aria-label` from §4.3.
* `OwnerFacts` / `ratingLabel` still produce `Jeanne's rating`, unchanged —
  a regression guard on the deliberate exception.

Owned by their own files:

* `client.test.ts` — `Retry-After` parses onto `ApiError`; a response without
  the header leaves `retryAfterSeconds` undefined; a non-numeric value does not
  throw.
* `handle.test.ts` — `normaliseHandle` on `TomBoone`, `@TomBoone`,
  `  @tomboone `, and the shape regex against NEU-1163 §10's own refusal set
  (`ab`, `a_very_long_handle_of_thirty_one`, `9lives`, `_tom`, `tom-boone`),
  plus `admin` and `user_3f4a2b1c` **passing** the shape check — the proof that
  the client stops at shape and leaves those two to the server.
* `SignupPage.test.tsx` — the preview line appears for `TomBoone` and is absent
  for `tom_b`; a bad shape blocks submission with no request sent.
* `SettingsPage.test.tsx` — a successful change updates the rendered handle; the
  409 renders the single message; the 429 renders a date.

## 8. Decisions

**D1 — The five production handles stand as final.** NEU-1163 §5.4 asked for the
derived values to be read from a `SELECT` and recorded on the ticket before the
migration reached production. The backend merge auto-deployed, so it never ran,
and shipping this ticket is what closes the window in which a wrong value was
correctable by a plain `UPDATE`. Accepted deliberately: the migration asserts its
own result (§5.3), and a wrong handle is now its owner's to change through §5's
form. The cost is that a correction retires the old value permanently into
`app.handle_release` and spends one of three monthly changes. *Rejected:* holding
this ticket behind a production `SELECT`, and filing that `SELECT` as a blocking
ticket — both re-run the race that lost the gate the first time.

**D2 — The client checks the shape and nothing else.** *Rejected:* vendoring
`RESERVED_HANDLES` into the SPA, the literal reading of AC 1. NEU-1163 §3.1 is
candid that the list is a snapshot nothing tracks and that it already exists
twice; a third copy would be the one that drifts fastest, and it would drift
*toward permissive* — telling a visitor `@moderator` is fine right up until the
server refuses it. CLAUDE.md's rule that the client never re-implements a server
rule is the general form of this, and NEU-1196 exists so the server's own
sentence renders against the field. The shape is the one exception because it is
stable, it is already printed verbatim in the help text, and it is the only rule
a user can fix *while typing*. *Also rejected:* mirroring `^user_[0-9a-f]{8}$` —
a fixed pattern that cannot drift, but one no visitor will ever trip, so it buys
a second copy for nothing.

**D3 — Normalisation is predicted in a preview line, not performed in the
field.** *Rejected:* rewriting the input live. It is the strongest
what-you-see-is-what-you-get answer and the field already draws its own sigil,
but stripping a leading `@` changes the string's length and moves the caret out
from under the typist. *Also rejected:* normalising silently at submit, which
keeps `api/auth.ts`'s comment true at the cost of the account quietly getting a
different identifier than the field showed.

**D4 — `ApiError` learns `Retry-After`.** §5.3. *Rejected:* `ReportUserButton`'s
vague copy, which is correct for a 24-hour window and useless for a rolling
30-day one; and naming the cap in client copy (`3 times every 30 days` as an
error message), which duplicates two `config.py` constants into the SPA.

**D5 — No one-time prompt for backfilled users.** The ticket asks for it to be
considered, and D1 makes it load-bearing: with the derived values final, the
settings form is the only correction path. It is still out of scope for two
reasons. §2.2 — targeting backfilled accounts specifically needs a payload field
that does not exist, so this frontend ticket would block on new backend work.
And the population is five accounts, all known personally, in a set that can
never grow: once NEU-1165 opens registration every subsequent account picks its
own handle at signup. *Rejected:* prompting everyone once, which needs no backend
field but shows a correction prompt to people who chose their handle themselves;
and prompting on the `user_<8 hex>` shape, which catches the least usable handles
and silently misses a derived-but-wrong `@jeanne_briggs`.

**D6 — Entity surfaces, not prose.** §4.1. *Rejected:* the literal reading of AC
3's closing clause ("everywhere one user looks at another"), which is
unarguable and costs a repeated handle on every line of a long feed for a
distinction that was already made upstream. *Also rejected:* decision points
only — `FindPeople` and `RequestsInbox` — which is the narrowest reading of the
ticket's own note and leaves the connections list ambiguous. *Also rejected:*
giving the prose sites the handle in `title`/`aria` alone, which gives a sighted
touch user nothing, since `title` does not exist on touch.

**D7 — One `UserIdentity`, always stacked, `size` as the only variant.** §4.2.
*Rejected:* inline with truncation, which is denser and holds for today's values
but squeezes the name to nothing against a contract-legal 30-character handle at
375px. *Also rejected:* an `inline`/`stacked` pair chosen per surface —
`OwnerFacts`'s exact shape, and the most flexible — because it hands every
future surface a layout decision, which is what `ShowPoster`'s corner rule
exists to stop. *Also rejected:* swapping the admin row's email line for the
handle to hold its height, which loses a field a moderator may actually need.

**D8 — Consequential copy names both; possessive prose does not.** §4.3.
*Rejected:* the uniform rule of adding it to every label, which yields
`Jeanne Briggs (@jeanne_briggs) is caught up` on every row of a friend's
library. *Also rejected:* leaving labels untouched, which keeps the two-Toms
ambiguity live on exactly the destructive confirmations and the repeated admin
switch where it costs most. *Also rejected:* the handle alone in confirmations,
unambiguous by construction but naming someone by a string the user may not
recognise at the moment they must decide.

**D9 — Explanatory copy, no confirm dialog.** §5.2. *Rejected:* a
`ConfirmDialog` on save, which is hardest to trip accidentally but breaks this
repo's pattern of reserving that dialog for destructive or outward-facing acts.
*Also rejected:* matching the display-name editor's minimal copy, which leaves
the throttle to be discovered by hitting it and the release rule undiscoverable
entirely.

**D10 — One component test, seven tripwires.** §7.

## 9. Out of scope

* **Live availability checking as the user types.** The ticket calls it optional
  and notes it would enumerate handles. NEU-1163 §12 puts the endpoint it would
  need out of scope explicitly: *"if it is wanted, it is its own ticket with its
  own throttle."* There is nothing to call.
* **A public profile URL.** No `/@handle` or `/{handle}` route. NEU-1163 §12 and
  §3.1 — the backend reserved the SPA's route names to keep the option open, and
  nothing more.
* **`AdminReportUserRef`'s handle.** §2.5 — NEU-1197's frontend half does not
  exist, so there is no surface to put it on. It is waiting for whichever ticket
  builds the admin report queue.
* **`FeedItemRow` and `FriendActivity`.** D6.
* **Retrofitting `ReportUserButton`'s 429 onto `retryAfterSeconds`.** §5.3.
* **A one-time prompt for backfilled users.** D5.
* **`GET /me/export`.** It carries the handle now; `downloadMyData` streams a
  blob and parses nothing, so there is no client change.

## 10. Acceptance criteria

- [ ] `src/lib/handle.ts` owns `normaliseHandle` and the shape regex, and both
      write sites use them.
- [ ] Typing `TomBoone` at signup shows `You'll be @tomboone`; typing `tom_b`
      shows no preview line at all.
- [ ] Pasting `@tom_b` into the signup field does not produce a form error, and
      the preview names `@tom_b`.
- [ ] `tom-boone` blocks submission with an inline message and sends no request;
      `admin` and `user_3f4a2b1c` **do** submit and are refused by the server,
      with the message rendered against the handle input.
- [ ] `SettingsPage` shows the current handle and changes it, updating every
      surface that draws it without a reload.
- [ ] A 409 from `PATCH /me/handle` renders one message that does not
      distinguish taken from previously-released.
- [ ] A 429 renders a sentence naming the date derived from `Retry-After`, and
      `ApiError.retryAfterSeconds` is undefined when the header is absent.
- [ ] The settings section states the release rule, the reclaim rule and the
      3-per-30-days throttle before the Edit control, not after Save.
- [ ] `UserIdentity` renders the display name over `@{handle}`, truncating both,
      at both `size` variants, and carries `data-user-identity`.
- [ ] All seven surfaces in §4.1's table render through `UserIdentity`; each
      surface test asserts the tripwire rather than the text.
- [ ] `FeedItemRow` and `FriendActivity` render the display name and **no**
      handle — asserted, so the boundary is deliberate rather than forgotten.
- [ ] The four confirmation dialogs and the admin switch's `aria-label` name
      both the display name and the handle.
- [ ] `OwnerFacts` and `ratingLabel` still produce `Jeanne's rating: 4.0 out of
      5`, and `OwnerFacts`'s stale NEU-1154 docstring line is corrected.
- [ ] Both `FindPeople` placeholders name the handle, and `MIN_QUERY_LENGTH`
      counts after a leading `@`.
- [ ] `AdminUsersTab`'s filter matches on handle.
- [ ] `UserBrief`, `UserSearchResult`, `AdminUserRow` and `FriendRatingItem`
      carry `handle`; MSW fixtures and the `PATCH /me/handle` handler exist.
- [ ] `task lint`, `task typecheck`, `task test` green.

## 11. Risks to verify in the browser at 375px

* A 30-character handle beside a long display name on a `ConnectionsList` row —
  both lines should truncate rather than push the action button off the row.
  §2.6 is reasoned from the contract, not measured against a rendered page.
* `FriendProfilePage`'s `h1` at `size="heading"` — the handle beneath a
  two-line wrapped display name.
* The signup preview line appearing and disappearing as the field is edited,
  which changes the form's height beneath an input the user is typing into.
