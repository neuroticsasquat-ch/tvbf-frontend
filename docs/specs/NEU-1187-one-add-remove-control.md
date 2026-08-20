# NEU-1187 — One add/remove control, suppressed where it cannot act

**Ticket:** [NEU-1187](https://linear.app/neuroticsasquatch/issue/NEU-1187/one-addremove-control-suppressed-where-it-cannot-act)
**Repo:** `tvbf-frontend`
**Project:** TVBF: Open Registration — milestone *0. UI consistency*
**Blocks:** [NEU-1188](https://linear.app/neuroticsasquatch/issue/NEU-1188) — grid and list views carry the same facts and the same controls
**Related:** [NEU-1186](https://linear.app/neuroticsasquatch/issue/NEU-1186), [NEU-1185](https://linear.app/neuroticsasquatch/issue/NEU-1185)
**Precedents this consumes:** `docs/specs/NEU-1182-the-card-badge-system.md` (the rating vocabulary), NEU-1183's placement rule as recorded in `src/components/ShowPoster.tsx`, `docs/specs/NEU-1179-a-remove-control-on-a-recommendation-card.md` (the overlay chip and the focus fix), `docs/specs/NEU-1176-refresh-the-recommendations-grid.md` (the containment seam)
**Evidence:** [Card Surface Audit](https://claude.ai/code/artifact/81577668-6672-4b9f-9fa3-7c9b9114c36e) — finding 08
**Status:** approved for implementation

This spec lives in the umbrella `docs/` because nothing in another repo cites
it: it is entirely a `tvbf-frontend` change consuming contracts that already
exist (CLAUDE.md's cross-repo-citation rule).

---

## 1. What this is

Adding and removing a show from My Shows is drawn several ways, and on My
Shows · Active it is drawn as a control that can only ever say one thing: every
row on that tab is in My Shows by definition, so the "✓ My Shows" button can
only remove, and the poster badge can only be true. Both are asserted on the
tallest rows in the app — the ticket measures them at ~290 px at a 375 px
viewport — and the button costs a full line of every one.

This ticket makes one component own the affordance across cards and rows, and
stops that component occupying a line where the answer cannot change.

## 2. Five findings that reshape the ticket

Each was established against the shipped code before any decision below, and
each one moves the ticket's own text.

**2.1 The "four treatments" are two components and one copy.** Rows 1 and 2 of
the ticket's table — the recommendations card's filled chip and the friend-mode
row's green outline chip — are the *same component in its two states*:
`MyShowsButton` renders `Plus` + "My Shows" when untracked and an emerald
outline `Check` + "My Shows" when tracked (`MyShowsButton.tsx:60-88`). Every
Watched row already uses it too, in **both** viewer modes
(`LibraryWatchedList.tsx:354`). The real inventory is `MyShowsButton` (recs
cards, friend Active rows, all Watched rows), `MyShowsToggle` (the show detail
page — a different component with a different glyph, label and size), and one
bespoke copy in `LibraryActiveList.tsx:335-372`.

So "converge the three non-exception treatments" is not three edits. It is:
delete the bespoke copy, and decide about the detail page (**D6**: leave it).

**2.2 The documented exception's reason is stale, so it can be deleted rather
than confirmed.** `MyShowsButton`'s docstring keeps `LibraryActiveList`'s
self-mode copy on the grounds that "what the click updates is the *row*, not
the button, and routing a row's lifecycle through this component's interface
would put the revert path — the one nobody exercises by hand — through two
components instead of one."

The revert path is in neither component. `useRemoveShow` (`src/api/me.ts:247-264`)
cancels `["my-shows"]`, snapshots it, filters the show out of every matching
query in `onMutate`, restores the snapshot in `onError`, and invalidates in
`onSettled`. `ActiveTab` feeds the list straight from `useMyShows()`
(`MyShowsPage.tsx:75`), whose key `["my-shows", sort, today, ratedOnly]` is a
prefix match — so the row already unmounts optimistically and already reverts,
from the mutation. `ActionButton`'s local `removed` state is a second copy of
work the mutation does.

**2.3 The always-true badge is a grid-only defect.** `callerPosterMark`
(`callerLibrary.ts:79-83`) already returns `false` for self mode, so the list
row's poster carries no mark today. Only the grid asserts it, at
`LibraryActiveList.tsx:221-223`, which passes a literal `true` for self mode.
AC 2's badge half is one line, not two.

**2.4 AC 4 is not achievable by removing the button alone.** The self-mode
action row is `RatingBadge kind="own"` + `CallerProgressNote` (friend-only) +
the button (`LibraryActiveList.tsx:309-315`). Strip the button and a **rated**
row keeps the badge, keeps the line, and keeps its height. `MyShowCard`
meanwhile puts the viewer's own rating on the poster's top-right via
`ShowPoster.ownRating` — so grid and list already disagree about where that
fact lives, and the list row is the last holdout from NEU-1183's placement
rule. Moving it is what makes AC 4 true for every row (**D8**).

**2.5 AC 5 is a guard, not work.** The bespoke copy already calls
`useRemoveShow`, and `onSettled → invalidateAll → invalidateRecommendations`
(`me.ts:169`). Every call site stays on `useAddShow` / `useRemoveShow`, so the
`["me-recommendations"]` rule survives by construction. It gets a test, not a
change.

## 3. What to build

### 3.1 The rule (D1)

> **The control overlays the poster where it can only remove; it sits in the
> card or row's action row wherever adding is possible.**

That yields exactly one overlay surface today — the viewer's own My Shows ·
Active, in both views — and leaves Watched, friend libraries, the
recommendations grid and the browse grids on the labelled action-row button.
The two positions mean different things, which is what makes them two.

The rule's home is `MyShowsButton`'s docstring, beside the two variants it
selects between. It replaces the paragraph recording the self-mode exception.

### 3.2 `MyShowsButton` gains a variant and a name (D2, D3, D4)

```ts
MyShowsButton({ showId, showName, inMyShows, variant = "labelled" })
```

* `variant: "labelled" | "compact"`. `labelled` is today's chip, unchanged.
  `compact` is icon-only and reuses `DismissRecommendationButton`'s shell
  verbatim — `p-1.5` wrapper around an `h-6 w-6` rounded-full
  `bg-background/80 shadow backdrop-blur` — because it occupies the same slot
  in the same corner; only the glyph and the label differ.
* The compact glyph is **`BookMinus`** when tracked and `Plus` when not (**D4**).
  It carries `data-remove-from-my-shows` for §3.5's focus effect.
* `showName` is **required** on both variants, and the accessible name carries
  it: `Remove {name} from My Shows` / `Add {name} to My Shows` (**D3**). The
  visible text of the labelled variant stays "My Shows".
* Both variants stay disabled while their mutation is pending, and the
  optimistic `override` / `lastUpstream` reconciliation is untouched — it is
  the behavioural half the component exists to hold once.

The compact variant renders both states even though the one surface that uses
it can only ever reach the remove state. Hard-coding it would put a second
decision inside a component whose whole contract is that it *takes the answer,
not the sources*, and `ShowCard`'s `addable` comment already argues this: taking
the answer from the caller is what keeps the next surface from showing a
"tracked" badge beside an "Add" button.

### 3.3 `MyShowCard` gains `removable` (D7)

A boolean opt-in prop on `ShowCard`'s `addable` / `dismissible` precedent — the
card builds the compact `MyShowsButton` itself and hands it to
`ShowPoster.control`. A `ReactNode` prop was rejected for the reason that seam
exists: an affordance belonging to one surface arrives as a flat opt-in, not as
a hole any caller can fill.

`inMyShows`'s `= true` default is removed and the prop made required. That
default is what let the always-true badge exist; with §3.4 passing
`callerPosterMark` in both modes, no caller wants it.

### 3.4 `LibraryActiveList` (D1, D5, D8)

Grid (`~217`):

* `inMyShows={callerPosterMark(entry.show.id, viewerContext, callerLibrary)}` —
  the same helper the list row already uses, so both views ask one question.
  Self mode gets `false`, which is finding 2.3's fix.
* `removable={viewerContext.kind === "self"}`.

List (`ActiveRow`):

* `ShowPoster` gains `ownRating={owner.kind === "own" ? entry.my_rating : null}`,
  matching `MyShowCard` exactly. `OwnerFacts` keeps `rating={owner.kind === "own" ? null : entry.my_rating}` — a friend's rating stays in the group that
  carries their name (NEU-1182 §3.5).
* `ShowPoster` gains `control={…}` — the compact `MyShowsButton` in self mode,
  `undefined` in friend mode.
* The action-row `<div>` renders **only in friend mode**, where it still holds
  `CallerProgressNote` and the labelled `MyShowsButton`. In self mode it is
  gone entirely, along with the `RatingBadge` line.
* `ActionButton` is deleted. Its friend branch moves inline (it is one
  `MyShowsButton` behind one `upstream` derivation); its self branch and the
  `removed` state go with finding 2.2.

### 3.5 Focus after the card unmounts (D5)

`useRemoveShow.onMutate` filters the entry out of the cache, so the card
unmounts on click and focus falls to `<body>` — on the one surface where
removing several shows in a sitting is the expected use. `LibraryActiveList`
owns the fix, mirroring `RecommendedForYou` (NEU-1179 §3.4):

* record `{ showId, index }` when a removal lands;
* wait until the id has actually left the list before moving focus — the
  absence gate, which here is satisfied almost immediately but is what keeps
  the effect correct if the list changed meanwhile;
* focus the `[data-remove-from-my-shows]` chip that shifted into the freed slot,
  clamped to the last one when the removed card was last;
* when none remain, focus the list container (`tabIndex={-1}`).

A failed removal restores the row while focus stays where it moved. Chasing it
back is a second effect on a path nobody exercises by hand, which is the
objection `MyShowsButton`'s docstring already raises about extra revert
machinery.

Unlike NEU-1179 the callback fires on a mutation the component itself owns, so
the chip reports the landed removal the same way — one function reference for
every card, and the card hands its own id back.

### 3.6 What deliberately does not change

* **The show detail page** keeps `MyShowsToggle` (**D6**).
* **Watched rows, friend Active rows, the recommendations grid** keep the
  labelled `MyShowsButton` in the action row — adding is possible on all three.
* **The friend-mode Active grid** keeps no control at all, exactly as today
  (**D7**). Giving it one means giving `MyShowCard` an action row, which is
  NEU-1188's subject.

## 4. Decisions

**D1 — The overlay is the position, and it means "remove-only".**
Rejected: a row overflow menu (a new component with no precedent here, two taps,
its own focus and a11y surface); removal only from the show page (relaxes the
ticket's own AC 3 and makes an in-library act a two-navigation one); swipe (no
gesture primitive exists in this SPA, it is undiscoverable, it gives keyboard
and desktop users nothing, and the grid still needs a separate answer). Also
rejected: moving *every* surface's control onto the poster, which would need a
second `ShowPoster` control slot for the recommendations card and would strip
the "My Shows" label from the browse and search grids, where adding is the
primary action and discoverability matters most.

**D2 — One component with two variants, not two components.**
Rejected: a `RemoveFromMyShowsButton` sibling of `DismissRecommendationButton`.
It is a third drawing of one affordance — the thing this ticket exists to stop —
and a second home for the optimistic reconciliation to drift in. Also rejected:
keeping the bespoke copy and merely relocating it, which preserves an exception
whose stated reason finding 2.2 disproves.

**D3 — Both variants name the show.**
`DismissRecommendationButton` already does, because a grid of identical labels
is unnavigable. `MyShowsButton` does not, and it renders in the recommendations
grid, so twelve cards give twelve identical "Add to My Shows". The compact chip
has no visible text at all, which makes the name load-bearing rather than nice.
Fixing only the compact variant would leave one component with two labelling
rules and leave the defect on the surface it was first written for. The
labelled-variant repair is outside the ticket's ACs and is stated in the PR.

**D4 — `BookMinus`, not `X`, not `Check`, not `CircleMinus`.**
Bottom-right is now a shared corner: on a recommendations card it means "never
show me this again" (`X`), on an Active card it means "stop tracking". Emerald
`Check` is out — `InMyShowsBadge`'s docstring records that a green ✓ means
*watched* everywhere else in this app, which is a different fact about a show
from *tracked*. `CircleMinus` is maximally distinct but says nothing about what
it removes *from*, and these cards carry a watch-progress bar, so "remove" could
read as removing watch history — a different and destructive act. `BookMinus`
sits in the same family as the `Library` glyph the mark and `MyShowsToggle`
already use. The `Library` glyph itself was rejected: it would appear as a
*fact* top-left and a *control* bottom-right, and on this very tab the top-left
mark is being removed for being always-true.

**D5 — Focus is managed.** Rejected: accepting `<body>`, which NEU-1179 already
declined for the identical shape.

**D6 — The show detail page is out of scope.** `MyShowsToggle` is a page-level
primary CTA, not a card or row control; the ticket's own convergence target is
"the card/row action row", which a detail page is neither. Converging it would
also mean deriving membership from `useMyShows()` to satisfy `MyShowsButton`'s
"takes the answer" contract — `ShowDetail` carries no `in_my_shows`
(`api/types.ts:229`) — which loses `MyShowsToggle`'s explicit disabled
"Loading…" state and flashes "Add" before flipping. AC 1 is written to say so
rather than to carve out an exception that no longer exists.

**D7 — The friend Active grid waits for NEU-1188.** It has no control today in
either mode; giving it one is the grid/list parity problem, and this ticket
blocks that one. For one ticket's duration the self grid can remove and the
friend grid still cannot add — an honest, stated gap.

**D8 — The list row's own rating moves to the poster.** Rejected: leaving it and
rewriting AC 4 down to "height drops on unrated rows", which lands the ticket's
headline win on an arbitrary subset. Rejected: moving it inline into
`OwnerFacts`, which is where *another person's* rating goes — it would make the
list row the one surface in the app that files your rating with theirs
(NEU-1182 §3.5).

## 5. Acceptance criteria

1. `MyShowsButton` renders the add/remove affordance on every card and row that
   has one, in two variants. `LibraryActiveList`'s bespoke copy is deleted and
   `MyShowsButton`'s docstring records the rule in place of the exception. The
   show detail page's `MyShowsToggle` is unchanged and out of scope.
2. My Shows · Active, self mode, carries no action-row add/remove control and no
   library mark, in **either** view. Its only control is the compact chip in the
   poster's bottom-right corner.
3. Removing a show from My Shows · Active is one activation without leaving the
   page, in both views. The PR states the path.
4. Row height on My Shows · Active measurably drops at 375 px for a **rated** row
   as well as an unrated one. The PR carries the before and after figures.
5. Every never-recommend invalidation still fires: the `["me-recommendations"]`
   rule in `src/api/me.ts` survives, pinned by a test.
6. Both variants' accessible names carry the show's name.
7. After a removal unmounts a card, focus lands on the chip that took the freed
   slot, or on the list container when none remain.

## 6. Tests

* `MyShowsButton.test.tsx` — both variants render; compact carries
  `data-remove-from-my-shows` and the `BookMinus` glyph; both accessible names
  carry the show name; the optimistic override still reconciles against upstream.
* `MyShowCard.test.tsx` — `removable` renders the chip through
  `[data-show-poster]`, and is **absent by default** (the containment-seam
  assertion, per `ShowCard.test.tsx`'s existing pattern).
* `LibraryActiveList.test.tsx` — self mode: no action row, no library mark, in
  both views; the poster carries the viewer's rating in list view; friend mode
  keeps its labelled button and its action row; removal moves focus to the next
  chip, and to the container when the list empties.
* An invalidation test pinning AC 5 — a removal from the Active tab invalidates
  `["me-recommendations"]`.

## 7. Documentation

* `MyShowsButton` — the D1 rule, the two variants, and finding 2.2 replacing the
  exception paragraph.
* `MyShowCard` — `removable`, and why `inMyShows` lost its default.
* `LibraryActiveList` — why self mode has no action row.
* `tvbf-frontend`'s section of `.claude/CLAUDE.md` — the `ShowCard` opt-in-seam
  bullet gains the overlay rule, since it is where the card/poster placement
  conventions already live.

## 8. Out of scope

The show detail page (D6). The friend-mode Active grid's missing control (D7,
NEU-1188). Any change to Watched, friend libraries, the recommendations grid or
the browse grids beyond threading `showName`. The `["me-recommendations"]` rule
itself.

## 9. Risks to verify in the browser at 375 px

A list-row poster is `w-16` (64 px). It will carry a ~32 px rating badge
top-right and a ~36 px chip bottom-right — different corners of a ~90 px-tall
image, but tight. Eyeball it before calling AC 4 done; if it is illegible, the
fallback is to shrink the compact chip's shell on `size="row"` rather than to
reopen D8.
