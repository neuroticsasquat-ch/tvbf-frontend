# NEU-1190 — Listing-surface cleanup

**Ticket:** [NEU-1190](https://linear.app/neuroticsasquatch/issue/NEU-1190/listing-surface-cleanup-duplicate-links-empty-state-copy-raw-language)
**Project:** TVBF: Open Registration · Milestone 0, UI consistency
**Repo:** `tvbf-frontend` only
**Written:** 2026-08-19

Four small defects found in the Milestone 0 card-surface audit, sharing a surface
but no root cause. Grouped so they land in one pass rather than four.

The ticket was written on 2026-08-18 and six tickets have merged since
(NEU-1183, 1186, 1187, 1188, 1189, 1192, 1193). That moves the ground under
three of its five items, and this spec supersedes the ticket wherever they
disagree. §6 and §7 record what changed and why.

---

## 1. Item 1 — one tab stop per list row

### 1.1 What is wrong

Four list rows render two adjacent links to the same show with identical
accessible names: the poster and the row's title. A keyboard user tabs through
the same destination twice per row, and a screen-reader user hears
`link "1983"`, `link "1983"` and learns nothing from the second.

The ticket names two files. There are **six** `size="row"` poster call sites,
and they split into two groups:

| Surface | Poster link | Text link | Duplicate? |
|---|---|---|---|
| `ShowList` (search results) | `/shows/{id}` | `/shows/{id}` | **yes** |
| `UpcomingShowsList` | `/shows/{id}` | `/shows/{id}` | **yes** |
| `LibraryActiveList` → `ActiveRow` | `/shows/{id}` | `/shows/{id}` | **yes** |
| `LibraryWatchedList` → `WatchedRow` | `/shows/{id}` | `/shows/{id}` | **yes** |
| `EpisodeRow` (Watch Next, Upcoming) | `/shows/{id}` | `/episodes/{id}` | no |
| `UpcomingSeasonsList` | `/shows/{id}` | `/shows/{id}/episodes?season=N` | no |

### 1.2 Only the four duplicates collapse

The defect is *two links with identical accessible names to one destination*.
Two links with different names to different destinations is a row offering two
things, which is ordinary and is not what the audit flagged. `EpisodeRow` and
`UpcomingSeasonsList` are therefore **exempt**, and collapsing them would delete
the only keyboard route from those rows to the show page in exchange for a tab
stop that confused nobody.

`EpisodeRow`'s docstring currently claims this ticket will "collapse [the extra
tab stop] across all of them at once". That is wrong about what this ticket
does and **is corrected as part of the work**, to state why a row whose text
names a different destination keeps both links.

### 1.3 The poster stops being a link, rather than being hidden

The obvious fix — `aria-hidden` + `tabIndex={-1}` on the poster's link — is
**wrong here**, and the reason is specific to this component. `ShowPoster`
renders `InMyShowsBadge` and `RatingBadge` *inside* its `<Link>`, deliberately
(NEU-1183), so their `title` tooltip stays hoverable and a tap on one still
navigates. Both are `role="img"` with an `aria-label`. `aria-hidden` removes the
whole subtree, so it would delete "In your My Shows" and "Your rating: 4.5 out
of 5" from the accessibility tree on every row — trading one a11y defect for a
worse one.

So on a presentational row the poster **renders no link at all**: a plain
wrapper and an `<img>`, with the badges exactly where they are, keeping every
label and tooltip. A row poster that is not a link, sitting beside text that is,
is an ordinary pattern.

**Cost, accepted:** the poster is no longer a click or tap target on those four
rows. The adjacent text link is the route. The alternative that preserves the
tap target — move both fact badges out into the sibling overlay layer with
`pointer-events-auto`, then `aria-hidden` the link — was rejected: it reopens a
decision NEU-1183 reasoned out explicitly and pins with a test
(`"keeps both fact badges hoverable, inside the link rather than under an inert
layer"`), and it restructures the overlay for all eleven poster surfaces to buy
a 64px target on four rows.

### 1.4 The prop shape

`ShowPoster` takes `to: string` and `linkLabel: string`, both required. With no
link, both are dead — and a required prop that four call sites keep passing
while it does nothing is what goes stale.

The pair becomes **jointly optional in the type**:

```ts
type LinkProps = { to: string; linkLabel: string } | { to?: never; linkLabel?: never };
```

The seven linking call sites are untouched. The four presentational ones omit
both. "Half a link" does not compile.

This is the same move the component already makes elsewhere: `ownRating` is a
bare number precisely so a caller *cannot* put a friend's rating in the
top-right. Neither `to: string | null` (which leaves a vestigial `linkLabel`
required and ignored) nor a `presentational?: boolean` (which lets a caller
construct the contradiction) has that property.

### 1.5 Call sites

