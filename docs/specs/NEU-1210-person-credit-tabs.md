# NEU-1210 — Person credits into tabs in the same space

**Ticket:** [NEU-1210](https://linear.app/neuroticsasquatch/issue/NEU-1210/on-person-page-place-cast-guest-appearances-crew-and-episode-crew-into)
**Repo:** `tvbf-frontend`
**Project:** tvbf: Maintenance
**Blocked by:** —
**Related:** —
**Precedent consumed:** NEU-1209 (merged, PR #231 / commit `c29d350`) — its spec
`docs/specs/NEU-1209-episode-guest-cast-crew-tabs.md` and shipped code
`src/pages/EpisodePage.tsx`, itself consuming `src/pages/ShowDetailPage.tsx` (the
Tabs pattern: `Tabs`/`TabsTrigger`/`TabsContent`, `?tab=` URL sync, `disabled`-when-empty,
errored-stays-enabled, page-fetches-for-counts) and its test `src/pages/ShowDetailPage.test.tsx`
**Status:** approved for implementation

This spec lives in this repo's `docs/specs/` because nothing in another repo cites
it: it is entirely a `tvbf-frontend` change consuming a contract that already
exists (CLAUDE.md's cross-repo-citation rule). `usePersonCredits`
(`src/api/people.ts:42`) and the `PersonCredits` DTO (`src/api/types.ts`) are
unchanged by this ticket.

---

## 1. What this is

The person page (`src/pages/PersonPage.tsx`) renders the four credit kinds —
**Cast**, **Crew**, **Guest appearances**, **Episode crew** — as four **stacked
sections** in `Credits` (`PersonPage.tsx:343-411`):

```tsx
<CreditSection id="cast" title="Cast" items={castGroups} creditCount={data.cast.length} ... />
<CreditSection id="crew" title="Crew" items={crewGroups} creditCount={data.crew.length} ... />
<CreditSection id="guest" title="Guest appearances" items={guestGroups} creditCount={data.guest_cast.length} ... />
<CreditSection id="episode-crew" title="Episode crew" items={episodeCrewGroups} creditCount={data.episode_crew.length} ... />
```

NEU-1210 moves them into a tabbed region that occupies the same space — one
visible panel at a time — so a long guest list (Zachary Levi is 11 cast / 0
crew / 61 guest) no longer pushes the other three sections (and the footer)
down, and vice versa.

The sibling episode page already does this for two credits (NEU-1209), and the
show page for four categories (seasons/cast/crew/similar). This ticket lands the
same pattern on the person page with **four tabs**, and with **one architectural
difference that drives every decision below**: both precedents fetch
**separate per-category queries** (the page fetches for counts/empty/gate; the
components re-run the same queries, deduped by React Query → free). The person
page fetches **one** `usePersonCredits` query returning all four arrays at
once. There is no partial resolution, no per-tab in-flight state, and no per-tab
error — pending, error and success are unified across all four categories.

## 2. What is established before any decision below

**2.1 The four kinds are distinct and stay distinct.** `PersonPage.tsx:393-397`
keeps Episode crew as its own section rather than merged into Crew, citing
ADR-0003 — a standing production role (`crew credit`) is a different thing from
one night's directing (`episode crew credit`), and the glossary holds the two
terms apart. Tabs preserve the distinction, not merge it; no domain vocabulary
changes in this ticket.

**2.2 `CreditSection` already does the right thing per-panel.** It renders a
`<section aria-labelledby>` with a visible `<h2 id>(creditCount)</h2>`, returns
`null` when `items.length === 0` (an empty header reads as a broken section, not
an absent one — `PersonPage.tsx:125-127`), collapses to `COLLAPSED_COUNT = 12`
groups behind a "Show all N shows" toggle (`PersonPage.tsx:144-155`), and holds
the expanded state in local `useState`. None of that changes in form; only its
*container* changes from a stacked `<div className="space-y-8">` to a
`<TabsContent>` per kind.

**2.3 The Tabs primitive is already imported and styled.** `ui/tabs.tsx`
(Radix) is in use on both precedents. `TabsList` is `inline-flex` with **no
`flex-wrap`** and each `TabsTrigger` is `whitespace-nowrap` (`ui/tabs.tsx:17`,
`ui/tabs.tsx:32`): the strip **overflows rather than wraps**. This is load-bearing
for §3.5.

**2.4 `TabCount` is a one-line local component, twice.** `ShowDetailPage.tsx:328`
holds copy 1; `EpisodePage.tsx:275` holds copy 2. NEU-1209's D7 deliberately
kept it local, recording that this repo extracts at the **third** copy (NEU-1057's
three library marks, NEU-1176's two, NEU-1193 extracted at the third). Whether
NEU-1210 adds a third copy is decided in §4 D8 — and the answer is **no**, for a
reason that did not exist when Q8 was first framed.

**2.5 `PersonPage.test.tsx` is the test that must flip.** It queries by
`heading` and `region` (`PersonPage.test.tsx:39-65`, `:129-167`, `:280-520`),
asserts counts on those headings (`"Cast (2)"`, `"Guest appearances (2)"`), and
asserts empty sections **vanish** (`:156-167` "hides sections that are empty",
`:95-105` "hides the episode crew section for a person who has none"). Radix
**unmounts inactive `TabsContent`**, so only the active panel's
`<section>`/`<h2>` are in the DOM at once — those queries stop resolving as
written. §6 spells out the new assertions; the "hides empty" test flips to
"disabled tab" (D4).

**2.6 No `blockedBy` or related tickets, no project-wide spec.** NEU-1210
carries no relations and the "tvbf: Maintenance" project has an empty
description; the only merged dependency to honour is NEU-1209's shipped code and
spec.

## 3. What to build

### 3.1 Error, pending and all-empty stay whole-region (D1, D2, D3)

One query means one pending state, one error state, one success state. Keep the
existing `Credits` branches unchanged in shape:

```tsx
function Credits({ personId }: { personId: number }) {
  const { data, isPending, isError, error, refetch } = usePersonCredits(personId);

  if (isPending) return <LoadingState rows={1} />;
  if (isError) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  const total =
    data.cast.length + data.crew.length + data.guest_cast.length + data.episode_crew.length;
  if (total === 0) return <p className="text-sm text-muted-foreground">No credits yet.</p>;

  // … tabs (§3.2–§3.5)
}
```

There is **no per-tab `ErrorState`** — a failed credits query means all four
categories are unavailable, and the whole-region `ErrorState` with retry is the
honest rendering. This is a deliberate, recorded departure from the precedents'
per-tab error; the reason is the single query (D1).

### 3.2 The tab strip, with Cast default and URL sync (D4, D5, D6)

```tsx
const castGroups = groupByShow(data.cast);
const crewGroups = groupByShow(data.crew);
const guestGroups = groupByShow(data.guest_cast);
const episodeCrewGroups = groupByShow(data.episode_crew);

const castEmpty = data.cast.length === 0;
const crewEmpty = data.crew.length === 0;
const guestEmpty = data.guest_cast.length === 0;
const episodeCrewEmpty = data.episode_crew.length === 0;

const [searchParams, setSearchParams] = useSearchParams();
const requested = searchParams.get("tab");
const known = requested === "cast" || requested === "crew" || requested === "guest" || requested === "episode-crew";
// Cast is the default, so it stays out of the URL. An empty requested *or*
// default tab falls back to the first populated tab in order — one rule covers
// both, because Cast is first in order and its own fallback is first-populated.
// The region only renders when total > 0 (§3.1), so this always resolves.
const order = ["cast", "crew", "guest", "episode-crew"] as const;
const empties: Record<string, boolean> = {
  cast: castEmpty, crew: crewEmpty, guest: guestEmpty, "episode-crew": episodeCrewEmpty,
};
const wanted = known ? requested : "cast";
const firstPopulated = order.find((t) => !empties[t]) ?? "cast";
const tab =
  empties[wanted] ? firstPopulated : wanted;

function selectTab(next: string) {
  const params = new URLSearchParams(searchParams);
  if (next === "cast") params.delete("tab"); // cast is the default
  else params.set("tab", next);
  setSearchParams(params, { replace: true }); // tab switches don't stack history
}
```

This mirrors `EpisodePage.tsx:101-115` and `ShowDetailPage.tsx:69-91` in shape,
generalising NEU-1209's "fall back to the other tab" to "fall back to the first
populated tab in order" (D5).

### 3.3 The region

```tsx
<Tabs value={tab} onValueChange={selectTab}>
  <TabsList className="w-full justify-start overflow-x-auto">
    <TabsTrigger value="cast" disabled={castEmpty}>Cast</TabsTrigger>
    <TabsTrigger value="crew" disabled={crewEmpty}>Crew</TabsTrigger>
    <TabsTrigger value="guest" disabled={guestEmpty}>Guest</TabsTrigger>
    <TabsTrigger value="episode-crew" disabled={episodeCrewEmpty}>Ep. crew</TabsTrigger>
  </TabsList>
  <TabsContent value="cast">
    <CreditSection id="cast" title="Cast" items={castGroups} creditCount={data.cast.length} keyOf={(g) => g.show.id} renderItem={...} />
  </TabsContent>
  <TabsContent value="crew">
    <CreditSection id="crew" title="Crew" items={crewGroups} creditCount={data.crew.length} keyOf={(g) => g.show.id} renderItem={...} />
  </TabsContent>
  <TabsContent value="guest">
    <CreditSection id="guest" title="Guest appearances" items={guestGroups} creditCount={data.guest_cast.length} keyOf={(g) => g.show.id} renderItem={...} />
  </TabsContent>
  <TabsContent value="episode-crew">
    <CreditSection id="episode-crew" title="Episode crew" items={episodeCrewGroups} creditCount={data.episode_crew.length} keyOf={(g) => g.show.id} renderItem={...} />
  </TabsContent>
</Tabs>
```

Tab `value` strings are `"cast"`, `"crew"`, `"guest"`, `"episode-crew"` —
byte-identical to the existing `CreditSection` `id`s (D6). `"crew"` shares both
precedents' vocabulary.

### 3.4 No counts in tabs; headings stay visible (D7, D9)

The tab labels carry **no count**: `Cast` / `Crew` / `Guest` / `Ep. crew`. The
`CreditSection` headings **stay visible** — `headingHidden` is **not** added or
passed, so each open panel renders its `<h2 id>(creditCount)</h2>` as before:
`Cast (2)`, `Crew (1)`, `Guest appearances (2)`, `Episode crew (3)`.

This is the one justified departure from NEU-1209's `headingHidden`-on-everything
pattern, and it is forced by the no-counts-in-tabs choice: with the count gone
from the tab, the in-panel heading is the only place a sighted user sees the
size of a filmography, and `PersonPage.tsx:109-110` calls that number
load-bearing ("the number states the size of someone's filmography"). NEU-1209
made the heading `sr-only` because *"the tab label already carries title +
count"* (NEU-1209 §3.3); that premise no longer holds, so the conclusion does
not either. The tab is terse for width; the heading carries the full term plus
the count the tab dropped (D9).

`CreditSection` is **unchanged** — it has no `headingHidden` prop today, gains
none, keeps its visible heading, keeps its `null`-when-empty branch (which is now
moot for reachable panels, since a disabled tab can't be opened, but stays
correct if a future caller renders a `CreditSection` outside tabs).

### 3.5 Short labels + a scroll safety-net at 375 px (D9, D10)

`TabsList` does not wrap (`§2.3`). Four triggers each carry `px-3` (48 px
padding) plus `whitespace-nowrap` text. Even with the short labels below, four
tabs with any text overflow a 375 px viewport, so the strip **scrolls
horizontally as a last resort** via a per-page `className` on this page's
`TabsList` only — `w-full justify-start overflow-x-auto` — leaving the shared
`ui/tabs.tsx` and both precedents untouched.

Labels:

- **Cast** (unchanged, 4 chars)
- **Crew** (unchanged, 4 chars)
- **Guest** ← "Guest appearances" (matches the section id `"guest"`; unambiguous for a person's filmography)
- **Ep. crew** ← "Episode crew" (keeps the `crew` noun, `Ep.` marks the episode origin and distinguishes from `Crew` — the `crew credit` vs `episode crew credit` split ADR-0003 keeps)

The `sr-only` path is **not** taken, so the full terms ("Guest appearances",
"Episode crew") survive visibly in the panel headings — the tab is the only
place width binds, so only it is terse (D9).

### 3.6 What deliberately does not change

- **`usePersonCredits`** — one query, one payload. Not split into four.
- **`CreditSection`** — no new prop. Visible heading, `null`-when-empty,
  collapse toggle, local `useState` all unchanged.
- **`personCredits.ts`** (`groupByShow`, `collapseByEpisode`, `distinctLabels`,
  `characterLabel`) — pure helpers, untouched.
- **`ui/tabs.tsx`** — reused as-is; the `overflow-x-auto` is per-page, not
  shared.
- **`TabCount`** — **not extracted** (D8). Left as the two local copies in
  `ShowDetailPage` and `EpisodePage`.
- **The header, not-found, error-alert, headshot and dates-line rendering**
  (`PersonPage.tsx:416-455`) — unaffected; credits load separately from the
  header so a slow/failed fetch does not blank the person out.

## 4. Decisions

**D1 — Whole-region `ErrorState` (§3.1).** One query failing means all four
categories are unavailable. The alternative — splitting into four queries to
restore the precedents' per-tab error — is large churn against a backend that
serves the four kinds in one payload deliberately. The whole-region `ErrorState`
with retry is the honest rendering and matches the current `Credits` behaviour.
Recorded as the deliberate inverse of NEU-1209's per-tab error, for the reason
that makes them differ (one query, not four).

**D2 — `<LoadingState>` until the one query resolves (§3.1).** No partial data
means a strip with no counts would read as empty-not-loading. Mirrors NEU-1209's
"gate when in-flight," generalised to the whole region because the pending state
is whole-region too.

**D3 — Gate + "No credits yet." when `total === 0` (§3.1).** There is no
always-present tab on this page (Cast is empty for directors), and four disabled
tabs of nothing is noise the ticket does not ask for. The existing "No credits
yet." message stays — it is the tested, current behaviour for a real shape (a
person whose four arrays are all empty).

**D4 — Empty category → `disabled` tab, present in the strip (§3.2).** The
current behaviour is that an empty `CreditSection` *vanishes*. Tabs invert that:
the tab is present and `disabled`, with no count (D7). This is a behaviour
change — empty sections become visible disabled tabs — and it is the right one
for the same reason both precedents give ("absence is information"), plus a
width-stability reason of their own: a tab that appears and disappears as the
query resolves moves the other tabs under the reader's cursor
(`ShowDetailPage.tsx:62-67`). Since this page's counts arrive together (one
query), the pop-in concern is smaller than the precedents', but a stable strip
is still better than a mutating one, and "Guest (disabled)" is genuine
information about a person's filmography. The "hides sections that are empty"
test flips (§6).

**D5 — Cast default; first-populated fallback (§3.2).** Cast is the headliner
category for a person — the person is known for acting — and first in order.
Fallback to the **first populated tab in order** `[cast, crew, guest,
episode-crew]` is the clean generalisation of NEU-1209's "fall back to the other
tab": a director with only episode-crew credits falls back to Episode crew, a
crew-only technician to Crew. One rule covers the default-empty and the
requested-empty cases, because Cast is first in order and its own fallback is
first-populated. The region only renders when `total > 0` (D3), so the fallback
always resolves.

**D6 — Tab `value` strings `"cast"` / `"crew"` / `"guest"` / `"episode-crew"`
(§3.3).** Byte-identical to the existing `CreditSection` `id`s; `"crew"` shares
both precedents' vocabulary. `"guest"` is natural *on this page* — NEU-1209
avoided it only because `PersonPage` already used it as a region id, which is
exactly where it belongs here. `"episode-crew"` distinguishes from `"crew"` by
value while "Episode crew" distinguishes by label.

**D7 — No counts in the tab labels (§3.4).** The count moves to the in-panel
heading (D9). Dropping it from the tab shrinks the strip (necessary at 375 px,
§3.5) and lets the tab be a terse navigation label while the heading carries
the full term plus the size. This is a departure from both precedents, which
show `(N)` in the tab; the reason is width — four PersonPage labels do not fit
where the precedents' short single-word labels do.

**D8 — Do **not** extract `TabCount` (§3.6).** NEU-1209's D7 named the
third-copy threshold and pointed at this ticket. But D7 drops counts from the
tabs entirely, so `TabCount` is **not used** on the person page — it stays at
two copies (`ShowDetailPage`, `EpisodePage`), which is under the threshold. The
spec records this as the deliberate inverse of the first-framed Q8: D7's choice
removed the premise for extraction. If a fourth surface later re-introduces a
tab count, the threshold is reached then.

**D9 — Visible headings inside panels, not `sr-only` (§3.4, §3.5).** With the
count gone from the tab (D7), the in-panel `<h2>` is the only place a sighted
user sees the filmography size — load-bearing per `PersonPage.tsx:109-110`. So
`headingHidden` is **not** added to `CreditSection`, and each open panel keeps
its visible `Cast (2)` / `Episode crew (3)` heading. This is the one justified
departure from NEU-1209's `headingHidden`-on-everything pattern, and it is
forced by D7: NEU-1209 made the heading `sr-only` because the tab already carried
title + count; with no count on the tab, that premise fails and the heading
earns visibility by carrying what the tab dropped. The tab label is a terse
subset of the heading ("Ep. crew" vs "Episode crew (3)"); the heading is the
authoritative name + count, the tab is the navigation affordance. The full
glossary terms ("Guest appearances", "Episode crew") thus survive visibly
without a `sr-only` duplicate.

**D10 — Short labels + per-page scroll safety-net (§3.5).** The labels are
shortened to `Cast` / `Crew` / `Guest` / `Ep. crew` to minimise width, and the
strip gets `w-full justify-start overflow-x-auto` on this page's `TabsList`
only, so it scrolls horizontally **as a last resort** when all four tabs still
do not fit (narrow + all populated). `ui/tabs.tsx` is untouched, so both
precedents render exactly as before. `ShowDetailPage` is near the same 375 px
edge with its four single-word tabs; that is out of scope here and noted as a
follow-up risk.

**D11 — Accept collapse-state reset on tab switch (§3.6).** Radix unmounts an
inactive `TabsContent`, so each `CreditSection`'s local `useState(expanded)`
resets when the user switches away and back. NEU-1209 already accepted this for
`CastList`'s identical toggle. `forceMount`-ing all four panels would keep the
state but keep all four panels in the DOM — defeating the "one panel at a time"
the ticket exists for — and lifting expanded state to `Credits` or the URL is
over-engineering a browse affordance. The cost (re-expand after switching back)
is minor for a "Show all N shows" toggle.

## 5. Acceptance criteria

1. The four credit kinds render as four tabs in the same space — one visible
   panel at a time — replacing the four stacked sections.
2. A failed `usePersonCredits` request renders a whole-region `ErrorState` with
   retry (no tab strip); a pending request renders `<LoadingState>` (no tab
   strip); a successful `total === 0` renders "No credits yet." (no tab strip).
3. Cast is the default tab. When Cast is empty, the default is the first
   populated tab in order `[cast, crew, guest, episode-crew]`.
4. A resolved-empty category renders as a `disabled` tab (present in the strip,
   no count); a populated category renders as an enabled tab. The tab strip
   does not mutate width as the (single) query resolves.
5. `?tab=crew|guest|episode-crew` deep-links to that panel; `?tab=cast` and the
   absence of the param deep-link to Cast; an unknown value falls back to Cast;
   a requested tab that is empty falls back to the first populated tab in
   order. Switching tabs updates the URL with `replace` (no history stacking).
6. The tab labels are `Cast` / `Crew` / `Guest` / `Ep. crew` with **no count**.
   The open panel's `<h2>` is **visible** and carries the full term plus the
   count: `Cast (N)`, `Crew (N)`, `Guest appearances (N)`, `Episode crew (N)`.
7. The tab strip does not clip at 375 px: it scrolls horizontally when the four
   tabs do not fit, and no label is truncated.
8. `task lint`, `task typecheck` and `task test` pass (run from
   `tvbf-frontend/`).

## 6. Tests

Update **`src/pages/PersonPage.test.tsx`** in place. The existing header,
not-found, error-alert, headshot and dates-line tests stay unchanged. The
credit assertions change because Radix unmounts inactive `TabsContent` — only
the active panel's `<section>`/`<h2>` are in the DOM.

- **Region gate (AC 2):** a failed credits query renders the `alert` and no
  tab strip (the existing "surfaces a failed credits request" test keeps
  passing); a pending query renders the loading test-id and no tabs; an
  all-empty payload renders "No credits yet." and no tabs.
- **Four tabs present (AC 1):** with all four populated, four `tab` roles exist
  — `Cast`, `Crew`, `Guest`, `Ep. crew` — and no count on any of them.
- **Default tab (AC 3):** with Cast populated, `Cast` is `aria-selected="true"`
  on render and its panel's visible heading `Cast (2)` is present; with Cast
  empty and only episode-crew populated, `Ep. crew` is selected on render and
  `Episode crew (3)` is the visible heading.
- **Disabled-empty (AC 4):** with Cast empty, `screen.getByRole("tab", { name:
  "Cast" })` is `toBeDisabled()`; populated tabs are not disabled. No `(0)`
  appears anywhere (no counts in tabs; the disabled tab's panel is not
  reachable, so its heading is not in the DOM).
- **`?tab=` deep-linking + fallback (AC 5):** `?tab=guest` selects Guest;
  `?tab=cast` and no param select Cast; `?tab=nonsense` falls back to Cast;
  `?tab=episode-crew` against an empty episode-crew list falls back to the
  first populated tab; switching tabs updates the URL with `replace` (assert
  the history entry count does not grow, mirroring NEU-1209's test).
- **Visible headings with full term + count (AC 6):** switch to each populated
  tab and assert the visible heading — `Cast (2)`, `Crew (1)`,
  `Guest appearances (2)`, `Episode crew (3)` — and that the heading is **not**
  `sr-only` (it has a visible class, not `sr-only`). The tab's accessible name
  is the short label; the heading's is the full term + count.
- **Credit content (preserved from the existing suite):** the "keeps episode
  crew separate", "collapses two roles on one episode", "links cast and crew
  credits to the show", "renders guest credits with episode context",
  "collapses a long section", and the grouped-card accessibility block all
  switch to the relevant tab before scoping with `within`. Because only the
  active panel's `<section>` is mounted, `screen.getByRole("region", { name:
  /^Crew/ })` finds the active Crew panel and `/^Episode crew/` finds the active
  Episode crew panel — the regexes still disambiguate (one starts with "Episode").
- **"hides sections that are empty" flips (AC 4):** with `cast: []` and
  `guest_cast: []`, assert `Cast` and `Guest` tabs are `toBeDisabled()` and
  present in the strip (not absent headings); `Crew` is enabled and active.
- **"does not claim a director with only episode crew credits has no credits"
  (AC 2/3):** with only `episode_crew` populated, `total > 0` so "No credits
  yet." does not render; Cast is empty so the default falls back to `Ep. crew`,
  whose panel heading `Episode crew (3)` is visible on render.
- **Scroll safety-net (AC 7):** at a 375 px viewport with all four populated,
  the `TabsList` is horizontally scrollable and no `TabsTrigger` label is
  clipped (assert the strip's `scrollWidth` exceeds its `clientWidth` and each
  tab's text is fully visible, mirroring the kind of width assertion the
  episode page's spec called out as a browser check — here made a jsdom check
  where feasible, else a manual step in §8).

Existing tests that must keep passing unchanged: the header, not-found,
non-numeric-id, error-alert, headshot and dates-line tests. The MSW fixture
`fixturePersonCredits` (all four populated) and handlers need no change.

## 7. Out of scope

- **Splitting `usePersonCredits` into four queries** — D1. The single payload is
  a backend design choice; this ticket consumes it.
- **`TabCount` extraction** — D8. Stays at two copies; D7 dropped its use here.
- **Preserving collapse/expanded state across tab switches** — D11. A follow-up
  if the re-expand cost proves real for heavy guest lists.
- **`ShowDetailPage`'s 375 px edge** — D10. Its four single-word tabs are near
  the same overflow; out of scope here, noted as a follow-up.
- **Redesigning `CreditSection`'s layout** — it keeps its grid, its
  `null`-when-empty branch, its "Show all N shows" toggle. This ticket only
  moves it into a tab and drops the count from the tab.
- **The episode page's and show page's tab patterns** — unchanged; this ticket
  consumes them as precedents, not the other way around.
- **Domain vocabulary / CONTEXT.md / ADRs** — no new terms; the four credit
  kinds and their distinction (ADR-0003) already exist. No glossary or ADR file
  is created by this ticket.

## 8. Risk to verify in the browser at 375 px

The tab strip has never rendered on the person page. Worth one look at a person
with a long guest list (the case the ticket exists for — e.g. Zachary Levi's 61
guest credits): that the strip scrolls rather than clipping "Ep. crew", that the
active panel's grid stays within the viewport, and that switching tabs does not
shift the header or footer above/below the region. Also verify a director with
only episode-crew credits lands on `Ep. crew` by default (D5 fallback) and that
the visible `Episode crew (N)` heading renders with the full term + count.
