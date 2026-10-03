# NEU-1511 — Too easy to remove a show from My Shows

**Ticket:** [NEU-1511](https://linear.app/neuroticsasquatch/issue/NEU-1511/too-easy-to-remove-a-show-from-my-shows)
**Repo:** `tvbf-frontend`
**Project:** tvbf: Maintenance (no milestone, no parent, no relations)
**Reverses:** `docs/specs/NEU-1187-one-add-remove-control.md` **D1** — the poster-corner remove chip on My Shows · Active — and retires the compact variant that decision created
**Precedents this consumes:** `src/components/ConfirmDialog.tsx` (NEU-1168, the one confirmation modal), `src/components/RemoveWatchHistoryButton.tsx` (NEU-1193, a card control that owns its own confirm), NEU-1183's placement rule as recorded in `src/components/ShowPoster.tsx`, `src/hooks/useFocusAfterRemoval.ts` (NEU-1193)
**Status:** approved for implementation

---

## 1. What this is

The ticket, verbatim: *"The library icon overlaying the show poster for a show
in My Shows removes the show from My Shows with no confirmation and can too
easily be tapped while trying to tap the show itself to go to its page. The
icon should not be an active button."*

Two complaints, one control. The icon is `MyShowsButton`'s `compact` variant —
the `BookMinus` chip in the poster's bottom-right corner — which NEU-1187 put
on the viewer's own My Shows · Active tab, in both views, as the tab's only
removal path. That spec chose one-tap removal over the alternatives on purpose
and rejected "remove only from the show page" by name (D1). This ticket makes
the opposite call, with the facts that have changed since laid out in §2, and
adds a rule NEU-1187 did not have: **every removal from My Shows asks first.**

## 2. What is established before any decision below

**2.1 The icon is one component's variant, drawn on one surface.** `compact`
is passed exactly twice: `MyShowCard` builds it when `removable` is set
(`MyShowCard.tsx:153-159`, self-mode grid) and `ActiveRow` builds it inline
(`LibraryActiveList.tsx:338-348`, self-mode list). Both hand it to
`ShowPoster.control`. Nothing else in the app renders `variant="compact"` on
this button, and the `data-remove-from-my-shows` attribute exists only so
`LibraryActiveList` can move focus after the card unmounts.

**2.2 The mis-tap is a grid problem.** In grid view the whole card is one
`Link` over poster and caption (NEU-1183), and the chip is a 36 px sibling
positioned over the poster's corner; the padding is the hit area by design
(`DismissRecommendationButton`'s docstring). In list view the poster is
presentational — the show's name is the row's one link (NEU-1190 §1) — so the
poster is not a tap target to miss. The ticket's "while trying to tap the show
itself" describes the ~109 px card at 375 px.

**2.3 The reason the control overlaid the poster has lapsed.** NEU-1187 moved
it into the corner because the labelled chip "costs a full line of the tallest
rows in the app" and self mode had nothing else in its action row. NEU-1495 put
the push mute toggle in a self-mode action row on **both** the card
(`MyShowCard.tsx:206-215`) and the row (`LibraryActiveList.tsx:~388-399`). That
line is paid now, whatever this ticket does.

**2.4 The chip beside it already confirms.** `RemoveWatchHistoryButton`'s
compact variant reuses the same shell in the same corner on the Watched tab and
opens `ConfirmDialog` before acting. Two identical 24 px circles, one corner,
adjacent tabs, one guarded and one not — that is the inconsistency the ticket
is actually reporting, whichever way it is resolved.

**2.5 What a removal loses.** The backend's `my_shows_service.remove` deletes
the membership row and cancels the `added_show` activity, and nothing else
(`src/tvbf/app/services/my_shows_service.py:205-211`). Watch history and the
viewer's rating live in their own tables and survive. What goes with the row
is its `muted` and `hide_from_activity` flags and its `added_at` (the
`recent_activity` sort key), and re-adding emits a fresh `added_show` activity
into friends' feeds. So a stray removal is recoverable but not free — which is
why an undo toast was considered and set aside (§4 D2).

**2.6 Every other removal from My Shows is also one tap.** The labelled
`MyShowsButton` in its tracked state removes on click on Watched rows and
cards, friend Active and Watched rows and cards, and search results in both
views (NEU-1192); `MyShowsToggle` on the show page does too. The
recommendations grid never reaches the tracked state — a tracked show is
suppressed before it can be recommended — so it only ever adds. None of these
sits over a link, and none was reported, but a rule that says "removal asks
first" has to say it everywhere or it is not a rule.

## 3. What to build

### 3.1 My Shows · Active, self mode, carries no removal control (D1, D2)

Both views. The poster's bottom-right corner is **empty** on this tab — not an
inert glyph, and not a restored library mark, which NEU-1187 §2.3 deleted for
being always true here and which would be always true still.

* `MyShowCard` loses `removable`. `historyRemovable`, `mutable`,
  `callerRelationship` and `onRemoved` stay; `onRemoved` is still consumed by
  the watch-history chip. The docstring paragraph explaining that `ShowPoster`
  exposes one control slot and that Active passes `removable` while Watched
  passes `historyRemovable` is rewritten: only Watched passes a corner control
  now.
* `ActiveRow` passes no `control` to `ShowPoster`. Its docstring's account of
  the compact chip is replaced by the reason there is none (§4 D1) and a
  pointer to the show page.
* `LibraryActiveList` drops its `useFocusAfterRemoval` wiring, the module-scope
  `showIdOf`, the `onRemoved` prop it threaded into both views, and the
  `tabIndex={-1}` / `ref` on the results container, all of which existed for a
  removal that no longer happens on this tab. `LibraryWatchedList` keeps its
  identical wiring: its removal is the watch-history chip.

Removal from the viewer's own library is the show page's `MyShowsToggle`, which
§3.3 makes ask first.

### 3.2 `MyShowsButton` loses `compact`, `onRemoved` and its data attribute (D3)

`variant`, `onRemoved`, `data-remove-from-my-shows` and the `BookMinus` import
go. The component is the labelled action-row chip and nothing else. Its
docstring's "The rule (NEU-1187 §3.1)" paragraph, the paragraph on `compact`
rendering both states, the `BookMinus` paragraph, and the `onRemoved` paragraph
are replaced by one rule:

> **Adding and removing a show from My Shows is a labelled action-row control,
> never a poster overlay, and removing always asks first (NEU-1511).** The
> viewer's own My Shows · Active offers no removal at all: every entry there is
> in My Shows by definition, so the control could only remove, and a remove-only
> control over a poster is what got tapped by mistake. That tab's removal path
> is the show page.

The "takes the answer, not the sources" contract, the `override` /
`lastUpstream` reconciliation, the required `showName`, and the labelled
markup are untouched.

### 3.3 Every removal from My Shows confirms; adding never does (D4, D5, D6)

A new `src/components/RemoveFromMyShowsDialog.tsx` wraps `ConfirmDialog` with
this act's copy, so the words exist once:

```tsx
export function RemoveFromMyShowsDialog({ showName, pending, onConfirm, onClose }: {
  showName: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ConfirmDialog
      title="Remove from My Shows"
      description={`Remove ${showName} from My Shows? Your watch history and rating are kept.`}
      confirmLabel="Remove"
      destructive
      pending={pending}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
```

Two callers, each holding its own `confirming` state — the shape
`RemoveWatchHistoryButton` already uses, and the one `ConfirmDialog`'s
docstring expects (`{confirming && <Dialog …>}`, `open` hard-coded true):

* **`MyShowsButton`**, tracked state. `onClick` opens the dialog. **Confirm**
  does what the click did before — `setOverride(false)` then `remove.mutate`,
  with the same `onError` revert — and closes the dialog. **Cancel** and Escape
  close it and send nothing; the optimistic override is not set until confirm,
  so nothing on screen changes on a cancel. The button stays disabled while
  `remove.isPending`, which now also stops the dialog being reopened and fired
  twice mid-`DELETE` (NEU-1193's reason). The untracked state's `onAdd` is
  unchanged.
* **`MyShowsToggle`**, tracked state. The same: open on click, `remove.mutate`
  on confirm. Its `Loading…` state and its add path are unchanged.

The row or card stays mounted after a confirmed removal on every surface that
renders the labelled chip (a Watched row is history-based, a friend's row is
theirs, a search result stays put), so returning focus to the trigger is the
whole of the focus story; no `useFocusAfterRemoval` is needed for it.
*Implementation note:* Radix returns focus only to a `DialogTrigger`, which
`ConfirmDialog`'s conditional-render callers never have, so focus fell to
`<body>`. `ConfirmDialog` now captures the element that opened it and hands
focus back on close, and `MyShowsButton` keeps its button's DOM node across
the tracked → untracked flip so that element is still there.

The dialog's `description` says what is **kept**, because that is the fact a
person hesitating over "Remove" needs — the watch-history dialog one tab over
says "This cannot be undone", and this one must not read the same.

### 3.4 What deliberately does not change

* **`RemoveWatchHistoryButton`** and the Watched tab's compact `Trash2` chip.
  It sits over the same link and can be mis-tapped the same way, and its
  dialog is its guard; it is a different act, it was not reported, and it is
  irreversible in a way this one is not. If the dialog proves insufficient
  there, that is its own ticket.
* **`DismissRecommendationButton`** and the recommendations card's corner.
* **`ShowPoster`'s corner rule.** Bottom-right is still the control slot, and
  two surfaces still use it. Only My Shows removal leaves it.
* **`useFocusAfterRemoval`** itself, and `LibraryWatchedList`'s and
  `RecommendedForYou`'s use of it.
* **`useRemoveShow` / `useAddShow`**, including the `["shows"]` and
  `["my-shows"]` optimistic writes and the `["me-recommendations"]`
  invalidation in `onSettled`. The dialog sits in front of the mutation, not
  inside it.

## 4. Decisions

**D1 — No removal control on My Shows · Active, in either view.** This
reverses NEU-1187 D1, which rejected exactly this on the grounds that it
"makes an in-library act a two-navigation one". That cost is accepted: the
tab's whole population is tracked, so the control there could only ever
remove, and a remove-only control over a tap target is the defect. Rejected:
a confirm dialog **on the chip** — it keeps the target over the link, so every
mis-tap still costs a modal on the one surface where mis-taps happen most, and
it leaves a dead-looking corner control on a tab that does not need one.
Rejected: moving the chip into the action row beside the mute toggle — it
fixes the mis-tap and costs no height (§2.3), but keeps one-tap removal, and
puts a remove-only control in the position NEU-1187 defined as "adding is
possible". Rejected: hover-reveal, for the reason
`DismissRecommendationButton`'s docstring gives (a mobile-first surface has no
hover).

**D2 — Nothing in the corner, rather than an inert glyph or a mark.** A
`BookMinus` that does nothing looks like a broken button. A library mark
top-left is the always-true badge NEU-1187 §2.3 removed. An undo toast
(`EpisodeWatchCheckbox`'s pattern) was considered as the guard and set aside
with the control: §2.5's losses on a missed undo are small but real, and a
toast per removal on a tab that no longer removes has nothing to attach to.

**D3 — Delete the compact variant and its wiring, not park them.** No surface
passes `compact`, `removable` or `onRemoved` on `MyShowsButton` after §3.1. A
variant nobody renders, tested against a rule nobody follows, is what drifts;
the next surface that wants a corner removal reads `RemoveWatchHistoryButton`.

**D4 — Every removal from My Shows asks first; adding never does.** The
show page alone confirming was considered and rejected: it would make the same
act ask on one surface and not on five others, with no visible reason. The
cost is a modal on each un-toggle in search and browse, on a chip whose label
already reads "✓ My Shows"; that cost is accepted because "removing asks first"
is the rule the ticket asks for and a rule with exceptions is two rules.
Adding is unguarded because a stray add costs one un-toggle and loses nothing.

**D5 — One dialog copy in a wrapper; two callers, each owning `confirming`.**
Folding `MyShowsToggle` into `MyShowsButton` was rejected for NEU-1187 D6's
reasons, which still hold: the page has no `in_my_shows` to feed the
takes-the-answer contract and would lose its explicit loading state. A wrapper
that owns only the words is the smallest thing that stops the copy existing
twice; lifting the `confirming` state into it as well would give it a second
job and make `ConfirmDialog`'s conditional-render shape someone else's.

**D6 — `destructive` styling, and copy that names what survives.** Every
removal confirmation in this app styles its primary as destructive; matching
them is what marks "Remove" as the button to hesitate over. The description
says watch history and rating are kept, so it cannot be mistaken for the
watch-history dialog beside it.

**D7 — Spec and CLAUDE.md, no ADR.** The reversal is recorded here and in the
CLAUDE.md bullet that carried NEU-1187's rule; it is not costly to reverse
again and the frontend has no ADR tree.

## 5. Acceptance criteria

1. On the viewer's own My Shows · Active, in **grid and list** view, nothing in
   the poster corner is interactive and no button whose accessible name ends
   "from My Shows" renders anywhere on the tab. The mute toggle's action row is
   unchanged and card and row height do not grow.
2. Everywhere a removal from My Shows is offered — the show page, Watched rows
   and cards, friend Active and Watched rows and cards, search results in both
   views — activating it opens a dialog titled "Remove from My Shows" that
   names the show. **Cancel** or Escape closes it with no request sent and no
   change on screen. **Confirm** removes with the existing optimistic flip and
   the existing revert on failure.
3. Adding a show to My Shows remains one activation everywhere.
4. `MyShowsButton` has no `variant`, no `onRemoved` and no
   `data-remove-from-my-shows`; `MyShowCard` has no `removable`; `grep` finds
   `data-remove-from-my-shows` nowhere under `src/`.
5. `viewParity.test.tsx`'s Active-self case expects no `add/remove control`;
   every other parity case is unchanged.
6. The Watched tab's watch-history chip and its dialog are unchanged.
7. A confirmed removal still invalidates `["me-recommendations"]`.
8. `task lint`, `task typecheck` and `task test` pass (from `tvbf-frontend/`).

## 6. Tests

* **`MyShowsButton.test.tsx`** — delete the four compact-variant cases
  (icon-only rendering, the add state, reporting a landed removal, not
  reporting a failed one). Rewrite the three that click remove ("removes the
  show and flips optimistically", "reverts the optimistic flip when the remove
  fails", "clears a stale override when upstream truth moves") to confirm
  through the dialog. Add: clicking remove opens the dialog and sends nothing;
  Cancel leaves the tracked state and sends nothing; the add path never opens
  a dialog. Re-home NEU-1187 AC 5 here: a confirmed removal invalidates
  `["me-recommendations"]` (it was pinned in `LibraryActiveList.test.tsx`,
  which no longer removes).
* **`RemoveFromMyShowsDialog.test.tsx`** — the description names the show and
  says history and rating are kept; Confirm and Cancel call through.
* **`MyShowCard.test.tsx`** — delete the three `removable` cases. The
  watch-history and mute cases stay.
* **`LibraryActiveList.test.tsx`** — rewrite "carries no action-row control
  and no library mark" to assert no removal control anywhere in either view
  (AC 1). Delete "offers removal as one activation", "moves focus to the chip
  that took the freed slot", "focuses the results container when the last row
  goes", and "invalidates the recommendations grid when a show leaves My Shows"
  (re-homed above). Rewrite "keeps the poster's rating badge announced, and
  its control working" to the badge alone.
* **`viewParity.test.tsx`** — the Active-self case drops `"add/remove control"`
  and its comment says why.
* **`MyShowsToggle.test.tsx`** (new) — tracked: click opens the dialog, Cancel
  sends nothing, Confirm calls `DELETE`; untracked: click adds with no dialog;
  loading state unchanged.
* **`SearchOverlay.test.tsx`**, **`ShowList.test.tsx`**, **`ShowCard.test.tsx`**,
  **`push/PushNudgeCard.test.tsx`** — wherever a test clicks a "Remove … from
  My Shows" button and expects a removal, it confirms through the dialog;
  where it only asserts the button exists, nothing changes.
* **`api/markInvalidation.test.tsx`** drives `useRemoveShow` directly and is
  unchanged.

## 7. Documentation

* `MyShowsButton` — the rule in §3.2 replaces the NEU-1187 paragraphs.
* `MyShowsToggle` — gains a docstring saying it is the only removal path from
  the viewer's own Active tab and why it confirms.
* `MyShowCard`, `LibraryActiveList` (`ActiveRow`) — per §3.1.
* `.claude/CLAUDE.md` — the bullet beginning **"One add/remove control, and its
  *position* is what says whether adding is possible (NEU-1187)"** is rewritten
  to the §3.2 rule, keeping the `RemoveWatchHistoryButton` half (that control
  still takes the corner, still confirms, still uses `Trash2`). The preceding
  bullet's mention of `MyShowCard`'s `removable` + `onRemoved` seam is trimmed
  to `historyRemovable`.
* `CONTEXT.md` — unchanged; no term moved.

## 8. Out of scope

Guarding the Watched tab's watch-history chip beyond the dialog it has (§3.4).
An undo for removal (D2). Converging `MyShowsToggle` onto `MyShowsButton`
(D5). Restoring `muted` / `hide_from_activity` / `added_at` on re-add, which
is a backend change and unreported.

## 9. Risk to verify in the browser at 375 px

The Active grid card with an empty corner and the mute row beneath it, to
confirm nothing reflowed. The dialog opened from a search **list** row at 375
px, since that is the narrowest place it now appears and its description is
the longest copy the component has carried.