Pass no `to` / `linkLabel`: `ShowList`, `UpcomingShowsList`, `ActiveRow`,
`WatchedRow`.

Unchanged: `EpisodeRow`, `UpcomingSeasonsList`, and all five card surfaces
(`ShowCard`, `MyShowCard`, and the grids that use them) — a card is one link
over poster and caption together and has never had this defect.

---

## 2. Item 2 — the empty state

### 2.1 What is wrong

`LibraryActiveList` renders one message for two different states:

> No shows match the current filters.

shown both when filters excluded everything **and** when the library is simply
empty — including on a friend's page with every picker reading "All", where the
sentence is straightforwardly false.

It is the sole holdout. `LibraryWatchedList`, `UpcomingList`,
`UpcomingSeasonsList`, `UpcomingShowsList` and `WatchNextList` all split the two
states already, and `LibraryActiveList` even computes `filtersActive` for its
Clear button.

Separately, **no list is viewer-aware**. On a friend's Watched tab the message
reads "No watch history yet." — which does not say whose.

### 2.2 Scope

Both library lists — `LibraryActiveList` and `LibraryWatchedList`. They are the
two tabs of one page, rendered by the same two call sites (`MyShowsPage`,
`FriendProfilePage`) in both self and friend mode; fixing one and leaving the
other ambiguous one tab over is the exact inconsistency this milestone is named
for.

The four self-only lists (Upcoming ×3, Watch Next) have no friend mode and are
**not touched**.

### 2.3 The copy

Attribution by name, following NEU-1181/1182 — `OwnerFacts` already renders
"Jeanne's rating", not "their rating", and `viewerContext` carries the name for
exactly this reason.

| | Active | Watched |
|---|---|---|
| self, empty | `You're not tracking any shows yet.` | `No watch history yet.` *(unchanged)* |
| friend, empty | `{name} isn't tracking any shows.` | `{name} has no watch history yet.` |
| self, filtered | `No shows match the current filters.` *(unchanged)* | `No matches in your watch history.` *(unchanged)* |
| friend, filtered | `No shows match the current filters.` *(unchanged)* | `No matches in {name}'s watch history.` |

Active's filtered message needs no attribution in either mode: the filters are
the viewer's own and the sentence claims nothing about whose library it is.
Watched's does, because "your watch history" is a false statement on a friend's
page.

"Empty" means the *unfiltered* data is empty — `data.length === 0`, the test
`LibraryWatchedList` already uses — not `filtersActive === false`. A list can be
empty with filters active, and the honest message there is the one about the
library.

---

## 3. Item 3 — raw ISO language codes

### 3.1 What is wrong

`ShowList.tsx:95` joins `network · status · language` into the metadata line and
prints `show.language` verbatim. Since NEU-1047 that field carries
`original_language`, an ISO 639-1 code, so search rows read `NBC · Ended · en`.

One display site only. There is no language filter picker anywhere in the SPA,
so `usePersistedString`'s lack of validation is not in play here and
`ShowFilters.language` — which the API client supports and nothing sets — is out
of scope.

### 3.2 The fix

A new `src/lib/language.ts` maps the code to a display name via
`Intl.DisplayNames`, with the locale **pinned to `"en"`** rather than the
browser's. The rest of the app is English; "Coreano" beside an English UI is
worse than `ko`, and a pinned locale keeps tests deterministic.

**Where a code does not map, the segment is omitted rather than printed.** TMDB
emits non-standard values — `cn` for Cantonese is the known one — and
`Intl.DisplayNames` hands an unrecognised code straight back. Printing that is
precisely what AC 3 forbids, so "unmapped ⇒ absent" is what makes the criterion
literally true rather than true for the codes that happened to be tested.

Dropping the field entirely was rejected: NEU-1188 put language on this row last
week as ownerless catalog metadata a ~97px card physically cannot hold, and
nothing has changed about that.

---

## 4. Item 4 — already fixed, no work

The ticket reports `DismissRecommendationButton.tsx:67` as `absolute top-0
right-0`, the same corner `ShowCard` puts the viewer's rating in — safe only
because recommendations never carry `my_rating`.

**NEU-1183 shipped and closed this.** `ShowPoster` now assigns every corner
under one rule (facts on top, controls on the bottom); the dismiss chip states
no corner at all and arrives as `ShowPoster`'s `control` in the bottom-right,
while the viewer's rating is top-right by construction. `ShowPoster.test.tsx`
pins both placements, and the chip's own docstring records that it used to carry
the position and no longer does.

AC 4 is met. No code change, and **the spec asserts it rather than assuming it**:
the verification is the two placement tests already in the suite.

---

## 5. Item 5 — premise wrong, split out

The ticket says "Display name **falls back to** an email address" and defers the
fix to NEU-1154. Both halves are wrong.

