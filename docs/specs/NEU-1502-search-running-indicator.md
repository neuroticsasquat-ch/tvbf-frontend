# NEU-1502 — A "search is running" indicator, and results that stay put (frontend half)

**Ticket:** [NEU-1502](https://linear.app/neuroticsasquatch/issue/NEU-1502/speed-up-show-search)
**Repo:** `tvbf-frontend` — branch `tom/neu-1502-speed-up-show-search` from `main`
**Project:** tvbf: Maintenance
**Other half:** `tvbf-backend/docs/specs/NEU-1502-speed-up-show-search.md` (the query rewrite and stored last-aired date). The two halves are independent: this one ships against today's API unchanged and is not blocked by the backend PR.
**Precedents this consumes:** `docs/specs/NEU-1192-a-my-shows-control-on-search-results.md` §3.3 (the `["shows"]` optimistic flip and its `onSettled` refetch — the thing the indicator must *not* light on), `src/components/connections/FindPeople.tsx` (the nearest existing "Searching…" state), `src/hooks/useDebouncedValue.ts` (why the first keystroke is debounced), `docs/superpowers/specs/2026-04-19-frontend-mvp-design.md` §Loading ("skeletons, no spinners" — superseded for the search box only, below)
**Status:** approved for implementation

---

## 1. What this is

The ticket asks for "a visual indicator to the search box while search is
running". Today there is none: the header input (`AppShell.tsx`'s
`HeaderSearch`) shows nothing while a query is pending, and the only signal
that anything is happening is the results grid collapsing to skeletons — which
it does on *every* pause while typing, because `SearchOverlay` renders
`<LoadingState/>` whenever `showsQuery.isPending`, and each debounced query is
a new key with no placeholder.

Two changes, both in the SPA:

1. **A spinner in the search box**, lit for exactly the span the viewer would
   call "searching".
2. **The previous results stay on screen** until the next ones land, so the
   grid stops flashing to skeletons between keystrokes. With the spinner
   carrying the "these may be stale" signal, the skeleton no longer has to.

Together they are the perceived-speed half of the ticket; the backend half is
the actual speed.

## 2. What is established

- Search is an overlay, not a page. `HeaderSearch` is a controlled input in
  `AppShell.tsx` (lines ~421–465) whose value drives `overlayActive`; when the
  trimmed value is non-empty `<SearchOverlay search={searchInput}/>` replaces
  `<main><Outlet/></main>`. `/search?search=` also renders `SearchOverlay`
  (`SearchPage.tsx`) but nothing links to it.
- `SearchOverlay` owns the debounce (`useDebouncedValue(trimmed, 250, "")`) and
  both queries: `useShows({search, status, genre, sort, page, per_page: 50},
  {enabled})` and `usePersonSearch(query, {page, per_page: 24, enabled})`, both
  with `staleTime` 5 min, both passing React Query's `signal` so a superseded
  request is aborted. `SearchOverlay` is the **only** caller of both hooks.
- No `placeholderData` / `keepPreviousData` anywhere in the repo. No
  `animate-spin`, `Loader2`, `useIsFetching`, `useTransition`. Stack is
  Tailwind v4 + shadcn primitives + lucide-react; TanStack Query v5.
- Result cards make no per-card requests (`in_my_shows`, `my_rating` and the
  badges come in the `/shows` payload). But an add/remove from a card runs
  NEU-1192's `invalidateAll` in `onSettled`, which **refetches every cached
  `["shows"]` page** — so `isFetching` on the shows query goes true after an
  add/remove without the query having changed.

## 3. Decisions

### 3.1 "Searching" is: keystroke → both sections settled for that query

The indicator is lit from the keystroke that changes the trimmed query until
**both** the shows and the people responses *for that query* have settled
(data or error). Concretely, inside `SearchOverlay`:

```ts
const busy =
  trimmed !== query ||                                  // the 250 ms debounce window
  showsQuery.isPending  || showsQuery.isPlaceholderData ||
  peopleQuery.isPending || peopleQuery.isPlaceholderData;
```

Why these terms and not `isFetching`:

- `trimmed !== query` covers the debounce. Without it there is an invisible
  250 ms gap after typing, which is precisely the gap a "running" indicator
  exists to fill.
- `isPending` is the first query ever (no data, no placeholder).
- `isPlaceholderData` is "the data on screen belongs to an older key" — which,
  once §3.3 lands, is every subsequent query and every page change. A page
  change lighting the spinner is correct: that search *is* running.
- `isFetching` alone is **rejected**: it also goes true during NEU-1192's
  post-add/remove refetch, when nothing the viewer typed is running. That
  refetch has `isPlaceholderData === false` (same key), so the expression
  above stays dark for it — pin this with a test.

`useIsFetching({queryKey: ["shows"]})` in `HeaderSearch` was considered and
rejected for the same two reasons (no debounce coverage; lights on
invalidation).

### 3.2 The state is computed where it lives and reported upward

