# NEU-1182 — The card/badge system

**Lead ticket:** [NEU-1182](https://linear.app/neuroticsasquatch/issue/NEU-1182/give-a-personal-rating-and-the-tmdb-average-distinct-treatments) — Give a personal rating and the TMDB average distinct treatments
**Also covers:** [NEU-1181](https://linear.app/neuroticsasquatch/issue/NEU-1181/attribute-every-rating-and-library-mark-to-its-owner) — Attribute every rating and library mark to its owner
**Also covers:** [NEU-1183](https://linear.app/neuroticsasquatch/issue/NEU-1183/one-placement-rule-for-the-library-mark-and-the-rating-badge) — One placement rule for the library mark and the rating badge
**Repo:** `tvbf-frontend`
**Project:** TVBF: Open Registration — milestone **0. UI consistency**
**Evidence:** [Card Surface Audit](https://claude.ai/code/artifact/81577668-6672-4b9f-9fa3-7c9b9114c36e) — findings 01, 02, 03, 04, 11, and the "Where the marks sit" diagrams
**Precedent:** NEU-1057 (one mark, one picture), NEU-1176 (`docs/specs/NEU-1176-refresh-the-recommendations-grid.md`, the "takes the answer, not the sources" seam), NEU-1179 (`docs/specs/NEU-1179-a-remove-control-on-a-recommendation-card.md`, the dismiss chip this spec relocates)
**Status:** approved for implementation

This spec lives in the umbrella `docs/` rather than `tvbf-backend/docs/specs/`:
it defines no cross-repo contract and is cited by no other repo and no later
ticket (CLAUDE.md's cross-repo-citation rule).

**One spec, three tickets.** The three are one design. NEU-1183's own
sequencing note says settling placement before the badges would mean moving
them twice, and NEU-1182's component surgery is what makes NEU-1181's bug
unrepresentable rather than merely fixed. Splitting the decisions across three
documents would mean each one asserting the others' conclusions. Each ticket
gets its own section (§5, §6, §7) and its own PR (§8).

---

## 1. What this is

Three defects that share one root: **no card or badge component knows what kind
of fact it is holding, or whose.**

* A rated show renders two star badges that are pixel-identical and mean
  entirely different things — the viewer's rating and TMDB's average
  (`ShowCard.tsx:124` and `:136`). The only thing separating them is a `title`
  tooltip, which does not exist on touch.
* On a friend's library, the friend's rating is rendered with the label
  `"Your rating"` (`LibraryActiveList.tsx:356`, `MyShowCard.tsx:45`), because
  the friend endpoint hydrates `my_rating` for the *friend's* user id
  (`routers/users.py:82`) and no component downstream knows that.
* Both poster marks change corner between Discover and My Shows, and they trade
  places diagonally, so nothing on a card is a stable landmark.

The fix is a vocabulary: three rating kinds, two densities, one placement rule,
and an owner that arrives as a resolved answer rather than being inferred.

---

## 2. Nine findings from the code that reshaped the tickets

Each was established against the shipped code before any decision below, and
several move the tickets' own text.

**2.1 There are three rating kinds in the app, not two.** NEU-1182 frames this
as viewer's-rating vs TMDB-average. A third already exists and already has its
own picture:

| Kind | Picture today | Call sites |
| -- | -- | -- |
| The viewer's own | `RatingBadge` ★ chip, `title="Your rating"` | `ShowCard.tsx:124`, `MyShowCard.tsx:45`, `LibraryActiveList.tsx:356` |
| Another person's | `StarRatingDisplay` five-star, name adjacent | `FriendRatingsList.tsx:21`, `FeedItemRow.tsx:130,137` |
| An aggregate | `RatingBadge` ★ chip, `title="TMDB average"` | `ShowCard.tsx:136`, `ShowDetailPage.tsx:112`, `EpisodePage.tsx:156` |

So the app *already* draws another person's rating distinctly and attributes it
by an adjacent name. NEU-1181's bug is not that the treatment is missing — it
is that two card surfaces reuse kind 1's chip for kind 2's data.

**2.2 `StarRatingDisplay` is not just the detail page.** NEU-1182 AC 3 calls it
"the show detail page's five-star display". It is also both friend surfaces
(2.1). It already carries a real accessible name — `role="img"` +
`aria-label={`${formatStars(value)} out of 5`}` (`StarRatingDisplay.tsx:14-16`)
— which states the value but neither the kind nor the owner. It is the
mechanism §4.3 adopts for the chip.

**2.3 The friends' *average* is miscoloured, and the audit did not find it.**
`FriendRatingsList.tsx:46` renders `data.avg` — the average of the viewer's
friends' ratings — through `StarRatingDisplay`, in amber, under the heading
`Friends:`. That is an aggregate rendered in the colour this spec assigns to a
specific person, on the same page as `ShowDetailPage.tsx:112`'s TMDB average.
§4.4 corrects it.

**2.4 The friend's display name is not in scope where the badge renders.**
`FriendProfilePage.tsx:37` holds `friend.user.display_name`, but
`LibraryActiveList` and `LibraryWatchedList` receive only `viewerContext` and
`callerLibrary`. Attributing by name requires threading it — §6.1.

**2.5 That name can be an email address.** `display_name` falls back to the
account's email; NEU-1190 §5 reproduces `<h1>jeanne_briggs@yahoo.com</h1>` on a
profile page and defers the fix to NEU-1154's handles in milestone 2. Every
decision below that renders an owner name renders an email for such an account.
This is accepted knowingly (§6.3) and is one of the two things the production
sweep (§11) exists to look at.

**2.6 The poster markup is duplicated three times, with two different
fallbacks.** `ShowCard.tsx:10-11` and `MyShowCard.tsx:8-9` each declare their
own identical `FALLBACK_POSTER` data-URI constant; `ActiveRow`
(`LibraryActiveList.tsx:272-284`) and `WatchedRow`
(`LibraryWatchedList.tsx:309-321`) render a `bg-muted` div instead. Same
picture, three implementations, two behaviours. §7.1 collapses them.

**2.7 The dismiss chip cannot become a poster slot without restructuring the
link.** In `ShowCard` the `<Link>` wraps the image *and* both badges (lines
109-152) while `DismissRecommendationButton` sits outside it (line 153),
positioned against the outer `relative` div. That is deliberate — the docstring
forbids a `<button>` inside an `<a>`, and NEU-1179 §3.2 argues it. So
`ShowPoster` must own the link itself (§7.1), or a control slot would violate
the rule the current structure exists to keep.

**2.8 `LibraryWatchedList.tsx:277` hard-codes `my_rating: null`** in
`watchedToMyShowEntry`. That is NEU-1188's defect and is **not fixed here** —
but it means the Watched grid starts rendering a rating the moment NEU-1188
lands, and in friend mode that rating is the friend's. The owner seam this spec
builds must already be in place at that call site, or NEU-1188 reintroduces
NEU-1181's bug on a surface this spec never touched. §6.2.

**2.9 There is no visual-regression infrastructure.** `package.json` carries
vitest + jsdom + testing-library across 59 test files, and no Playwright, no
Storybook, no screenshot tooling. NEU-1183 AC 5's seven-surface check at 375px
therefore cannot be automated with what is here; §11 is the answer, and adding
that infrastructure is explicitly not this work (§12).

---

## 3. The system

Everything in §5-§7 is an application of this section. It is the part worth
reading if you are picking the work up cold.

### 3.1 Three kinds

A rating rendered anywhere in the app is exactly one of:

* **`own`** — the viewer's own rating.
* **`other`** — one named person's rating.
* **`aggregate`** — a crowd's score, whoever the crowd is (TMDB's `vote_average`,
  or the friends' average).

The kind is not a presentational choice. It is what the number *is*, and every
component that draws one states it.

### 3.2 Two forms, one vocabulary

| | Compact chip (`RatingBadge`) | Five-star (`StarRatingDisplay`) |
| -- | -- | -- |
| Where | cards, list rows — anywhere width binds | detail pages, the friend feed, the friend ratings list |
| `own` | filled amber `Star` + value | (the input, `StarRatingInput`) |
| `other` | filled amber `Star` + value, with a name | filled amber stars, with a name |
| `aggregate` | unfilled muted `Star` + value | unfilled muted stars |

**The rule, in one sentence:** *amber means a person rated this; muted means a
crowd did; the chip and the five-star are the same claim at two densities.*

Two consequences worth stating because they look like details:

* **`RatingBadge` moves off its text `★` glyph onto lucide `Star`**, which is
  what `StarRatingDisplay` already draws. One star glyph in the app. Without
  this the two forms are related by argument rather than by construction —
  which is exactly what NEU-1182 AC 3 is asking to end.
* **No text label on the chip.** The distinction is carried by fill and colour
  and nothing else. This is a width decision and it is measured: `ShowCard`'s
  own docstring records that at a 375px viewport a card is **~109px wide, ~97px
  inside `px-1.5`**, and the aggregate chip shares the title line with a
  truncating `h3` (`ShowCard.tsx:131-142`). At `text-[10px] px-1`, `★4.1` is
  ~32px and `TMDB 4.1` is ~52px — the difference is ~6 characters of show name,
  on the densest surface in the app. Fill and colour are two independent
  channels, so the distinction survives greyscale and colour-blindness without
  spending that width.

Palette constraints, both pre-existing: **emerald is watched** — the three watch
checkboxes and the `Finished` / `Caught Up` pills — and `InMyShowsBadge`'s
docstring records that emerald was deliberately rejected for *tracked* because
of that collision. **Amber is a person's rating**, established by
`StarRatingDisplay`. Neutral `bg-muted` is currently doing double duty for both
kinds, which is the thing being fixed.

### 3.3 Ownership

**Whose fact this is arrives as a resolved answer, never as sources.** This is
NEU-1176's seam applied one component over: `MyShowsButton` takes `inMyShows`
rather than a `viewerContext` plus a `callerLibrary`, and deriving it stays with
the caller. Cards take an owner the same way, required, with no default — a
default of "you" is precisely what makes the next surface silently wrong.

**Friend mode cannot exist without a name.** `ViewerContext` widens from a
string union to a discriminated one carrying the friend's name (§6.1), so the
state that produced this bug becomes unconstructable rather than merely
corrected.

### 3.4 Placement

**Facts on top, controls on the bottom.**

```
┌──────────────────────────┐
│ [library mark]  [own ★] │   top     — facts
│                          │
│         poster           │
│                          │
│ (reserved)     [dismiss] │   bottom  — controls
└──────────────────────────┘
```

* **top-left** — the library mark. Always, on every poster.
* **top-right** — the viewer's own rating. Always, on every poster that shows one.
* **bottom-right** — a control. The dismiss chip today.
* **bottom-left** — reserved for a second control.
* **inline beside the title** — the aggregate.
* **never in a corner** — another person's rating (§3.5).

Corners are **not passed in per call site**. The component that draws the
poster assigns them (§7.1), so a new surface gets correct placement by using it.

### 3.5 Another person's facts are grouped and named once

`other` never occupies a poster corner. A friend's facts are grouped together
and the group carries their name **once** — visibly for sighted readers, and
per-fact in the accessible names so nothing is announced twice (§6.3).

The group holds facts about **a person's relationship to the show** — their
rating, their progress, when they last watched, their status pill. Facts about
the *show* — the upcoming-episode count, the premiere year — are ownerless and
stay outside it.

---

## 4. NEU-1182 — the vocabulary

### 4.1 `RatingBadge` becomes a discriminated union

```tsx
type RatingBadgeProps =
  | { kind: "own"; value: number | null | undefined; className?: string }
  | { kind: "aggregate"; value: number | null | undefined; className?: string }
  | { kind: "other"; value: number | null | undefined; ownerName: string; className?: string };
```

The free-text `title` prop is **deleted**. It is what let two meanings share one
component, and while it survives there is a seam for a fourth meaning to enter
through. The tooltip and the accessible name are both derived from `kind`.

`ownerName` is required on `other` and on no other kind, so §3.5's guarantee is
enforced by the type checker rather than by review. This satisfies NEU-1182
AC 4: the badge cannot be constructed without stating which kind it holds.

The existing null/zero guard is unchanged — `value == null || value === 0`
renders nothing.

### 4.2 Presentation per kind

* **`own`** — lucide `Star`, `fill-current`, `text-amber-500`.
* **`other`** — identical to `own`. The name beside it is what distinguishes
  them, and §3.5 guarantees the name is there.
* **`aggregate`** — lucide `Star`, no fill, `text-muted-foreground`.

The chip itself (`rounded-sm bg-muted px-1.5 py-0.5 text-xs`) is unchanged, as
are the per-call-site size overrides.

### 4.3 Accessible names

Today the star is `aria-hidden` and the value is bare text, so the badge's
accessible name is `"3.5"` — the `title` attribute is only a fallback and loses
to text content. That is the audit's reproduced card name, *"In My Shows 3.5
Silo 4.1 2023"*: two bare numbers, neither attributed.

Adopt `StarRatingDisplay`'s mechanism — `role="img"` plus an `aria-label` that
replaces the contents:

| Kind | Accessible name |
| -- | -- |
| `own` | `Your rating: 4.5 out of 5` |
| `aggregate` | `TMDB average: 4.1 out of 5` |
| `other` | `Jeanne's rating: 4.0 out of 5` |

`title` is still emitted, derived from the same string, so sighted hover keeps
working.

**One consequence, accepted deliberately.** In `ShowCard` both badges live
*inside* the `<Link>`, so a labelled badge lengthens the link's own accessible
name: a tracked, rated, aggregated card goes from `"In My Shows 3.5 Silo 4.1
2023"` to `"In My Shows, Your rating: 4.5 out of 5, Silo, TMDB average: 4.1 out
of 5, 2023"`. Longer, but every token now means something. The alternative —
hiding the badges from the accessibility tree — withholds from screen-reader
users exactly the facts the sighted card shows, which is a worse answer to
NEU-1182 AC 2 than verbosity.

### 4.4 `StarRatingDisplay` takes the same kind

The five-star form gains the same `kind` discriminator, so §3.2's rule holds in
both forms rather than in one. Its accessible name gains the same prefix.

The visible consequence is **2.3**: `FriendRatingsList.tsx:46`'s friends-average
goes muted, matching the TMDB average one section up on the same page. Its
per-friend rows (line 21) stay amber, because those are `other` — so the section
reads as a muted summary over amber individuals, which also separates the
summary from the list visually.

`StarRatingInput` is untouched. It is an input, its amber is the interactive
affordance, and the viewer editing their own rating is unambiguous by
construction.

### 4.5 Call-site conversion, and the bug that survives one PR

Every one of the five `RatingBadge` sites gets an explicit kind:

| Site | Kind |
| -- | -- |
| `ShowCard.tsx:124` | `own` |
| `ShowCard.tsx:136` | `aggregate` |
| `ShowDetailPage.tsx:112` | `aggregate` |
| `EpisodePage.tsx:156` | `aggregate` |
| `MyShowCard.tsx:45` | `own` — **wrong in friend mode; fixed in §6** |
| `LibraryActiveList.tsx:356` | `own` — **wrong in friend mode; fixed in §6** |

The last two cannot take `other` in this PR: the correct kind needs the widened
`ViewerContext` and the threaded name, which is NEU-1181's work. They pass `own`
and the existing production mislabel survives one PR. Nothing regresses — it is
the bug that ships today — and the PR body says so explicitly. §8 records the
ordering that makes this the shortest path.

---

## 5. NEU-1183 — placement

Presented before NEU-1181 because §7 depends on §5's component existing;
**ship order is §4 → §6 → §5** (see §8).

### 5.1 `ShowPoster`

A new component at `src/components/ShowPoster.tsx` owning the image, the
fallback, the aspect ratio and **corner assignment**.

```tsx
export function ShowPoster({
  to,            // string — the show route
  src,           // string | null
  linkLabel,     // string — accessible name for the internal link
  size,          // "card" (w-full) | "row" (w-16)
  inMyShows,     // boolean  → top-left mark
  ownRating,     // number | null → top-right, always kind="own"
  control,       // ReactNode → bottom-right
}: ShowPosterProps)
```

Five things about this shape are load-bearing.

**It owns its own `<Link>`.** Per **2.7**, a control slot inside the existing
structure would nest a `<button>` in an `<a>`. `ShowPoster` renders
`<Link>{image}</Link>` inside its own `relative` wrapper, with every overlay
slot a **sibling** of that internal link. The rule NEU-1179 §3.2 established
becomes structural at the poster rather than remembered per card.

**Facts are values, controls are nodes.** `inMyShows` is a boolean and
`ownRating` is a number, so the poster constructs `InMyShowsBadge` and
`<RatingBadge kind="own">` itself. A caller cannot put an arbitrary node in a
fact corner, and — the point — cannot put a *friend's* rating in the top-right,
because the prop is named `ownRating` and takes a bare number. `control` stays a
`ReactNode` because controls genuinely vary; facts do not.

**`size` is a variant, not a `className`.** The two real widths are the card's
`w-full` and the list row's `w-16`; anything else is a new surface making a
decision, and it should be made here.

**It absorbs the duplication of 2.6** — one `FALLBACK_POSTER`, one aspect ratio,
one behaviour for a missing image. The `bg-muted` div the two list rows use today
is replaced by the data-URI fallback the cards use, so all four surfaces render
the same absence.

**`linkLabel` is the seam NEU-1190 §1 will use.** That ticket wants one tabbable
link per list row, which becomes a prop on this component rather than surgery in
two row components. It is **not** added here (§12).

### 5.2 The four call sites

| Component | Before | After |
| -- | -- | -- |
| `ShowCard` | mark `top-1 left-1`, rating `absolute top-1 right-1`, dismiss `top-0 right-0` outside the Link | `<ShowPoster size="card" …>`; dismiss passed as `control` |
| `MyShowCard` | mark `top-1 right-1`, rating `absolute bottom-1 left-1` | `<ShowPoster size="card" …>` — mark moves to top-left, rating to top-right |
| `ActiveRow` | `bg-muted` fallback, `CallerPosterBadge` at `top-1 right-1` | `<ShowPoster size="row" …>` — mark moves to top-left |
| `WatchedRow` | as `ActiveRow` | as `ActiveRow` |

`InMyShowsBadge` loses its positioning `className` from every caller and keeps
its docstring's "one claim, one picture" argument. The sentence in that docstring
that says *"Positioning is the caller's: the cards put their rating badge in
different corners, so the mark goes wherever that card has room"* is the thing
this ticket ends, and it is rewritten (§10).

`CallerPosterBadge` (`LibraryRowIndicators.tsx:11-23`) keeps its gating logic —
friend mode, and the caller actually has the show — and stops rendering the badge
itself, resolving instead to the boolean `ShowPoster` takes.

### 5.3 The dismiss chip moves to bottom-right

`DismissRecommendationButton.tsx:67` is `absolute top-0 right-0` — the corner
§3.4 gives the viewer's rating. `ShowCard`'s docstring records this as safe by
*coincidence*: recommendations never carry `my_rating`, and a show the viewer
tracks or has rated is suppressed before it can be recommended at all. NEU-1183
AC 4 asks that this be reconciled rather than left as a documented coincidence.

It moves to **bottom-right**, under §3.4's rule. The alternative — keeping the
conventional top-right close position and making `ownRating` and `control`
mutually exclusive in the type — was rejected because it encodes the constraint
as a prohibition, and the prohibited thing is reasonable: a recommendations grid
that eventually shows the viewer's rating is not far-fetched. The cost is the
top-right close convention; the chip keeps its `X` glyph, its `aria-label`, its
`bg-background/80` treatment and its `data-dismiss-recommendation` attribute, so
it still reads as dismiss and NEU-1179's focus-management hook is unaffected.

`MyShowCard`'s rating vacates `bottom-1 left-1` under §5.2 anyway, so the
bottom-left reservation costs nothing today.

---

## 6. NEU-1181 — ownership

### 6.1 `ViewerContext` widens

```tsx
// src/components/library/viewerContext.ts  (new module)
export type ViewerContext =
  | { kind: "self" }
  | { kind: "friend"; name: string };

export const SELF: ViewerContext = { kind: "self" };
```

Two changes in one:

* **It carries the friend's name**, so friend-mode-without-a-name becomes
  unconstructable — §3.3. `FriendProfilePage` already holds the name at line 37
  and passes it at its two call sites (lines 111, 140).
* **It moves out of `LibraryActiveList.tsx`.** It is currently exported from
  there and imported by `LibraryRowIndicators` and `LibraryWatchedList`, which
  makes a leaf type depend on the largest component in the folder.

The mechanical edits are dull and confined: roughly ten `viewerContext ===
"friend"` comparisons across `LibraryActiveList`, `LibraryWatchedList` and
`LibraryRowIndicators` become `viewerContext.kind === "friend"`, and the two
`viewerContext = "self"` defaults become `= SELF`.

### 6.2 Cards take a resolved owner

```tsx
/** Whose rating a card is holding. Resolved by the caller — the card never
 *  derives it (NEU-1176's "takes the answer, not the sources"). */
export type RatingOwner = { kind: "you" } | { kind: "other"; name: string };
```

`MyShowCard` takes `ratingOwner: RatingOwner`, **required, with no default**.
Both call sites derive it in one expression:

```tsx
ratingOwner={
  viewerContext.kind === "friend"
    ? { kind: "other", name: viewerContext.name }
    : { kind: "you" }
}
```

No ternary is needed at the render site, because the two kinds land in different
places: `own` goes to `ShowPoster`'s `ownRating` slot, `other` goes to the fact
group. The card passes `ownRating={ratingOwner.kind === "you" ? entry.my_rating
: null}` and renders the group otherwise.

This is what **2.8** requires: `LibraryWatchedList`'s grid call site gets the
same required prop now, so when NEU-1188 removes the hard-coded `my_rating:
null` the rating lands already attributed, on a surface this spec otherwise does
not touch.

### 6.3 `OwnerFacts` — the friend's facts, named once

A new component at `src/components/OwnerFacts.tsx`, used by `ActiveRow`,
`WatchedRow` and `MyShowCard`. It renders the fact block of a library row or
card: the status pill, the progress fraction, the rating and the last-watched
date — the facts about **a person's relationship to the show** (§3.5).

```tsx
<OwnerFacts
  ownerName={string | null}          // null = the viewer; no name, no prefixes
  layout="inline" | "stacked"
  status={LibraryStatus}
  progress={{ watched: number; aired: number } | null}
  rating={number | null}
  lastWatchedAt={string | null}
/>
```

Five properties.

**`ownerName={null}` is self mode and renders today's markup**, so there is one
component for both modes rather than a friend-shaped copy of a self-shaped
block. The self/friend divergence that produced this bug has nowhere left to
live.

**`layout` is density, not surface.** `inline` on a list row —
`Jeanne: 38/46 · ★4.0 · Last watched Jun 3`. `stacked` on a grid card — the name
on its own line, the facts beneath. This is measured: at 10px in the ~97px of a
`grid-cols-3` card, the inline form runs ~95-100px and wraps unpredictably at
exactly the width that matters, while stacked is ~30px over ~60px and fits.

**The visible name appears once and is `aria-hidden`; the attribution in the
accessibility tree is per-fact.** Sighted readers see `Jeanne:` once; assistive
technology hears *"Jeanne's progress: 38 of 46"*, *"Jeanne's rating: 4.0 out of
5"*, *"Jeanne last watched Jun 3"*. Nothing is announced twice, and no fact is
attributed only by proximity to a name several nodes away — the failure
`ShowCard.tsx:117-120` already records for the library mark ("an sr-only label
beside the title would name it *and* describe it with the same words").

**The name truncates.** Per **2.5** it may be an email address, on every row of
a library that runs to hundreds.

**Show-level facts stay outside it.** The upcoming-episode count and the
premiere year are ownerless.

`CallerProgressNote` (`LibraryRowIndicators.tsx:31-48`) — the viewer's `You:
x/y` on a friend's row — is unchanged and stays where it is, in the action row.
It remains the marked exception: on a friend's page the friend's facts are
grouped and named, and the one fact about the viewer is labelled `You:`.

### 6.4 A recorded departure from NEU-1181's proposed layout

The ticket's Approach section says another person's rating *"belongs in the
row's comparison area beside `You: x/y`, attributed by name."* **This spec does
not do that**, and the departure is deliberate.

Putting a rating beside a progress fraction and calling it a comparison
compares unlike quantities. The genuine comparison on a friend's row is
`Jeanne: 38/46` against `You: 12/46` — which §6.3 creates and the ticket's
layout leaves split across two lines. Grouping by owner also makes attribution
structural rather than per-fact discipline, and it halves the email exposure of
**2.5**: the ticket's layout names the friend twice per row (once on the
progress, once on the rating), this names them once.

The ticket's AC 3 — *"The friend's unlabelled `Progress: x/y` is attributed too,
so it cannot be misread as the viewer's"* — is satisfied more completely by the
grouping than by the layout the ticket sketched.

### 6.5 The library mark's label

`InMyShowsBadge`'s label becomes unconditionally **"In your My Shows"** — both
`title` and `aria-label`.

The claim never varies by surface: `CallerPosterBadge` gates on the *caller*
having the show, `ShowCard` takes the *viewer's* `inMyShows`, and `MyShowCard`
in self mode is tautologically the viewer's. There is no surface where the mark
means anyone else's library. What varies is only legibility — the feature is
named "**My** Shows", and on someone else's page "my" reads as ambiguous.

Because the claim is unconditional the label can be too, which means
**`InMyShowsBadge` needs no new prop** and stays the single shared mark NEU-1057
established. This is a one-line change satisfying NEU-1181 AC 4 everywhere at
once.

It keeps the feature name rather than reading "In your library", so the mark
stays visibly tied to the control that creates it — `MyShowsToggle`,
`MyShowsButton`'s "+ My Shows" — which is the argument `InMyShowsBadge`'s own
docstring makes for the library icon in the first place.

Note the interaction with NEU-1187, which will suppress the mark on My Shows ·
Active entirely because it is always true there. After that lands, the only
surfaces rendering it are browse grids and friend libraries — in both of which
"In your My Shows" is exactly the right sentence.

---

## 7. Acceptance criteria

Numbering follows each ticket's own. Departures are marked.

### NEU-1182

1. On a card showing both, the viewer's rating and the TMDB average are
   distinguishable without hover — on touch, and in a screenshot. *(§3.2, §4.2:
   fill and colour, two independent channels.)*
2. Each badge's accessible name states which kind it is; no bare number reaches
   the accessibility tree. *(§4.3.)*
3. The show detail page's five-star display and the card chip read as the same
   design system. *(§4.4 — they share one glyph, one palette rule and one kind
   discriminator; the choice between them is density.)*
4. `RatingBadge` cannot be constructed without stating which kind of rating it
   holds. *(§4.1, enforced by the type checker.)*
5. A test asserts the two-badge case on one card renders two distinguishable
   accessible names. *(§9.)*
6. **Added** — `FriendRatingsList`'s friends-average renders as an aggregate,
   not as a person's rating. *(2.3, §4.4.)*

### NEU-1181

1. On a friend's library, no rating is labelled "Your rating" unless it is the
   viewer's. *(§6.2.)*
2. The friend's rating is visibly attributed to the friend, in both grid and
   list views. *(§6.3, both layouts.)*
3. The friend's unlabelled `Progress: x/y` is attributed too. *(§6.3, §6.4 —
   satisfied by grouping rather than by the ticket's proposed layout.)*
4. The library mark on a friend's page states that it refers to the viewer's own
   library. *(§6.5.)*
5. Nothing changes visually on My Shows or Discover, where owner is unambiguous.
   *(§6.3's `ownerName={null}` path renders today's markup. **Note:** this is
   true of NEU-1181's PR and **not** of NEU-1183's, which moves two corners on
   `MyShowCard` by design.)*
6. A test asserts the friend case: a rendered friend row whose `my_rating`
   differs from the caller's does not label it as the caller's. *(§9.)*

### NEU-1183

1. The library mark occupies the same corner on `ShowCard`, `MyShowCard` and
   library list posters. *(§3.4 top-left, §5.2.)*
2. The viewer's rating occupies the same corner on every card that shows one.
   *(§3.4 top-right.)*
3. Corners are not passed in per call site; a new surface gets correct placement
   without stating it. *(§5.1 — `ShowPoster` assigns them.)*
4. The dismiss chip's corner is reconciled with the rating badge's rather than
   merely coexisting. *(§5.3 — bottom-right under §3.4's facts/controls rule, so
   no mutual exclusion is needed.)*
5. Verified at 375px across Trending, Most Anticipated, Recommendations, Search,
   Similar, My Shows and a friend library. *(§11.)*

---

## 8. Delivery

**Three PRs, in this order:**

| # | Ticket | Contents |
| -- | -- | -- |
| 1 | **NEU-1182** | §4 — the discriminated union, the lucide star, the per-kind presentation and accessible names, `StarRatingDisplay`'s kind, all five call sites converted |
| 2 | **NEU-1181** | §6 — `ViewerContext` widened and moved, `RatingOwner`, `OwnerFacts`, the two friend-mode sites switched to `other`, the `InMyShowsBadge` label |
| 3 | **NEU-1183** | §5 — `ShowPoster`, the four call sites, the corner rule, the dismiss chip's move |

**Add `NEU-1182 blocks NEU-1181` in Linear.** The ordering is a real constraint
(§4.5) and Linear currently records no relation between the two. NEU-1183 is
already blocked by both.

**Why not the other order.** Landing NEU-1181 first would mean fixing the
attribution while `RatingBadge` still takes a free-text `title` — shipping a
`title={`${name}'s rating`}` interim that PR 2 then deletes, churn on the exact
prop NEU-1182 exists to remove. Landing 1181 and 1182 as one PR avoids the
one-PR-wrong-state entirely but produces a diff spanning the component API, the
accessibility mechanism, the context widening and the row layout, against this
repo's 1-ticket-1-PR convention.

**The cost of the chosen order, stated plainly:** PR 1 converts
`MyShowCard.tsx:45` and `LibraryActiveList.tsx:356` to `kind="own"`, which is
wrong in friend mode. Nothing regresses — that is the label production ships
today — and PR 1's body must say so and name NEU-1181 as the fix.

---

## 9. Tests

| Where | What |
| -- | -- |
| `src/components/RatingBadge.test.tsx` (rewritten) | Rewritten off its `title`-attribute assertion (lines 22-26) onto `getByRole("img", { name })`. One case per kind asserting the full accessible name; the null / undefined / zero guards unchanged; `other` renders the owner's name in its label |
| `src/components/StarRatingDisplay.test.tsx` | The same per-kind labels at the five-star density; an `aggregate` renders unfilled/muted |
| `src/components/ShowCard.test.tsx` | **NEU-1182 AC 5** — one card carrying `my_rating` *and* `rating_average` exposes two distinguishable accessible names; neither is a bare number |
| `src/components/FriendRatingsList.test.tsx` | **NEU-1182 AC 6** — the average renders as `aggregate`, the per-friend rows as `other` |
| `src/components/OwnerFacts.test.tsx` (new) | `ownerName={null}` renders no name and no prefixes; a name renders once visibly and `aria-hidden`; each fact's accessible name carries the owner; both layouts |
| `src/components/library/LibraryActiveList.test.tsx` | **NEU-1181 AC 6** — a friend row whose `my_rating` differs from the caller's is not labelled as the caller's, in **both** views (AC 2) |
| `src/components/ShowPoster.test.tsx` (new) | **NEU-1183 AC 1-3** — each slot lands in its designated corner; a control slot's `closest("a")` is null (2.7); a missing `src` renders the fallback. Asserted **once here**, not re-asserted per surface |
| `src/components/ShowCard.test.tsx`, `MyShowCard.test.tsx`, `LibraryActiveList.test.tsx`, `LibraryWatchedList.test.tsx` | Each renders through `ShowPoster`, so placement is inherited rather than restated — the tripwire that stops a fifth surface hand-rolling a poster |
| `src/components/DismissRecommendationButton.test.tsx` | Still passing unchanged: the chip's label, its pending state and its `data-dismiss-recommendation` attribute are untouched by the corner move (§5.3) |
| `src/components/discover/RecommendedForYou.test.tsx` | Still passing unchanged — NEU-1179's focus management keys on the attribute, not the position |

Gates, all containerised, from `tvbf-frontend/`: `task lint`, `task typecheck`,
`task test`.

---

## 10. Verification sweep

Structural tests cannot see layout — **2.9**. Two things in this design carry
real visual risk and neither is visible to jsdom: `OwnerFacts` wrapping at 97px
(§6.3), and the dismiss chip's new bottom-right corner against the card border
(§5.3).

**Per PR, locally.** Drive `https://app.tvbf.localhost` at **375×812** across
the seven surfaces NEU-1183 AC 5 names: Trending, Most Anticipated,
Recommendations, Search, Similar, My Shows, and a friend library. Attach the
screenshots to the PR.

The local database has the shape needed — 3 users, 2 accepted connections, 577
My Shows entries — but **not** the comparison case: no show is rated by more
than one user (`tomboone` has 52336 @4.5 and 74442 @4.0; `Dummy McTestface` has
23470 @5.0). One rating on an already-shared show creates it, and that seed is a
prerequisite of the sweep rather than an optional extra: without it the friend
row renders no rating and the surface this whole spec is about is not being
looked at.

**Once, against production, after PR 3 lands.** A spot-check of a friend library
with a real `display_name`. This is the half local cannot answer: **2.5**'s
email fallback is exactly what makes `OwnerFacts` widest, and no local account
exercises it. The audit's own reproduction — `jeanne_briggs@yahoo.com` on build
`6669017` — is the case to look at.

---

## 11. Documentation

**`InMyShowsBadge.tsx` docstring.** Its final paragraph — *"Positioning is the
caller's: the cards put their rating badge in different corners, so the mark
goes wherever that card has room. Every caller is inside a `relative` container
and passes the corner"* — is the drift this work ends. Replaced with §3.4's rule
and a pointer to `ShowPoster`. Its label paragraph gains §6.5's reasoning.

**`RatingBadge.tsx` docstring** (new). §3.1's three kinds, §3.2's amber/muted
rule and the measured argument against a text label, and why `title` was
deleted.

**`ShowPoster.tsx` docstring** (new). §3.4's corner rule; why it owns its own
`Link` (2.7); why facts are values and controls are nodes (§5.1); the
duplication it absorbed (2.6).

**`OwnerFacts.tsx` docstring** (new). §3.5's boundary — a person's relationship
to the show, not the show; the aria-hidden name with per-fact attribution; the
measured inline/stacked split.

**`ShowCard.tsx` docstring.** Its `dismissible` paragraph currently argues the
chip's top-right corner is safe because both corners are free on the
recommendations surface. That coincidence is what §5.3 ends — rewritten to state
the facts/controls rule instead. Its `inMyShows` paragraph loses the positioning
sentence.

**Umbrella `.claude/CLAUDE.md`, "Frontend conventions".** The
`ShowCard`-opt-in-props entry currently describes the containment seam as
covering both `addable` and `dismissible`, and states the dismiss chip's poster
overlay with its measured justification. That entry needs:

* the corner rule (§3.4) recorded as the app-wide placement decision, with
  `ShowPoster` named as its owner and the note that corners are never passed per
  call site;
* the dismiss chip's move to bottom-right, keeping NEU-1179's measured argument
  for *why it overlays* — which is unchanged — while replacing the "both corners
  are free" coincidence with the facts/controls rule;
* a new entry for the rating vocabulary (§3.1, §3.2) — three kinds, two
  densities, amber-is-a-person / muted-is-a-crowd;
* a note that `ViewerContext` carries the friend's name, so friend mode without
  a name is unconstructable, and that cards take a resolved `RatingOwner` on
  NEU-1176's "takes the answer, not the sources" precedent.

---

## 12. Out of scope

* **`ShowList` renders no badges at all** — search's list view carries no
  rating, no library mark and no action button. NEU-1188.
* **`LibraryWatchedList.tsx:277`'s hard-coded `my_rating: null`** — NEU-1188.
  The owner seam is left ready for it (2.8, §6.2).
* **Suppressing the always-true library mark and add control on My Shows ·
  Active** — NEU-1187. §6.5 notes the interaction.
* **One tabbable link per library list row** — NEU-1190 §1. §5.1 leaves
  `linkLabel` as the seam.
* **`display_name` falling back to an email address** — NEU-1154. Accepted
  knowingly here (2.5) and looked at in §10's production check.
* **Visual-regression infrastructure** — Playwright or Storybook would automate
  §10, and adding it would swamp this work (2.9).
* **Whether Watch Next and Upcoming gain a view toggle, and the episode-still vs
  show-poster split** — NEU-1189. `NextEpisodeCard` is deliberately untouched by
  `ShowPoster`, because its image is a 16:9 episode still and whether that is
  right is that ticket's question.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