**There is no fallback.** `SignupRequest.display_name` is `min_length=1` and
required (`app/schemas.py:47`), `account_service.signup` passes it straight
through, and no migration ever backfilled the column from `email`. The observed
`<h1>jeanne_briggs@yahoo.com</h1>` is a real user who typed their email address
as their display name.

**NEU-1154 does not cover it.** It adds a unique `handle` *beside*
`display_name` and keeps `display_name` as free text, so after handles ship that
same user still publishes their address.

A second, previously unrecorded defect sits underneath it: **`scripts/refresh_db.sh`
anonymises `email` but not `display_name`**, so every local `task db:refresh`
imports that user's real address — the PII the anonymiser exists to strip,
walking past it in the one column nobody checked.

Both are backend work and this ticket is `repo:tvbf-frontend`. AC 5 is satisfied
by the "or split out" branch:

- **[NEU-1194](https://linear.app/neuroticsasquatch/issue/NEU-1194/backend-stop-a-display-name-from-being-an-email-address)** — reject email-shaped display names at `POST /signup` and `PATCH /me`. Milestone 2, Identity.
- **[NEU-1195](https://linear.app/neuroticsasquatch/issue/NEU-1195/anonymise-display-name-in-refresh-dbsh)** — anonymise `display_name` in `refresh_db.sh`. In the project, **no milestone**.

NEU-1195 carries no milestone deliberately. It leaks PII into local databases
*today*, independent of when registration opens, so it is not launch-gated and
does not belong behind the launch switch — it can be picked up whenever. It was
briefly filed under Milestone 3 on the grounds that the project's other PII work
(NEU-1158) lives there; that grouping was thematic rather than a real
dependency, and it is out.

---

## 6. What changed since the ticket was written

| Ticket item | Ticket says | Reality on 2026-08-19 |
|---|---|---|
| 1 — duplicate links | two files | six `size="row"` surfaces; four duplicates, two exempt |
| 2 — empty state | one list | pattern exists in five lists; friend-awareness missing from all |
| 3 — language | as stated | unchanged, one display site |
| 4 — dismiss chip corner | open | **closed by NEU-1183** |
| 5 — display name | fallback, covered by NEU-1154 | not a fallback, not covered; split to NEU-1194 / NEU-1195 |

---

## 7. Acceptance criteria

1. **One tabbable link per library list row.** `ShowList`, `UpcomingShowsList`,
   `ActiveRow` and `WatchedRow` each expose exactly one link per row, and the
   poster on those rows is neither focusable nor announced as a link — while
   `InMyShowsBadge` and `RatingBadge` remain in the accessibility tree with
   their labels intact.
2. `EpisodeRow` and `UpcomingSeasonsList` still expose two links per row, each
   named for its own destination, and `EpisodeRow`'s docstring says why.
3. Passing `to` without `linkLabel` (or the reverse) to `ShowPoster` is a type
   error.
4. **A friend's empty library says the friend has no shows**, not that filters
   excluded them — on both the Active and the Watched tab, using the friend's
   name, with every picker reading "All".
5. A filtered-to-nothing list still says so, distinctly, on both tabs and in
   both modes.
6. **No raw ISO language code reaches a user-visible string.** `en` renders as
   `English`; an unmappable code such as `cn` renders as nothing at all, with
   the surrounding `·` separators intact.
7. **The dismiss chip and the rating badge cannot occupy the same corner** —
   verified against `ShowPoster.test.tsx`'s existing placement tests, no code
   change.
8. Item 5 is split out as NEU-1194 and NEU-1195, both linked from NEU-1190.

---

## 8. Out of scope

- Collapsing the two-destination rows (`EpisodeRow`, `UpcomingSeasonsList`) to
  one link — §1.2.
- Moving fact badges out of the poster's link — §1.3.
- Empty-state copy on the four self-only lists — §2.2.
- Dropping the language field, or hiding English — §3.2.
- The language *filter* (`ShowFilters.language`), which no UI sets — §3.1.
- Everything in §5: display-name validation and the anonymiser, both backend.
- Any change to card surfaces. Cards are one link over poster and caption and
  have none of these defects.

---

## 9. Testing

- `ShowPoster.test.tsx` — a presentational poster renders no link; its badges
  keep their `role="img"` and labels; the linking form is unchanged. The
  existing placement and badges-inside-link tests must still pass.
- One test per collapsed row surface asserting a single link to the show, and
  one per exempt surface asserting two links with distinct accessible names —
  the latter is the tripwire against a later "tidy-up" collapsing them.
- `LibraryActiveList.test.tsx` / `LibraryWatchedList.test.tsx` — all four
  message states each, self and friend, with the friend's name asserted.
- `ShowList.test.tsx` — `en` renders `English`; `cn` renders no language
  segment; a null language is unchanged.
- Full CI locally before pushing: `task lint`, `task typecheck`, `task test`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
