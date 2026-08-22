# NEU-1176 — Refresh the recommendations grid after an add, and give the card the control

**Ticket:** [NEU-1176](https://linear.app/neuroticsasquatch/issue/NEU-1176/frontend-refresh-the-recommendations-grid-after-adding-a-show)
**Parent story:** [NEU-1174](https://linear.app/neuroticsasquatch/issue/NEU-1174/a-show-i-add-stops-appearing-in-this-weeks-recommendations)
**Repo:** `tvbf-frontend`
**Project:** TVBF: Maintenance
**Blocked by:** [NEU-1175](https://linear.app/neuroticsasquatch/issue/NEU-1175/backend-suppress-recommendations-for-shows-now-in-my-shows) — **Done**, `tvbf-backend` PR #307
**Contract doc:** `tvbf-backend/docs/specs/NEU-1112-recommendations-page-contract.md` §4.1 (the server-side rule this is the client half of)
**Project spec:** `docs/specs/tvbf-personalized-recommendations-project-spec.md` (umbrella) §8, §9, §11
**Sibling:** [NEU-1179](https://linear.app/neuroticsasquatch/issue/NEU-1179/frontend-a-remove-control-on-a-recommendation-card) — the dismiss control, which reuses the containment seam built here
**Status:** approved for implementation

This spec lives in the umbrella `docs/` because it is not itself cited across
repos: it *consumes* the NEU-1112 contract rather than defining one
(CLAUDE.md's cross-repo-citation rule).

---

## 1. What this is

NEU-1175 made `GET /me/recommendations` suppress any stored suggestion the
viewer already has a record for, so the next stored suggestion takes its place.
The set is immutable and the suppression is a live join, so the payload now
changes the moment the user acts — and the SPA has no idea. The contract doc
states the client's half in as many words (§4.1):

> What a client *may* do with the list is decide when to refetch: any of the
> four actions above can change this payload, so the grid is stale after one
> until it is fetched again.

That is what this ticket builds — plus, per §3 below, the control that makes the
grid a place the action can be taken from at all.

## 2. Three findings that reshaped the ticket

These were established against the code before any decision below was taken, and
each one moves an acceptance criterion.

**2.1 The ticket's rule is narrower than the one that shipped.** NEU-1176 says
"the My Shows mutation". NEU-1175 deliberately widened suppression past My Shows
to project spec §8's four sources — My Shows membership, a show rating, any
episode watch, any episode rating — expressed once in
`recommendations/exclusion.py`, with the reasoning that
`show_membership_repo.add` has exactly one caller, so rating a show or marking
episodes never creates a My Shows row. A client that refetches on My Shows alone
reproduces the same hole one layer up. See **D1**.

**2.2 `ShowCard` has no add control**, so AC 1 as written ("adding a show from
the Discover recommendations grid") is not reachable. The card is a bare `<Link>`
carrying a read-only `InMyShowsBadge` and a `RatingBadge`; the only add path
today is `MyShowsToggle` on the show detail page, which is AC 2. See **D4**.

**2.3 On today's routes the invalidation is close to a no-op.**
`useRecommendations` runs `staleTime: 0` and leaving Discover unmounts the grid,
so the return trip already refetches; and `invalidateQueries` defaults to
`refetchType: "active"`, so an invalidation fired while the grid is unmounted
only *marks* the key stale — which `staleTime: 0` had already achieved. The
invalidation is what makes the **mounted-grid** case correct, and D4 is what
makes that case reachable. The two halves of this ticket are load-bearing for
each other; neither is worth much alone.

## 3. What to build

### 3.1 Invalidate `["me-recommendations"]` on all four §8 sources (D1)

In `src/api/me.ts`:

| Site | Why |
| -- | -- |
| `invalidateAll(qc)` | Covers `useAddShow`, `useRemoveShow`, `useMarkEpisode`, `useUnmarkEpisode`, `useMarkSeason`, `useUnmarkSeason`, `useMarkShow`, `useUnmarkShow` — My Shows membership and every episode-watch path, in both directions |
| `useShowRating.onSettled` | The show-rating source; does not route through `invalidateAll` today |
| `useEpisodeRating.onSettled` | The episode-rating source; likewise |
| `useRemoveFromHistory.onSuccess` | Bulk-deletes every `user_episode_watch` row for a show, so it can *un*-suppress; has its own hand-written invalidation list |

**D1 — the full four sources rather than My Shows alone.** The narrow rule leaves
exactly the hole NEU-1175's own D1 widened the server to close: a user who opens
a recommended show, rates it and marks two episodes — all reachable from the
detail page today — has created a record the server now suppresses on, and the
client would not know to look. Four lines buys the client trigger and the server
rule being the same sentence. The cost of getting it wrong is silent and
invisible in review, which is the argument for spending the lines.

`onSettled` rather than `onSuccess` for the mutations that already use it, so the
key is refreshed after a rollback too — a failed add that reverted still leaves
the server's answer authoritative.

**No optimistic update, in either direction.** The replacement card is the
server's choice from the stored 25 and the client cannot know what it is; the
grid also legitimately shrinks rather than backfilling. A refetch is both simpler
and the only correct source (contract §4.1, and NEU-1179 reaches the same
conclusion independently).

### 3.2 Extract `MyShowsButton` (D2, D3)

New `src/components/MyShowsButton.tsx`:

```tsx
export function MyShowsButton({ showId, inMyShows }: { showId: number; inMyShows: boolean })
```

It owns three things that are currently duplicated verbatim in
`LibraryActiveList.ActionButton` (friend mode) and `LibraryWatchedList.WatchedRow`:

* `useAddShow()` / `useRemoveShow()` and the two click handlers;
* the optimistic `override` / `lastUpstream` reconciliation — the render-phase
  block that clears the local override when upstream truth moves — and the
  revert-on-error in each `mutate` call;
* both visual states, carried across unchanged: `Check` + "My Shows" on an
  emerald `variant="outline"` when tracked, `Plus` + "My Shows" solid when not,
  `h-7 px-2 gap-1 text-xs`, `aria-label` "Remove from My Shows" / "Add to My
  Shows", `disabled` while that direction's mutation is pending.

**It takes the answer, not the sources.** Deriving `upstream` stays at each call
site, because the two disagree about where truth lives: `WatchedRow` picks
between `entry.in_my_shows` and `callerLibrary` on viewer context, while
`ActionButton` reads `callerLibrary` only. A prop that tried to cover both would
be a second copy of that decision.

**D2 — extract the whole toggle, not just the visuals.** The identical
`override` / `lastUpstream` block in two files is the part that can actually be
*wrong*; the markup is only the part that can drift. Extracting the visuals alone
would fix the cosmetic half and leave the behavioural half copied — and this repo
has already paid once for the cosmetic version of that mistake (`InMyShowsBadge`,
NEU-1057: three marks, two of which disagreed).

**D3 — `LibraryActiveList`'s *self* mode keeps its bespoke button.** There the
click optimistically hides the whole row and reverts on error; what it updates is
the row, not the button. Handing that out through `onOptimisticChange` /
`onRevert` callbacks would put a row's lifecycle into a button's interface and
route the revert path — the one nobody exercises by hand — through two components
instead of one. Its markup stays a fourth visual copy on purpose;
`MyShowsButton`'s docstring names it so the exception is recorded rather than
discovered.

Adopted by: `LibraryWatchedList.WatchedRow` (both viewer contexts),
`LibraryActiveList.ActionButton` friend mode, and §3.3's card control.

### 3.3 `addable` on `ShowCard` / `ShowGrid`, and the card's control (D4, D5)

**D4 — build the affordance AC 1 presupposes.** Making the grid a place a
recommendation can be acted on is what turns §3.1 from a guarantee about an
unreachable case into the mechanism behind a visible interaction, and it is the
shortest path between seeing a suggestion and taking it.

`ShowCard` gains an optional `addable?: boolean`; `ShowGrid` threads one prop
through to every card. **Only `RecommendedForYou` passes it.** Trending,
Most Anticipated, Similar Shows, search and browse pass nothing and render no
button — that containment is the point, and NEU-1179's dismiss control lands on
the same seam rather than inventing a second one.

**D5 — the button is a sibling of the `Link`, never a descendant.** A `<button>`
inside an `<a>` is invalid content nesting and a real focus-order problem.
`NextEpisodeCard` is the precedent that does it right; `SeasonWatchCheckbox`'s
`preventDefault` / `stopPropagation` is the fallback for where nesting could not
be avoided, and here it can. So:

```tsx
<div className="relative overflow-hidden rounded border border-border bg-background transition hover:border-foreground">
  <Link to={`/shows/${show.id}`} className="group relative block">
    <img … />
    {inMyShows && <InMyShowsBadge className="top-1 left-1" />}
    {show.my_rating != null && show.my_rating > 0 && <RatingBadge … />}
    <div className="p-1.5">{/* title, matched_aka, premiere line */}</div>
  </Link>
  {addable && (
    <div className="px-1.5 pb-1.5">
      <MyShowsButton showId={show.id} inMyShows={false} />
    </div>
  )}
</div>
```

Two details that are easy to lose in the restructure: the border, rounding and
`hover:border-foreground` transition move to the outer `div` (they belong to the
card, not to the link), while `group` **stays on the `Link`**, so hovering the
button does not underline the title.

`inMyShows={false}` is true by construction on this surface — the server
suppresses any show the viewer has a record for, so a tracked show never renders
here. The button's own optimistic override supplies the "✓ My Shows" beat between
the click and the card disappearing, which is the only feedback there is; there
is no success state because the card vanishing is the confirmation.

Failure needs no new handling: `MyShowsButton` reverts its override on error and
the card stays put, matching how the sibling Discover tabs handle failure and
what NEU-1179's AC 4 asks for. No page-level error, no toast — `useAddShow` has
never raised one.

### 3.4 The tab survives its own emptying (D6)

`DiscoverPage` withholds the "My Recommendations" tab entirely when the list is
empty. Combined with §3.3, adding the last remaining suggestion would make the
tab vanish under the user mid-interaction and drop them on Trending — their own
action reading as an unrequested navigation.

**D6 — latch `showRecommendations` for the mount.** Once the tab has been shown
in this mount it stays shown; the existing `isPending` term is unchanged. The tab
is still absent on the *next* visit, so project spec §11's "never advertise
absent machinery" rule is untouched for every user it was written for — a user
who has just used their recommendations up is not a user who has never had any.
The stored tab preference is still only healed when it names no tab, so nothing
is written back.

### 3.5 The emptied pane says one line (D7)

With the tab retained, that user is standing in a pane rendering `null`.

`RecommendedForYou` gains its own mount-scoped latch: it returns `null` on a cold
empty list exactly as today, and renders one line — *"That's everything for this
week — new recommendations on Sunday."* — only when it has previously rendered a
non-empty list in this mount.

**D7 — this is not the empty state §11 forbids.** That rule is about a user
meeting machinery they have never had, where an explanation costs a real moment
of "why is this broken?". This line is reachable only by a user who just acted on
every suggestion they were given; it explains something they used up. The cold
paths — never generated, below the floor, failed run, failed request — all still
render nothing at all, and `DiscoverPage` still withholds the tab for them.

"Sunday" is accurate: the weekly pass is a Coolify scheduled task running
Sundays.

### 3.6 Scope note

This ships as **one ticket, one PR**, against the usual rule. All five pieces
serve one sentence — *the grid reflects what I just did* — and the `MyShowsButton`
extraction exists only because the card needs a third copy of that button, so
splitting it out would leave a refactor whose justification lives in another
ticket. Roughly six source files plus tests.

## 4. Acceptance criteria

Numbering follows the ticket's; 1 is restated per §2.2 and 6–10 are new.

1. With the grid mounted, adding a show from a recommendation card removes that
   card and surfaces the next stored suggestion, with no reload.
2. Adding the same show from its show detail page has the same effect on
   returning to Discover.
3. Removing a show from My Shows restores its card.
4. When the surviving list is shorter than twelve the grid renders the shorter
   list, with no error and no empty state.
5. When the list empties entirely, the section renders §3.5's single line if it
   had rows earlier in this mount, and nothing at all otherwise — never
   `ShowGrid`'s "No shows match your filters."
6. Rating a show, rating an episode, marking an episode/season/show watched, and
   clearing a show's watch history each refresh the grid, in both directions.
7. Trending, Most Anticipated, Similar Shows, search and browse render no add
   control, and their cards are otherwise unchanged.
8. Activating the card's button never navigates to the show page, and the button
   is not a descendant of the card's link.
9. A failed add leaves the card in place with the button back in its "+ My Shows"
   state, and shows no page-level error.
10. `LibraryActiveList` and `LibraryWatchedList` behave exactly as before the
    extraction, including friend mode's optimistic toggle, its revert on error,
    and self mode's row-hiding Remove.

## 5. Tests

| Where | What |
| -- | -- |
| `src/components/MyShowsButton.test.tsx` (new) | Both visual states and their accessible names; add and remove call the right mutation; optimistic override flips immediately and reverts on error; a change in upstream truth clears a stale override |
| `src/components/discover/RecommendedForYou.test.tsx` (new) | AC 1 on `Anticipated.test.tsx`'s precedent — a shrinking MSW response plus a click on a card's own button; AC 3; AC 4; AC 5 both ways, asserting the "No shows match your filters." string is absent; AC 9 |
| `src/components/ShowCard.test.tsx` | `addable` renders the button; **absent by default** — the containment assertion NEU-1179 asks for, in the shared component rather than in each grid's test |
| `src/pages/DiscoverPage.test.tsx` | AC 5's tab half: a tab shown once stays shown when the list empties, and is still absent on a cold empty list |
| `src/api/me.test.tsx` | AC 6 — hook-level, counting `/me/recommendations` requests through MSW: each of the four sources' mutations triggers a refetch while the query has an active observer |
| `src/components/discover/Anticipated.test.tsx`, `Trending.test.tsx`, `SimilarShows.test.tsx` | Unchanged and still passing — the negative half of AC 7 |
| Existing library list tests | Unchanged and still passing (AC 10). If any asserts on the button's markup rather than its accessible name, that is the assertion to keep honest through the extraction |

Gates, all containerised, from `tvbf-frontend/`: `task lint`, `task typecheck`,
`task test`.

## 6. Documentation

**Umbrella `.claude/CLAUDE.md`, "Frontend conventions"** — two entries:

* A mutation that creates or removes a project-spec §8 record (My Shows
  membership, a show rating, an episode watch, an episode rating) must
  invalidate `["me-recommendations"]`. The client **never re-implements the
  suppression rule** — it is one definition on the server
  (`recommendations/exclusion.py`), cited by NEU-1112 contract §4.1, and a client
  copy is a second expression of it that drifts. A fifth source added to that
  module (NEU-1178's dismissal) changes both ends.
* `ShowCard`'s opt-in props are the containment seam for surface-specific
  controls: the card is shared by trending, anticipated, similar, search and
  browse, so an affordance that belongs to one surface arrives as an opt-in prop
  threaded through `ShowGrid` and is asserted absent by default. NEU-1179's
  dismiss control uses the same seam.

**Docstrings** — `MyShowsButton` records what it absorbed and the one call site
that keeps its own copy (D3); `ShowCard` records why the button is a sibling of
the `Link` rather than inside it (D5); `RecommendedForYou` and `DiscoverPage`
record the mount-scoped latches and why they do not contradict §11 (D6, D7).

## 7. Out of scope

* **Dismissal** — NEU-1178 (backend) and NEU-1179 (the card control). Nothing
  here anticipates it beyond leaving the containment seam in one place and the
  card's top-right corner free.
* **`in_my_shows` on the recommendations payload.** It would always be false; the
  suppression is what guarantees that.
* **`my_rating` on recommendation cards** — still null, still no round trip
  (contract §4.4).
* **Backfilling the grid to twelve** from an older set. The 25-asked-for headroom
  is the mechanism; when it runs out, fewer cards is the answer.
* **`LibraryActiveList`'s self-mode Remove button** (D3).
* **Regenerating a set when it shrinks.** Adding a show changes the taste payload
  and therefore its hash, so that user's next Sunday run is not skipped.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
