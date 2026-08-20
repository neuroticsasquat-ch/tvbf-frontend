# NEU-1179 — A remove control on a recommendation card

**Ticket:** [NEU-1179](https://linear.app/neuroticsasquatch/issue/NEU-1179/frontend-a-remove-control-on-a-recommendation-card)
**Parent story:** [NEU-1177](https://linear.app/neuroticsasquatch/issue/NEU-1177/remove-a-show-from-my-recommendations-and-never-recommend-it-again)
**Repo:** `tvbf-frontend`
**Project:** TVBF: Maintenance
**Blocked by:** [NEU-1178](https://linear.app/neuroticsasquatch/issue/NEU-1178/backend-dismiss-a-recommendation-and-add-it-to-the-do-not-recommend) — **Done**, `tvbf-backend` PR #308
**Contract doc:** `tvbf-backend/docs/specs/NEU-1112-recommendations-page-contract.md` §4.1, §5.1
**Sibling, shipped:** [NEU-1176](https://linear.app/neuroticsasquatch/issue/NEU-1176/frontend-refresh-the-recommendations-grid-after-adding-a-show) — `docs/specs/NEU-1176-refresh-the-recommendations-grid.md`, which built the containment seam and the emptying latch this ticket reuses
**Project spec:** `docs/specs/tvbf-personalized-recommendations-project-spec.md` (umbrella) §7, §8, §11
**Status:** approved for implementation

This spec lives in the umbrella `docs/` because it is not itself cited across
repos: it *consumes* the NEU-1112 contract rather than defining one
(CLAUDE.md's cross-repo-citation rule).

---

## 1. What this is

NEU-1178 shipped `POST /me/recommendations/{show_id}/dismiss` and made a
dismissal the **fifth** never-recommend source, so a dismissed show is
suppressed from `GET /me/recommendations` immediately and can never be named by
a future weekly pass. Contract §5.1 is the settled shape:

* `204` on success **and on every repeat** — the write is `ON CONFLICT DO
  NOTHING`, so a client may fire it without checking first.
* Session cookie **and** `X-CSRF-Token`, like every mutating `/me` route. No
  request body, no response body.
* `404 {"detail": "not_found"}` for a show id no catalog row has, and that is
  the only `404`. An `adult` or tombstoned show is dismissible like any other.
* **There is no un-dismiss.**

This ticket is the affordance. Everything else — the suppression, the
promotion of the next stored suggestion, the exclusion of the show from future
payloads — already works; the grid has no way to trigger it.

## 2. Four findings that reshaped the ticket

Each was established against the shipped code before any decision below, and
each one moves the ticket's own text.

**2.1 AC 5 contradicts what NEU-1176 shipped two days earlier.** The ticket's
AC 5 asks that dismissing the last suggestion make the section *disappear*.
NEU-1176 shipped the deliberate opposite and argued it at length (its D6/D7):
`DiscoverPage` latches `everHadRecommendations` for the mount and hands it to
`RecommendedForYou`, so a list that empties **under a reader who had rows**
keeps its tab and renders one line — *"That's everything for this week — new
recommendations on Sunday."* The reason is that a vanishing tab drops the user
on Trending, so their own action reads as an unrequested navigation; Radix
unmounts an inactive `TabsContent`, which is why the latch lives on the page
rather than the panel. AC 5 was written the same day, before that design
existed. The "empty frame" it actually forbids is `ShowGrid`'s
`"No shows match your filters."` string, which the latch already makes
unreachable. See **§4 AC 5** and **§3.5**.

**2.2 The corner-collision problem no longer exists.** The ticket weighs
`InMyShowsBadge` (top-left) against `RatingBadge` (top-right). Both are
unreachable on this surface: `my_rating` is null by contract §4.4, and NEU-1175
suppresses any show the viewer has rated *or* tracks, so neither badge can
render on a recommendation card. More importantly NEU-1176 already moved card
controls out of the poster entirely, into an action row below the `Link`, as a
sibling. The corner is free and the nesting rule is already settled. See **D3**.

**2.3 The ticket's preferred prop shape diverges from the seam that shipped.**
It ranks `onDismiss?: () => void` first. But `addable` is a bare **boolean**,
and `MyShowsButton` owns `useAddShow` / `useRemoveShow` itself; `ShowGrid`
threads one flat value. A callback would put the mutation in
`RecommendedForYou` and hand `ShowGrid` a per-row closure — a different
ownership for the same job on the same card, one ticket apart. See **D1**.

**2.4 "Not interested" is the one phrase this feature must not use.** NEU-1177
opens by requiring the removal happen *"without that removal being read as an
opinion about the show"*, and NEU-1178 spends four paragraphs keeping a
dismissal out of `not_liked` because it is **not a taste signal** — dismiss
three prestige dramas you had already seen elsewhere and a taste-signal
implementation stops recommending prestige drama. The label must be about the
*recommendation*, not the show. See **D4**.

## 3. What to build

### 3.1 `useDismissRecommendation()` (D2)

In `src/api/me.ts`, beside `useRecommendations`:

```ts
export function useDismissRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (showId: number) =>
      apiFetch<void>(`/me/recommendations/${showId}/dismiss`, { method: "POST" }),
    onSuccess: () => invalidateRecommendations(qc),
    onError: () => toast.error("Could not remove that recommendation."),
  });
}
```

`apiFetch` needs nothing else: it sets `X-CSRF-Token` on any non-GET, sends no
`Content-Type` when there is no body, and short-circuits `204` before it would
try to parse one.

**It invalidates `["me-recommendations"]` and nothing else.** A dismissal
creates no My Shows row, no rating, no `activity_event` and no feed item
(NEU-1178 AC 9), so no other key's body changes.

**D2 — `onSuccess`, not `onSettled`.** Every other mutation in this file that
touches this key uses `onSettled`, because those have optimistic updates whose
rollback still leaves the server authoritative. This one has no optimistic
update, so a refetch after a failure would spend a request to be told the same
thing — and firing only on success makes the ticket's AC 4 ("a failed request
leaves the card in place") structural rather than incidental.

**A toast, because silence here is indistinguishable from a dead button.** AC 4
forbids a *page-level* error, which a toast is not, and `toast.error` is this
codebase's habit for a failed mutation (`useShowRating`, `useEpisodeRating`,
`useRemoveFromHistory`, `useBlockUser`). The one silent mutation is
`useAddShow`, and it is silent precisely because its optimistic override
*reverts* — visible failure feedback this control has no equivalent of. Without
a toast, a genuinely broken endpoint reads to the user as a button that does
nothing at all.

### 3.2 `DismissRecommendationButton` (D1, D3, D4)

New `src/components/DismissRecommendationButton.tsx`:

```tsx
export function DismissRecommendationButton({
  showId,
  showName,
  onDismissed,
}: {
  showId: number;
  showName: string;
  onDismissed?: (showId: number) => void;
})
```

It owns the hook, exactly as `MyShowsButton` owns its two. It renders an
always-visible chip carrying an `X` icon:

* `aria-label={`Don't recommend ${showName} again`}`,
  `title="Don't recommend this again"`;
* `data-dismiss-recommendation` — the attribute §3.4's focus move queries;
* `disabled={dismiss.isPending}`;
* `onClick` fires the mutation with `{ onSuccess: () => onDismissed?.(showId) }`.

Visually: a small solid chip, not a bare glyph on artwork —
`bg-background/80 backdrop-blur` on a rounded `h-6 w-6`, absolutely positioned
`top-1 right-1`, with a larger hit area than its box (the 24px chip is below
the 44px tap-target guideline, so the padding is load-bearing, not decoration).

**It is always visible and never hover-revealed.** Discover is a mobile-first
surface with no hover at all; a hover-reveal is an affordance that does not
exist for most of the people using it.

**D1 — a `dismissible` boolean, not an `onDismiss` callback (2.3).** The seam
NEU-1176 built one ticket ago is a boolean whose button owns its own mutation,
and matching it keeps one shape for one job. The counter-argument — that a
callback keeps `ShowCard` from importing a recommendations-specific hook — does
not survive contact with the file: `ShowCard` already imports `MyShowsButton`,
which is My-Shows-specific.

**D3 — the poster's top-right, not the action row.** Measured: `AppShell` is
`max-w-6xl px-4` and `ShowGrid` is `grid-cols-3 gap-2` at the smallest
breakpoint, so at a 375px viewport a card is `(375 − 32 − 16) / 3 ≈ 109px`,
leaving ~97px inside the action row's `px-1.5`. `MyShowsButton` (`h-7 px-2
gap-1 text-xs`, a 14px `Plus` plus the string "My Shows") is ~78px; a second
control even at an icon-only `h-7 w-7` needs 78 + 4 + 28 = **110px**. It does
not fit. Wrapping or stacking would make recommendation cards taller than every
other card in a shared grid. The overlay costs no row width, leaves NEU-1176's
action row byte-identical, and changes card height on no surface.

**It is a sibling of the `Link`, never a descendant** — the outer `div` is
already `relative`, so the chip positions against it. This is NEU-1176's D5
rule carried forward, and it is why no `preventDefault` / `stopPropagation` is
needed: a `<button>` inside an `<a>` is invalid content nesting and a real
focus-order problem, and `SeasonWatchCheckbox`'s event-swallowing is the
fallback for where nesting could not be avoided. Here it can.

**D4 — the copy names the recommendation, not a preference (2.4).** "Don't
recommend *{name}* again" says what the action does and that it is permanent.
"Not interested" says the user dislikes the show, which is the claim the whole
parent story refuses to record.

**The show name in the accessible name is a deliberate divergence.**
`MyShowsButton` uses a flat `"Add to My Shows"`, and on this very surface there
are already twelve identical ones. It is worth spending here because this is
the destructive, irreversible control: hearing "Don't recommend Severance
again" is the difference between confirming and guessing. The cost is that
`ShowCard.test.tsx` matches on a regex or the seeded name rather than a flat
string.

**No confirm dialog (D5).** A modal per card on a twelve-card grid is heavy for
a one-tap action, and the loss it would guard is bounded: contract §5.1 states
by name that trending, most anticipated, similar shows, search and browse are
**unaffected** by a dismissal, *"A user must still be able to find a show they
dismissed."* The suggestion goes; the show does not. A toast-with-undo is
unbuildable — NEU-1178 ships no un-dismiss — and a first-use-only dialog needs
persisted state nothing here has. The label carries the permanence instead.

### 3.3 `dismissible` on `ShowCard` / `ShowGrid`

`ShowCard` gains `dismissible?: boolean` and `onDismissed?: (showId: number) =>
void`; `ShowGrid` threads both flat to every card. **Only `RecommendedForYou`
passes them.** Trending, Most Anticipated, Similar Shows, search and browse
pass nothing and render no chip — that containment is the point, and it is the
seam NEU-1176 established rather than a second one.

`onDismissed` is passed as **the same function reference to every card**, not
as a per-row closure: the card already knows its own `show.id` and hands it
back. `ShowGrid` keeps threading flat values only.

`dismissible` and `addable` are independent booleans. `RecommendedForYou`
passes both; nothing else passes either.

### 3.4 Focus after the card disappears (D6)

Because there is no optimistic removal (§3.5), the sequence is: activate the
chip → `POST` → invalidate → refetch → the row leaves the array → `ShowCard`
unmounts → **focus falls to `<body>`**. A keyboard or screen-reader user then
tabs from the top of the document back into the grid: on twelve cards each
carrying a `Link`, a My Shows button and a chip, that is ~25 stops to return to
where they were. Dismissing is the *repeated* action on this surface, so this
is not a theoretical cost.

`RecommendedForYou` owns the fix:

* it holds a ref on its own `<section>`;
* `onDismissed(showId)` records `{ showId, index }`, the index being that
  show's position in the list at the time;
* an effect keyed on `recommendations` **waits until that `showId` is absent
  from the list**, then queries the section's own subtree for
  `[data-dismiss-recommendation]` and focuses `chips[min(index, chips.length −
  1)]` — the card that shifted up into the slot, which is the natural
  next-in-reading-order, clamped when the dismissed card was last;
* if no chips remain, it focuses the sign-off line (`tabIndex={-1}` on the
  `<p>`), so what the reader hears is *"That's everything for this week — new
  recommendations on Sunday."*;
* then it clears the stored record.

**The absence gate is the part that is easy to get wrong.** `onSuccess` fires
*before* the refetch resolves, so an effect that ran on the callback alone
would focus the card that is about to unmount. Gating on the dismissed id
having left the list is also what keeps it correct when the refetch is slow or
the list changed for some other reason meanwhile.

**D6 — a section ref plus one `data-` attribute, not ref forwarding.** The
alternative is forwarding refs `RecommendedForYou → ShowGrid → ShowCard →
chip`: three levels of plumbing across components shared by five surfaces that
need none of it, plus a ref collection keyed by index that has to survive the
array changing under it. The honest cost of the chosen mechanism is that
`RecommendedForYou` reaches into `ShowCard`'s rendered DOM by attribute rather
than through a typed interface — a real coupling, but a shallow and testable
one, and the attribute is what makes it explicit rather than incidental.

Focus ownership moving up while the *mutation* stays in the chip is consistent
with D1: that decision was about who owns the write.

**No `aria-live` announcement.** Moving focus to a chip whose accessible name
is "Don't recommend *{next show}* again" already announces the new context; a
live region would double-speak it.

### 3.5 No optimistic removal, and no other change to the two components

The replacement card is the server's choice from the stored 25 and the client
cannot know what it is; the grid also legitimately shrinks rather than
backfilling (contract §4.1). A refetch is the only correct source — the same
conclusion NEU-1176 reached independently for the add path. `staleTime: 0` plus
`Cache-Control: no-store` makes it immediate; a brief flicker is acceptable, a
wrong card is not.

The in-flight beat is `disabled={dismiss.isPending}` and nothing more, matching
`MyShowsButton`. Note that `isPending` covers only the `POST`, not the refetch
behind it, so there is a short window where the chip is live again and the card
is still there. Chasing it would mean threading query state into the button;
it is not worth it.

**Beyond §3.4's focus effect and one more prop on its `ShowGrid`,
`RecommendedForYou` is unchanged and `DiscoverPage` is untouched.** The
mount-scoped latch NEU-1176 built already covers dismissal for free, because it
latches on *had rows*, not on why they went away (2.1, and NEU-1176’s D7).

## 4. Acceptance criteria

Numbering follows the ticket's; 5 is restated per 2.1 and 6–8 are new.

1. Each recommendation card carries a labelled dismiss control; activating it
   removes that card and surfaces the next stored suggestion, with no reload.
2. Activating it does not navigate to the show page, and the control is **not a
   descendant of the card's `Link`**.
3. Trending, Most Anticipated, Similar Shows, search and browse render no
   dismiss control, and their cards are otherwise unchanged.
4. A failed request leaves the card in place and shows no page-level error; the
   failure is reported by a toast, and no refetch is spent.
5. Dismissing the last remaining suggestion renders §3.5's single sign-off
   line — never `ShowGrid`'s `"No shows match your filters."` — and the tab
   does not vanish under the user. A cold empty list still renders nothing at
   all and `DiscoverPage` still withholds the tab.
6. After a dismissal, focus moves to the chip that took the dismissed card's
   place, to the last chip when the dismissed card was last, or to the sign-off
   line when none remain — never to `<body>`.
7. The control's accessible name names the show and does not describe the
   action as a preference or imply it can be undone.
8. Dismissing the same show twice is harmless (the endpoint is idempotent);
   the client fires without checking first.

## 5. Tests

| Where | What |
| -- | -- |
| `src/components/DismissRecommendationButton.test.tsx` (new) | The accessible name carries the show's name; a click calls `POST /me/recommendations/{id}/dismiss`; the button is disabled while pending; a failed request surfaces a toast and calls `onDismissed` **not at all** |
| `src/components/ShowCard.test.tsx` | `dismissible` renders the chip; **absent by default** — AC 3's negative half, asserted in the shared component rather than once per grid, on NEU-1176's precedent; and `chip.closest("a")` is null (AC 2) |
| `src/components/discover/RecommendedForYou.test.tsx` | AC 1 on the existing `serveShrinkingList` harness — a shrinking MSW response plus a click on a card's own chip; AC 4 with an erroring handler, asserting the card survives and no second `GET` is issued; AC 5 both ways, asserting the `"No shows match your filters."` string is absent; AC 6 for all three focus outcomes |
| `src/components/discover/Anticipated.test.tsx`, `Trending.test.tsx`, `SimilarShows.test.tsx`, search/browse tests | Unchanged and still passing — the rest of AC 3 |
| `src/api/me.test.tsx` | The hook invalidates `["me-recommendations"]` on success and **not** on failure |

Gates, all containerised, from `tvbf-frontend/`: `task lint`, `task typecheck`,
`task test`.

## 6. Documentation

**Umbrella `.claude/CLAUDE.md`, "Frontend conventions"** — the two entries
NEU-1176 wrote already anticipate this ticket; both need their forward
references turned into records of what landed:

* the never-recommend invalidation entry already names NEU-1178's dismissal as
  the fifth source — note that `useDismissRecommendation` is the client half,
  and that it is the one such mutation invalidating on `onSuccess` rather than
  `onSettled`, because it has no optimistic update to roll back;
* the `ShowCard` opt-in-seam entry says "NEU-1179's dismiss control lands on the
  same seam" — record that it did, as `dismissible`, and that a control is a
  sibling of the card's `Link` whether it sits in the action row or overlays
  the poster.

**Docstrings** — `DismissRecommendationButton` records D4 (why not "Not
interested") and D5 (why no confirm); `ShowCard` records why the chip overlays
the poster where the add button sits below it (D3's measurement);
`RecommendedForYou` records the focus mechanism and specifically the absence
gate (D6).

## 7. Out of scope

* **Un-dismissing, and any surface listing a user's dismissals.** NEU-1178
  ships no endpoint and NEU-1177 defers both to a follow-up; the row carries
  `created_at` so a future settings surface can list them.
* **A dismiss control anywhere else.** Contract §5.1 forbids it by name so a
  dismissed show stays findable via trending, most anticipated, similar shows,
  search and browse.
* **Optimistic removal** (§3.5) and **`aria-live`** (§3.4).
* **A confirm dialog**, in any form (D5).
* **Any change to how the list empties** — NEU-1176's latch and its copy stand
  as shipped (2.1, and NEU-1176’s D7).
* **Regenerating a set when it shrinks.** A dismissal changes the payload's
  bytes, so that user's next Sunday run is not skipped as unchanged
  (NEU-1178 AC 5).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
