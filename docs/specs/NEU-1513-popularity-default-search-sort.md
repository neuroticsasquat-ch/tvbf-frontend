# NEU-1513 — Popularity is the default search sort (frontend half)

**Ticket:** [NEU-1513](https://linear.app/neuroticsasquatch/issue/NEU-1513/add-popularity-if-available-as-default-show-search-sort-option)
**Repo:** `tvbf-frontend` — branch `tom/neu-1513-add-popularity-if-available-as-default-show-search-sort` from `main`
**Project:** tvbf: Maintenance
**Other half:** `tvbf-backend/docs/specs/NEU-1513-popularity-sort.md` (the `popularity` / `-popularity` sort keys, the index, and the people order). **This half depends on that one**: until the API accepts `sort=-popularity` it answers 422, so merge the backend PR first. The people-order change needs nothing from this repo — the overlay renders people in whatever order `/people` returns.
**Precedents this consumes:** `src/components/SearchOverlay.tsx` (`SEARCH_SORTS`, the `usePersistedSort("search", …)` call), `src/hooks/usePersistedSort.ts` (validated localStorage; `.claude/CLAUDE.md` §"Sort + filter state is persisted"), `docs/specs/NEU-1502-search-running-indicator.md` §2 (what the overlay owns)
**Glossary:** `tvbf-backend/CONTEXT.md` — **Popularity**: use that word; the glossary reserves "popular" for the friend-scoped list and "trending" for TMDB's weekly ranking, so neither may appear on this control.
**Status:** approved for implementation

---

## 1. What this is

Search's show results default to **Popularity** instead of Last Aired, and
Popularity is offered in the sort menu. Nothing else about the overlay
changes: the four existing options stay, the toolbar stays, the people section
gains no control.

Why the default moves: the ticket's premise, verified on the full catalog
in the backend half, is that a viewer typing a title is almost always looking
for the well-known one. By last aired, `office` leads with *Front Office
Sports Tonight* and a podcast about The Office; by popularity it leads with
*The Office*.

## 2. Decisions

### 2.1 The option

Extend the `SortKey` union and `ALL_SORT_KEYS` in `src/api/types.ts` with
`"popularity"` and `"-popularity"`, mirroring the API's pairing convention
(every key both ways). `SEARCH_SORTS` gains **one** entry, first in the list
because it is the default:

```ts
const SEARCH_SORTS: { key: SortKey; label: string }[] = [
  { key: "-popularity", label: "Popularity" },
  { key: "-last_aired", label: "Last Aired" },
  { key: "premiered", label: "Premiered First" },
  { key: "-premiered", label: "Premiered Last" },
  { key: "name", label: "Show Title" },
];
```

Ascending popularity is not offered: no viewer wants the least-known match
first, and Last Aired already sets the precedent of a one-direction option.

The label is **"Popularity"**, not "Most Popular" or "Popular": the glossary
reserves "popular" for Popular with friends, which can sit on screen beside
this control, and the sort is TMDB's score, not a friend-scoped list. The
toolbar's accessible name therefore reads `Sort Shows (current: Popularity)`.

### 2.2 Everyone lands on the new default once

The sort is persisted through `usePersistedSort("search", SEARCH_SORT_KEYS,
"-last_aired")`. Anyone who has ever opened search has `-last_aired` stored
under `tvbf:sort:search`, so changing the fallback alone would reach only
brand-new browsers. Decided: **rename the page key** so the stored value no
longer applies —

```ts
usePersistedSort<SortKey>("search-sort-v2", SEARCH_SORT_KEYS, "-popularity")
```

— and every viewer starts on Popularity once. A viewer who re-picks Last
Aired keeps it from then on, exactly as today. The old `tvbf:sort:search` key
is left in place, not deleted: it is inert, and a cleanup would be more code
than the feature.

Rejected: rewriting a stored `-last_aired` to `-popularity` in the hook. It
cannot tell the old default from a deliberate pick, and it would put a
one-off migration into a hook five other surfaces share.

The hook's validation already handles the other direction: a stored
`-popularity` on a browser that later loads an older build falls back to
that build's default. No change to `usePersistedSort`.

### 2.3 Nothing else moves

- The status and genre filters, their persisted keys, the view toggle, the
  `resetKey`, the debounce, the busy indicator and keep-previous-results from
  NEU-1502: untouched.
- The people section renders `/people` in server order, as it always has;
  its new order arrives with the backend PR and needs no code here.
- `toolbarOrder.test.tsx`'s invariant (exactly one sort control, ahead of the
  filters) holds without edits.

## 3. Acceptance criteria

Vitest, `SearchOverlay.test.tsx` and `types`:

- With empty localStorage, the overlay's first `/shows` request carries
  `sort=-popularity` (assert on the mocked fetch's URL, the way the suite
  already inspects requests).
- The sort menu lists Popularity first and the existing four after it, and
  the trigger's accessible name is `Sort Shows (current: Popularity)` on
  first render.
- Choosing Last Aired sends `sort=-last_aired`, and the choice survives a
  remount (persisted under `tvbf:sort:search-sort-v2`).
- A pre-seeded `tvbf:sort:search` = `-last_aired` (the old key) is ignored:
  the overlay still starts on Popularity. One test, because this is the whole
  point of §2.2 and the one thing a future "tidy the key names" edit could
  silently undo.
- `ALL_SORT_KEYS` includes both new keys; `tsc` passes with the widened
  union (`fe:typecheck`).
- `pnpm lint`, `pnpm test`, `pnpm build` green.

## 4. Docs this changes

- `.claude/CLAUDE.md` module map line for `SearchOverlay.tsx` (~107): note
  the default is Popularity and the persisted key is `search-sort-v2`. The
  "Sort + filter state is persisted" paragraph (~136) gains one sentence:
  *renaming a page key is the sanctioned way to reset everyone's choice when
  a default changes (NEU-1513).*
- `README.md` if it describes the search sort options.

## 5. Out of scope

- Showing the popularity number on a card, or any new field on the show or
  person payloads.
- A people sort control, or any people-section change.
- Reordering, relabelling or removing the four existing options.
- A sort on any other surface (My Shows, Watch Next, Upcoming, Library sort
  client-side over `/me` lists that do not carry popularity).