`SearchOverlay` owns the debounce and both queries, so it computes `busy` and
reports it through a new optional prop `onBusyChange?: (busy: boolean) =>
void`, called from an effect on `busy` and with `false` on unmount (the
overlay unmounts when the input empties; the spinner must not outlive it).
`AppShell` holds `searchBusy` state, passes the callback, and threads
`busy={searchBusy}` into `HeaderSearch`. `SearchPage` renders the overlay
without the callback; the header spinner is not wired on that unlinked route,
and the prop stays optional so that is not a type error.

Lifting the debounce into `AppShell` instead was considered: it would let the
header know the debounce window without a callback, but splits the query
lifecycle across two components and leaves `SearchPage` with a different
debounce story. One callback is the smaller seam.

### 3.3 Previous results stay until the next ones arrive

Add `placeholderData: keepPreviousData` (from `@tanstack/react-query`) to
`useShows` and `usePersonSearch`. Both hooks have one caller, so it belongs in
the hook, not in an option.

Consequences inside `SearchOverlay`, each of which is a required change:

- **Skeletons appear only for the first query** of a search session
  (`isPending`). Every later query keeps the last grid and swaps in place.
- **Section headings show the previous totals** until the swap. Accepted: the
  spinner says the numbers are in flight. Do not blank them.
- **`settled`** (the guard on the combined "No shows or people match" line)
  must also require `!isPlaceholderData` on both queries, or a stale non-empty
  grid could be replaced by "no results" a frame before the real answer.
- **Page changes** keep the previous page's cards under the spinner, which is
  the same behaviour and needs no special case.
- **Errors** are unchanged: on error React Query drops the placeholder and
  `isError` renders `<ErrorState/>` as today.
- Focus does not move on the swap; results are plain links in document order
  (the overlay's docblock) and nothing here changes that.

### 3.4 How it is drawn

In `HeaderSearch`, a lucide `Loader2` with `animate-spin motion-reduce:animate-none`,
`h-4 w-4 text-muted-foreground`, absolutely positioned `right-2 top-1/2
-translate-y-1/2`, `aria-hidden`, rendered only while `busy`. The input's
right padding becomes `pr-7` **always**, not only while busy, so the text does
not shift when the spinner appears. The left `SearchIcon` stays: it is what
identifies the field, and swapping it was rejected for that reason.

Screen readers get the state from a visually-hidden `<span role="status"
aria-live="polite">` inside the form that reads `Searching…` while busy and is
empty otherwise. The results `<section role="region" aria-label="Search
results">` in `AppShell` gets `aria-busy={searchBusy}`.

This supersedes the MVP spec's "no spinners" rule **for the search box only**.
That rule's reasoning — grids have predictable dimensions, so skeletons hold
the layout — still holds for the grids, and §3.3 removes the one place a
skeleton was standing in for a progress signal. Nothing else in the app gains
a spinner from this ticket.

## 4. Tests (Vitest + Testing Library + MSW, `renderWithProviders`)

`SearchOverlay.test.tsx` (the `onBusyChange` prop makes these assertable
without the header):

- **Lit from the first keystroke, before the debounce fires**: render with a
  one-character query and assert `onBusyChange(true)` before any request has
  started (extend the existing debounced-first-keystroke test at ~257).
- **Dark only when both have settled**: with the People handler delayed (the
  pattern at ~243), busy stays `true` after shows render and flips `false`
  when people land.
- **Not lit by an add/remove refetch**: after both settle, click a card's My
  Shows control (the `describe.each` at ~179), let `invalidateAll` refetch, and
  assert `onBusyChange` was not called with `true` again.
- **Previous results remain during the next query**: type a second query with
  the shows handler delayed; the first query's cards are still in the document
  and no `[data-testid="loading"]` appears; on response, the new cards replace
  them.
- **`settled` respects placeholders**: a second query that returns empty shows
  the "No shows or people match" line only after its response, never while
  the first query's grid is still on screen.
- **`false` on unmount**.

`AppShell.test.tsx`: the header renders the spinner and the `Searching…`
status while the overlay reports busy, and neither once it reports idle; the
results region carries `aria-busy`.

`src/api/shows.test.tsx` (and a people equivalent if one exists): a key change
serves the previous key's data as placeholder (`isPlaceholderData === true`)
until the new response.

## 5. Docs this changes

`.claude/CLAUDE.md` / `AGENTS.md`: the module-map lines for `AppShell.tsx`
and `SearchOverlay.tsx` note the `onBusyChange` seam and that the two search
hooks keep previous data; one sentence under conventions that the search box is
the one sanctioned spinner and why (§3.4). No `CONTEXT.md` or ADR exists in
this repo and none is created.

## 6. Out of scope

- Any change to what is searched or how results rank — backend half.
- A minimum query length or a longer debounce (the backend makes short queries
  cheap; the debounce value is untouched).
- Wiring the indicator on the unlinked `/search` route.
- Spinners anywhere else, including the People section's own pending state,
  which keeps rendering nothing until it settles.
