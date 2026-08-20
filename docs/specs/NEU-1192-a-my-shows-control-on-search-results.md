# NEU-1192 — A My Shows control on search results, in both views

**Ticket:** [NEU-1192](https://linear.app/neuroticsasquatch/issue/NEU-1192/add-a-my-shows-control-to-search-results-in-both-views)
**Repo:** `tvbf-frontend`
**Project:** TVBF: Open Registration — milestone *0. UI consistency*
**Blocked by:** [NEU-1188](https://linear.app/neuroticsasquatch/issue/NEU-1188) — **Done**, merged as `0e74552` (PR #203)
**Related:** [NEU-1176](https://linear.app/neuroticsasquatch/issue/NEU-1176) (the containment seam), [NEU-1186](https://linear.app/neuroticsasquatch/issue/NEU-1186) (the mark this control acts on)
**Precedents this consumes:** `docs/specs/NEU-1187-one-add-remove-control.md` (the one control and its placement rule), NEU-1183's placement rule as recorded in `src/components/ShowPoster.tsx`, `docs/specs/NEU-1176-refresh-the-recommendations-grid.md` (the `addable` seam)
**Status:** approved for implementation

This spec lives in the umbrella `docs/` because nothing in another repo cites
it: it is entirely a `tvbf-frontend` change consuming contracts that already
exist (CLAUDE.md's cross-repo-citation rule).

---

## 1. What this is

Search results say whether you already track a show and offer no way to act on
it. NEU-1186 put the library mark on search precisely because search is *"the
one surface where 'should I add this?' is the actual question"* — and the only
way to answer it is still to navigate into the show page and come back.

Neither view has the control, so this is **not** a NEU-1188 parity defect: it
is a capability the surface lacks in both views, deliberately left out of that
ticket because adding one is a product call rather than a consistency fix.
NEU-1188's own search test says so in a comment (`viewParity.test.tsx:224`).

Both seams already exist. `ShowCard.addable` threads through `ShowGrid`, and
NEU-1188 left `ShowList` rendering through `ShowPoster`, so a row control lands
the same way. `MyShowsButton` **takes the answer, not the sources**, and
`BrowseShow` already carries `in_my_shows`, so both views have the answer to
feed it.

## 2. What is established before any decision below

**2.1 The control is already the right one, in the right variant.** NEU-1187 §3.1:

> The control **overlays the poster where it can only remove**; it sits in the
> card or row's **action row wherever adding is possible.**

On search, membership genuinely varies — that is the whole reason the mark is
there — so adding is possible and the variant is `labelled`. The `compact`
overlay is not a candidate here, and `ShowPoster`'s single `control` slot stays
empty on this surface.

**2.2 A labelled control and a library mark already coexist.** On every Watched
row and every friend Active row the emerald "✓ My Shows" chip sits below a
poster carrying `InMyShowsBadge`. So a card that shows both is precedent rather
than a new double-drawing of one claim; NEU-1057's "one claim, one picture"
rule is about a claim drawn *differently on different surfaces*, which this is
not.

**2.3 `SearchOverlay` is the only caller of either component that this ticket
touches.** `ShowList` has exactly one call site (`SearchOverlay.tsx:208`);
`ShowGrid` has five, of which only that one is search. Nothing else changes
behaviour.

**2.4 The action row was removed from one surface, and re-added on another,
inside this milestone.** NEU-1187 took the labelled chip's line off My Shows ·
Active — rows and cards — and replaced it with the `compact` chip in
`ShowPoster`'s corner, because every entry on that tab is tracked by definition.
That is the whole of the removal. One ticket later NEU-1188 *added* an action
row to `MyShowCard` for the friend and Watched surfaces, with a comment saying
why (`MyShowCard.tsx:167-176`): *"adding **is** possible on both surfaces that
pass this, which is what the action row's position means."* Four surfaces carry
one today — the recommendations card, the friend/Watched card, the Watched row
and the friend Active row — so this ticket is matching the live convention, not
restoring something the milestone retired. The conflict would be the *other*
choice: an overlay chip on search would be the variant that says adding is
impossible, on the one surface where it is the question.

**2.5 `["shows"]` has no optimistic write today.** `useAddShow` / `useRemoveShow`
patch `["my-shows"]` in `onMutate` and reach `["shows"]` only through
`invalidateAll` in `onSettled` (`api/me.ts:150-264`). That was invisible while
no surface reading `["shows"]` carried a control: the recommendations card
*vanishes* on add, so its chip's optimistic override was the only feedback
there was and nothing was left on screen to disagree with. A search result
stays put, which is what makes §3.3 this ticket's work rather than a nicety.

## 3. What to build

### 3.1 `ShowList` gains `addable`

Mirror `ShowGrid`'s prop exactly — an opt-in boolean, defaulting to no control,
so the component stays shared and every future caller gets the default without
saying anything. The row renders it in a right-aligned action row at the foot
of the content column:

```tsx
{addable && (
  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
    <MyShowsButton showId={show.id} showName={show.name} inMyShows={show.in_my_shows ?? false} />
  </div>
)}
```

That container is **verbatim** the one `WatchedRow` (`LibraryWatchedList.tsx:379`)
and the friend Active row (`LibraryActiveList.tsx:385`) already use, including
`pt-1`. A row control that placed itself differently from every other row
control in the app would be a new inconsistency landed inside the UI-consistency
milestone. It costs ~32 px of height on each of up to 50 rows (an `h-7`
chip plus `pt-1`), which is the price of the capability and is paid identically
on the Watched and friend Active tabs.

`inMyShows` falls back to `false` for the same reason `ShowCard`'s does: the
prop is optional on the way in, and a payload without the field renders a row
whose control offers to add.

### 3.2 `SearchOverlay` passes `addable` on both

One line (`SearchOverlay.tsx:208`), both branches. `data.items` is
`BrowseShow[]`, which carries `in_my_shows`, so the button and the badge are
fed from one field on one object — the structural half of DoD 3.

### 3.3 Membership flips in the `["shows"]` cache, not only in the button (D1)

`useAddShow` and `useRemoveShow` additionally patch every cached `["shows"]`
page in `onMutate`, and restore the snapshot in `onError`, alongside the
`["my-shows"]` write they already do:

```ts
/** Flip `in_my_shows` on the cached browse pages that hold this show.
 *
 * A page that does not hold it is returned **unchanged**, so a toggle does not
 * break referential equality for every cached search page and re-render grids
 * that did not change.
 */
function setBrowseMembership(qc: QueryClient, showId: number, inMyShows: boolean) {
  qc.setQueriesData<ShowListPage>({ queryKey: ["shows"] }, (prev) =>
    prev?.items.some((s) => s.id === showId)
      ? { ...prev, items: prev.items.map((s) => (s.id === showId ? { ...s, in_my_shows: inMyShows } : s)) }
      : prev,
  );
}
```

Snapshot-and-restore rather than an inverse flip on error, because that is the
shape both mutations already use for `["my-shows"]` and an inverse flip is a
second expression of the same guess. `cancelQueries({ queryKey: ["shows"] })`
precedes the patch for the reason it precedes the existing one: an in-flight
search response landing after the patch would write the pre-toggle body back
and reintroduce exactly the flicker being removed. A cancelled search fetch is
not lost — `invalidateAll` refetches it in `onSettled`.

**Scoped to `["shows"]`, deliberately.** `["trending"]`, `["anticipated"]` and
`["show-similar"]` carry the same mark and the same invalidate-on-settled
behaviour, and are left alone: the lag is only *observable* where a control
sits beside a mark and reaches the tracked state before it, and search is the
only such surface until the follow-up in §7 lands. Widening the writer to four
payload shapes for three surfaces with no control would be work to justify
before there is anything to see.

**One function, both mutations.** `MyShowsButton`'s local `override` is not
removed and does not become a second copy of this: it is a guess about *the
control*, cleared by its own `lastUpstream` reconciliation the moment upstream
moves — which, with this patch, is the same frame. The two agree by
construction on add (`true`/`true`) and on the error path (`false`/`false`).

### 3.4 What deliberately does not change

* **`MyShowsButton`** — no new variant, no new prop. The labelled chip's two
  states already are the completed-action feedback DoD 2 asks for: primary
  `Plus` "My Shows" → emerald outline `Check` "My Shows", with the accessible
  name moving from *"Add X to My Shows"* to *"Remove X from My Shows"*.
* **`ShowCard` / `ShowGrid`** — `addable` already threads. Zero-diff.
* **`ShowPoster`** — the mark's corner is its decision (NEU-1183 §3.4) and no
  call site here states a position.
* **The Similar tab, Trending and Most Anticipated** — §7.

## 4. Decisions

**D1 — The mark moves with the control, in the cache (§3.3).** The alternative
considered and rejected was to read DoD 3 structurally — both badge and chip
read one `in_my_shows` prop, therefore they *cannot* disagree, and the chip
leading the badge for one round trip is the sanctioned optimistic feedback DoD 2
asks for. That reading is defensible and costs nothing, and it was rejected
because the window is a full `PUT` plus a refetch of a 50-item search page on a
card that, uniquely, stays on screen throughout — the user watches the chip say
"✓ My Shows" beside a poster still saying nothing. Two signals confirming the
add is also the stronger answer to the ticket's own test: *"confirm that reads
as a completed action and not as a no-op"*.

**D2 — Hoisting the override out of `MyShowsButton` was rejected.** Making the
row/card own the optimistic state and pass it to both `ShowPoster.inMyShows` and
`MyShowsButton.inMyShows` would put the reconciliation back at the call sites —
the exact duplication NEU-1187 §2.1 spent a ticket collapsing, and it would need
a new `onOptimisticChange` prop on a component whose contract is that it takes
the answer.

**D3 — Suppressing the mark where the control is present was rejected.** It
would undo NEU-1186 AC 1 one ticket later, and §2.2 shows the two already
coexist on three surfaces.

**D4 — The chip is labelled on the grid card too, at 50 cards.** `compact` is
reserved by NEU-1187 §3.1 for where the control can only remove; using it here
because 50 chips is a lot would break the rule that the *position* is what says
whether adding is possible. The density cost is real and bounded: the action row
makes a search card ~32 px taller than a trending card, which is the same
difference a recommendations card already carries, and within the search grid
every card is uniform.

**D5 — Every chip carries the show's name in its accessible name.** Nothing new
— `MyShowsButton` requires `showName` (NEU-1187 §D3) precisely because a grid of
identical labels is unnavigable. This ticket is the first to render it 50 times,
which is worth stating rather than discovering.

## 5. Acceptance criteria

1. A show found by search can be added to My Shows without leaving the results
   page, in **grid and list** view.
2. Adding leaves the result in place and the control moves to its tracked state;
   removing moves it back.
3. The library mark and the control never disagree on one card or row —
   including in flight, per §3.3.
4. NEU-1188's parity test for search still passes with `add/remove control`
   counted in **both** views.
5. `ShowList` renders no control unless `addable` is passed.
6. A failed add reverts both the chip and the mark.
7. `task lint`, `task typecheck` and `task test` pass (run from `tvbf-frontend/`).

## 6. Tests

* **`components/viewParity.test.tsx`** — the search case renders both views with
  `addable` and adds `"add/remove control"` to its expected set; its comment
  naming NEU-1192 as the ticket that lands it is updated to say it has.
* **`components/ShowList.test.tsx`** — no control by default (AC 5); a labelled
  add control when `addable` and `in_my_shows` is false; the remove state when
  it is true.
* **`components/SearchOverlay.test.tsx`** — adding from a search result leaves
  the row on screen and the control reads as tracked (AC 1, AC 2), in grid and
  in list. This is the only test that exercises the real payload path.
* **`api/markInvalidation.test.tsx`** — the mark flips before the refetch lands
  (AC 3), and reverts on a failed mutation (AC 6). Its home rather than
  `me.test.tsx`, for the reason its own docstring gives: `me.test.tsx` stands up
  a second MSW server, which is fatal to a test that counts or sequences
  requests.

## 7. Out of scope

The Similar tab, Trending and Most Anticipated have the same mark and the same
absence. They are a follow-up: they are claims about the world rather than a
search someone is steering, so the case for a control on them is weaker and
should be made separately. The `["shows"]`-only scoping in §3.3 is the seam that
follow-up widens.

Making the control grid-only is also out of scope, in the stronger sense: it
would reintroduce the defect NEU-1188 exists to remove, one ticket after
removing it.

## 8. Risk to verify in the browser at 375 px

Fifty labelled chips have never rendered on one page. Worth one look at a
three-column grid and a fifty-row list: that the action row does not wrap inside
a ~109 px card, and that the list stays scannable with a control on every row.
