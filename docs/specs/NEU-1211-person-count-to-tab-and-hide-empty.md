# NEU-1211 — Move the count into the person-page tab, and hide empty tabs

**Ticket:** [NEU-1211](https://linear.app/neuroticsasquatch/issue/NEU-1211/on-person-page-move-count-to-tab-and-hide-tabs-with-no-content)
**Repo:** `tvbf-frontend`
**Project:** tvbf: Maintenance
**Blocked by:** —
**Related:** —
**Precedent consumed:** NEU-1210 (merged, PR #232 / commit `e827945`) — its spec
`docs/specs/NEU-1210-person-credit-tabs.md` and shipped code `src/pages/PersonPage.tsx`,
itself consuming NEU-1209 (`src/pages/EpisodePage.tsx`) and the original
`src/pages/ShowDetailPage.tsx` Tabs pattern (`Tabs`/`TabsTrigger`/`TabsContent`, `?tab=`
URL sync, `TabCount`, disabled-when-empty, `headingHidden`, page-fetches-for-counts) and
its test `src/pages/ShowDetailPage.test.tsx`
**Status:** approved for implementation

This spec lives in this repo's `docs/specs/` because nothing in another repo cites
it: it is entirely a `tvbf-frontend` change consuming a contract that already
exists (CLAUDE.md's cross-repo-citation rule). `usePersonCredits`
(`src/api/people.ts`) and the `PersonCredits` DTO (`src/api/types.ts`) are
unchanged by this ticket.

---

## 1. What this is

NEU-1210 moved the person page's four credit kinds — **Cast**, **Crew**, **Guest
appearances**, **Episode crew** — from four stacked sections into four tabs in
the same space, and made two deliberate departures from its siblings:

- **D7 — no count in the tab.** The tab read bare `Cast` / `Crew` / `Guest` /
  `Ep. crew`; the in-panel `<h2>` stayed **visible** carrying `Cast (2)` (D9).
- **D4 — empty category → `disabled` tab, present in the strip.** An empty Cast
  rendered as a disabled `Cast` tab with no count, mirroring both siblings'
  "absence is information" + "a fixed strip beats one that pops in."

NEU-1211 reverses both: the count moves back **into** the tab, and a category
with no content is **hidden** (omitted from the strip entirely). The ticket
title is the whole description — "move count to tab and hide tabs with no
content" — and this spec records *why* that is the right reading here and not on
the sibling pages, in the decisions the precedents already named.

The hinge is the one structural fact that has set the person page apart from
both siblings since NEU-1210: it issues **one** `usePersonCredits` query
returning all four arrays at once. The siblings issue **per-category** queries
that resolve independently, which is exactly why they keep empty tabs *present*
(a tab appearing/disappearing as its own query resolves moves the other tabs
under the reader's cursor; the always-present strip is the fix). On the person
page all four counts arrive together, so the strip renders fully-formed or not
at all — **no async pop-in, no width-jitter**. NEU-1210's D4 already conceded
"the pop-in concern is smaller than the precedents'"; NEU-1211 removes the
concession and acts on it.

## 2. What is established before any decision below

**2.1 NEU-1210 shipped, and its `firstPopulated` machinery is already in place.**
`PersonPage.tsx:349-358` computes `order = ["cast","crew","guest","episode-crew"]`,
an `empties` map, `wanted`, and `firstPopulated = order.find((t) => !empties[t])`,
then `tab = empties[wanted] ? firstPopulated : wanted`. This was built so an
empty Cast would fall back to the first populated tab. Under NEU-1211's hide,
that same expression is the default-tab rule: an empty/hidden requested tab and
an empty default both resolve to `firstPopulated`. The change this ticket makes
to that block is **conceptual** (Cast stops being special; `firstPopulated` runs
the show) — the code barely moves.

**2.2 `TabCount` is a one-line local component, twice, and this ticket is its
third copy.** `ShowDetailPage.tsx:328` holds copy 1; `EpisodePage.tsx:275` holds
copy 2. Both are byte-identical: `<span className="font-normal
text-muted-foreground">({value})</span>` under the docstring *"The count beside
a tab label. Muted so the label stays the thing you read."* NEU-1210's D8
deliberately did **not** add a third copy (it dropped counts from the person
tabs entirely) and pre-flagged this surface as the trigger: *"If a fourth
surface later re-introduces a tab count, the threshold is reached then."*
NEU-1211 *is* that surface. This repo's convention (AGENTS.md: extract at the
**third** copy — NEU-1057's three library marks, NEU-1176's two, NEU-1193
extracted `useFocusAfterRemoval` at the third) says extract now.

**2.3 `CreditSection` has no `headingHidden` prop.** NEU-1210's §3.6/D9
deliberately added none, keeping the in-panel `<h2>` visible because — with the
count gone from the tab — it was the only place a sighted user saw the
filmography size. Both siblings instead make the heading `sr-only` via a
`headingHidden` prop (`CastList.tsx:27`, `EpisodeCrew`'s inline `<h2>`), because
their tab carries title + count. NEU-1211 moves the count back into the tab, so
the premise for "visible heading" fails and the siblings' `sr-only` pattern
returns.

**2.4 `PersonPage.test.tsx` is the test that must flip.** Its tab assertions
encode NEU-1210's two departures directly: L66-67 *"tabs carry no counts; the
in-panel heading carries the full term + count"* and L91-109 *"marks empty
categories as disabled tabs"* with an explicit `queryByRole("tab", { name:
/\(0\)/ })` guard. Both invert under NEU-1211. The grouping/accessibility block
(L205-636) scopes with `within(screen.getByRole("region", { name: /^Crew/ }))`
etc., which resolve via the heading's `id` on `aria-labelledby` — that still
works when the heading is `sr-only` (the node and its `id` stay in the DOM), so
those tests keep working unchanged. §6 spells out the flip.

**2.5 No `blockedBy` or related tickets, no project-wide spec.** NEU-1211
carries no relations and the "tvbf: Maintenance" project has an empty
description; the only merged dependency to honour is NEU-1210's shipped code and
spec, and through it NEU-1209 and `ShowDetailPage`.

**2.6 The single query makes the strip's `isSuccess`-gating unnecessary here.**
Both siblings gate the count on `crewQuery.isSuccess && <TabCount …/>` because
their always-present tabs render during per-category in-flight state and an
in-flight tab must show no count. The person page's strip only renders after
the one `usePersonCredits` query resolves (we are past the `isPending` gate at
`PersonPage.tsx:319`), so `data.cast.length` is always a real number when the
strip is in the DOM. No `isSuccess` guard is needed — a simplification the
single query buys and that D2 records.

## 3. What to build

### 3.1 Extract `TabCount` (D4)

Create `src/components/TabCount.tsx`:

```tsx
/** The count beside a tab label. Muted so the label stays the thing you read. */
export function TabCount({ value }: { value: number }) {
  return <span className="font-normal text-muted-foreground">({value})</span>;
}
```

Replace the local copies in `ShowDetailPage.tsx:328` and `EpisodePage.tsx:275`
with `import { TabCount } from "@/components/TabCount";` (the `@/components`
alias both files already use). The three call-site expressions are unchanged:
`<TabCount value={show.seasons.length} />`, `castQuery.isSuccess &&
<TabCount value={castCount} />`, etc. — only the definition moves.

### 3.2 The region: hide empty, count in tab, sr-only heading (D1, D2, D3, D5)

```tsx
function Credits({ personId }: { personId: number }) {
  const { data, isPending, isError, error, refetch } = usePersonCredits(personId);
  const [searchParams, setSearchParams] = useSearchParams();

  if (isPending) return <LoadingState rows={1} />;
  if (isError) return <ErrorState message={error.message} onRetry={() => refetch()} />;

  const total =
    data.cast.length + data.crew.length + data.guest_cast.length + data.episode_crew.length;
  if (total === 0) return <p className="text-sm text-muted-foreground">No credits yet.</p>;

  const castGroups = groupByShow(data.cast);
  const crewGroups = groupByShow(data.crew);
  const guestGroups = groupByShow(data.guest_cast);
  const episodeCrewGroups = groupByShow(data.episode_crew);

  const castEmpty = data.cast.length === 0;
  const crewEmpty = data.crew.length === 0;
  const guestEmpty = data.guest_cast.length === 0;
  const episodeCrewEmpty = data.episode_crew.length === 0;

  const requested = searchParams.get("tab");
  const known =
    requested === "cast" || requested === "crew" ||
    requested === "guest" || requested === "episode-crew";
  const order = ["cast", "crew", "guest", "episode-crew"] as const;
  const empties: Record<string, boolean> = {
    cast: castEmpty, crew: crewEmpty, guest: guestEmpty, "episode-crew": episodeCrewEmpty,
  };
  // The default is "first populated tab in order." Cast is first in order, so
  // when it is populated this still resolves to Cast; the expression reads the
  // same as NEU-1210's, but Cast is no longer special — `firstPopulated` is the
  // rule for both the no-param default and the `?tab=<empty/hidden>` fallback,
  // because an empty category is now a hidden one.
  const wanted = known ? requested : order[0];
  const firstPopulated = order.find((t) => !empties[t]) ?? order[0];
  const tab = empties[wanted] ? firstPopulated : wanted;

  function selectTab(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next === "cast") params.delete("tab"); // cast stays the URL-absent default
    else params.set("tab", next);
    setSearchParams(params, { replace: true }); // tab switches don't stack history
  }

  return (
    <Tabs value={tab} onValueChange={selectTab}>
      <TabsList className="w-full justify-start overflow-x-auto">
        {!castEmpty && (
          <TabsTrigger value="cast">
            Cast <TabCount value={data.cast.length} />
          </TabsTrigger>
        )}
        {!crewEmpty && (
          <TabsTrigger value="crew">
            Crew <TabCount value={data.crew.length} />
          </TabsTrigger>
        )}
        {!guestEmpty && (
          <TabsTrigger value="guest">
            Guest <TabCount value={data.guest_cast.length} />
          </TabsTrigger>
        )}
        {!episodeCrewEmpty && (
          <TabsTrigger value="episode-crew">
            Ep. crew <TabCount value={data.episode_crew.length} />
          </TabsTrigger>
        )}
      </TabsList>
      {!castEmpty && (
        <TabsContent value="cast">
          <CreditSection id="cast" title="Cast" headingHidden items={castGroups} creditCount={data.cast.length} keyOf={(g) => g.show.id} renderItem={...} />
        </TabsContent>
      )}
      {!crewEmpty && (
        <TabsContent value="crew">
          <CreditSection id="crew" title="Crew" headingHidden items={crewGroups} creditCount={data.crew.length} keyOf={(g) => g.show.id} renderItem={...} />
        </TabsContent>
      )}
      {!guestEmpty && (
        <TabsContent value="guest">
          <CreditSection id="guest" title="Guest appearances" headingHidden items={guestGroups} creditCount={data.guest_cast.length} keyOf={(g) => g.show.id} renderItem={...} />
        </TabsContent>
      )}
      {!episodeCrewEmpty && (
        <TabsContent value="episode-crew">
          <CreditSection id="episode-crew" title="Episode crew" headingHidden items={episodeCrewGroups} creditCount={data.episode_crew.length} keyOf={(g) => g.show.id} renderItem={...} />
        </TabsContent>
      )}
    </Tabs>
  );
}
```

The `renderItem` bodies are unchanged from NEU-1210's shipped code (the
`CreditRow` / `EpisodeCreditCard` calls at `PersonPage.tsx:390-451`); only
`headingHidden` is added to each `CreditSection`.

### 3.3 `CreditSection` gains `headingHidden` (D3)

Add `headingHidden?: boolean` (default `false`) to `CreditSectionProps` and apply
`sr-only` to the `<h2>` when set, mirroring `CastList.tsx:48`'s pattern:

```tsx
<h2 id={`${id}-heading`} className={headingHidden ? "sr-only" : "mb-3 text-lg font-semibold"}>
  {title} <span className="font-normal text-muted-foreground">({creditCount})</span>
</h2>
```

The `<section aria-labelledby={`${id}-heading`}>` is unchanged — the `id` and the
node stay in the DOM when `sr-only`, so the accessible name still resolves and
`getByRole("region", { name: /^Crew/ })` keeps finding the panel. The
`null`-when-empty branch (`PersonPage.tsx:128`) stays (D8).

### 3.4 What deliberately does not change

- **`usePersonCredits`** — one query, one payload. Not split (NEU-1210 D1).
- **`CreditSection`'s grid, collapse toggle, local `useState`, `null`-when-empty
  branch** — only the new opt-in `headingHidden` is added (D8).
- **`personCredits.ts`** (`groupByShow`, `collapseByEpisode`, `distinctLabels`,
  `characterLabel`) — pure helpers, untouched.
- **`ui/tabs.tsx`** — reused as-is; the `overflow-x-auto` is per-page on this
  page's `TabsList`, not shared.
- **The header, not-found, error-alert, headshot and dates-line rendering**
  (`PersonPage.tsx:457-496`) — unaffected; credits load separately from the
  header so a slow/failed fetch does not blank the person out.
- **The sibling pages' tab behaviour** — `ShowDetailPage` and `EpisodePage` keep
  their disabled-when-empty + `(0)` pattern verbatim; only their `TabCount`
  *definition* is removed and imported (D4). Their tests are unaffected because
  the rendered markup is byte-identical.
- **`selectTab`** — unchanged. It only fires from `onValueChange` on a visible
  tab, so it never receives a hidden value; a stale `?tab=` is left as-is (D6).

## 4. Decisions

**D1 — Hide empty categories; omit `TabsTrigger` + `TabsContent` (§3.2).** The
ticket title says "hide tabs with no content," and the structural fact makes it
safe: the single `usePersonCredits` query resolves all four counts together, so
there is no async pop-in or width-jitter for the always-present strip to guard
against — the exact reason both siblings keep empty tabs *present* does not
apply here. This reverses NEU-1210's D4 and diverges from both siblings
deliberately; the divergence is recorded because the reason (one query, not
four) is what makes them differ. The cost is losing "Guest (0)" as a stated
fact about a filmography — but a hidden tab and a `(0)` tab both say "none," and
hide leaves a cleaner strip for the common sparse shapes (a director with 0 cast
/ 0 crew / 0 guest / N episode-crew renders one tab, not four with three
`(0)`s).

**D2 — Move the count back into the tab (§3.2).** Reverses NEU-1210's D7. Each
populated tab carries `<TabCount value={data.<kind>.length} />`. Because only
populated tabs render (D1), the count is always `> 0` — no `(0)` ever shows,
which is consistent with hide. The single query means the strip renders only
after `data` resolves (§2.6), so no `isSuccess &&` guard is needed at the call
site, unlike both siblings' `crewQuery.isSuccess && <TabCount …/>`. This is the
simplification the single query buys and the one place the person page's tab
count diverges in *form* from the siblings' (same rendered output, no in-flight
guard).

**D3 — The in-panel heading goes `sr-only` via a new `headingHidden` prop on
`CreditSection` (§3.3).** Reverses NEU-1210's D9 / "no new prop." With the count
back in the tab (D2), the premise for a *visible* heading fails: NEU-1210 kept
it visible because the tab had dropped the count and the heading was the only
place a sighted user saw the filmography size. The count now lives in the tab,
so the heading duplicates it visibly — the thing both siblings avoid with
`headingHidden`. The full glossary terms ("Guest appearances", "Episode crew")
survive in the `sr-only` heading for assistive tech and the document outline,
and `aria-labelledby` still resolves because the node and its `id` stay in the
DOM. `headingHidden` is opt-in (default `false`), so `CreditSection`'s contract
stays intact for any future caller outside tabs.

**D4 — Extract `TabCount` to `src/components/TabCount.tsx` (§3.1).** This is the
third local copy (ShowDetailPage, EpisodePage, now PersonPage), and this repo's
convention extracts at the third (NEU-1057/1176/1193). NEU-1210's D8 pre-flagged
this exact surface as the trigger and deferred only because it dropped the
count. The component is byte-identical across all three sites — only the
call-site `isSuccess`-gating differs, which stays at the call sites — so
extraction is a pure move. Both siblings' rendered markup is unchanged, so their
tests pass unchanged.

**D5 — Default = first populated tab in order; `?tab=<populated>` selects;
`?tab=<empty/hidden/unknown>` falls back (§3.2).** NEU-1210's `firstPopulated`
machinery already computes this; the change is that Cast stops being special.
`order[0]` is `cast`, so when Cast is populated the no-param default still
resolves to Cast; when Cast is empty/hidden, `empties["cast"]` is true and the
default falls through to `firstPopulated`. One expression covers the no-param
default, the `?tab=<populated>` selection, the `?tab=<empty>` fallback, the
`?tab=<hidden>` fallback (identical condition under D1), and the `?tab=<unknown>`
fallback. The region only renders when `total > 0`, so the fallback always
resolves to a real tab.

**D6 — Leave a stale `?tab=` pointing at a hidden tab (§3.4).** A `?tab=guest`
deep-link to a person with no guest credits names a tab that isn't rendered;
`firstPopulated` already renders the right *content* (D5), so the page isn't
wrong, only the address bar is stale. Actively correcting it would add an
effect + a `setSearchParams` on data resolution — a new class of behaviour
neither sibling has (both only write the URL on user click). Consistency with
the siblings is worth more than a clean address bar for a rare stale deep-link,
and the fallback guarantees the right panel.

**D7 — Short labels + count; keep the `overflow-x-auto` safety-net (§3.2).** The
labels stay `Cast` / `Crew` / `Guest` / `Ep. crew` (NEU-1210's D10) plus the
count: `Cast (2)` / `Crew (1)` / `Guest (61)` / `Ep. crew (3)`. The full terms
live in the `sr-only` heading (D3). With the count back, the tabs are wider than
NEU-1210's bare labels, so the per-page `w-full justify-start overflow-x-auto`
on this page's `TabsList` is **more** necessary, not less — and it is unaffected
by D4 (it lives on `TabsList`, not `TabCount`). `ui/tabs.tsx` stays untouched.

**D8 — Keep `CreditSection`'s `null`-when-empty branch (§3.4).** Under D1 an
empty category's `TabsContent` is never rendered, so `CreditSection` only ever
receives populated `items` from the region and the branch is unreachable there.
It stays as a one-line defensive guard so the component remains usable outside
tabs if a future caller needs it; removing it would narrow `CreditSection`'s
contract for no real gain. This is NEU-1210's §3.6 rationale, unchanged.

**D9 — Accept the screen-reader double-count (§3.2, §3.3).** A tab `Cast (2)`
and an `sr-only` heading `Cast (2)` both name the count, so a screen-reader user
hears it twice (tab in the tab list, then the panel region label). This is
byte-identical to both siblings (`ShowDetailPage`: tab `Cast (N)` + `sr-only`
heading `Cast (N)`; `EpisodePage` likewise) and is the accepted app-wide
pattern, not worth diverging on.

## 5. Acceptance criteria

1. The four credit kinds render as tabs in the same space — one visible panel at
   a time. A category with zero credits is **omitted** from the strip: no
   `TabsTrigger` and no `TabsContent` for it. At least one tab always renders
   (the region is gated on `total > 0`).
2. A failed `usePersonCredits` request renders a whole-region `ErrorState` with
   retry (no tab strip); a pending request renders `<LoadingState>` (no tab
   strip); a successful `total === 0` renders "No credits yet." (no tab strip).
3. The default tab is the first populated tab in order `[cast, crew, guest,
   episode-crew]`. `?tab=<populated>` selects that tab; `?tab=<empty>`,
   `?tab=<hidden>` (same condition), `?tab=<unknown>`, and the absence of the
   param all fall back to the first populated tab in order.
4. Each populated tab carries its count: `Cast (N)` / `Crew (N)` / `Guest (N)` /
   `Ep. crew (N)`, where `N > 0`. Populated tabs are enabled; no `disabled` tab
   exists; no `(0)` appears anywhere in the strip.
5. The open panel's `<h2>` is `sr-only` (present in the DOM with its `id`, not
   visibly rendered). The full term plus count survives in the heading
   (`Cast (N)`, `Guest appearances (N)`, `Episode crew (N)`); `aria-labelledby`
   on the `<section>` resolves, so the panel is findable as
   `getByRole("region", { name: /^<term>/ })`.
6. `?tab=` deep-linking and fallback behave per AC 3. A stale `?tab=` pointing
   at a hidden tab is left in the address bar (no URL-correcting effect) while
   the first-populated panel renders. Switching tabs updates the URL with
   `replace` (no history stacking); `?tab=cast` and the absence of the param
   leave no `tab` param.
7. The tab strip does not clip at 375 px: it scrolls horizontally (`overflow-x-auto`
   on this page's `TabsList`) when the populated tabs do not fit, and no label is
   truncated.
8. `TabCount` is a single shared component (`src/components/TabCount.tsx`);
   `ShowDetailPage.tsx` and `EpisodePage.tsx` import it and no longer define a
   local copy. Both siblings' rendered markup is unchanged.
9. `task lint`, `task typecheck` and `task test` pass (run from
   `tvbf-frontend/`).

## 6. Tests

Update **`src/pages/PersonPage.test.tsx`** in place. The header, not-found,
non-numeric-id, error-alert, headshot and dates-line tests stay unchanged. The
grouping/accessibility block (L205-636) scopes with
`within(screen.getByRole("region", { name: /^Crew/ }))` etc.; those resolve via
the `sr-only` heading's `id` and **keep working unchanged**.

- **Region gate (AC 2):** the existing "surfaces a failed credits request"
  (L325-336), "says so when a person has no credits at all" (L111-123), and a
  pending query render no tab strip — unchanged.
- **Tabs present + count (AC 1, AC 4):** with all four populated, four `tab`
  roles exist — `Cast (2)`, `Crew (1)`, `Guest (2)`, `Ep. crew (3)` — each
  enabled. Replaces L53-67: the `queryByRole("tab", { name: /Cast \(/ })` guard
  flips from "no count" to "has count," and the in-panel heading assertion flips
  to `sr-only`.
- **Default = first populated (AC 3):** with Cast populated, `Cast (2)` is
  `aria-selected="true"` on render (L63 unchanged in outcome). With Cast empty
  and only episode-crew populated (L70-89), `Ep. crew (3)` is selected on
  render; flip the *visible-heading* assertion (L87) — `Episode crew (3)` is now
  the **tab** name, and the in-panel heading is `sr-only` (still in the DOM with
  its `id`, so the `aria-labelledby` region lookup still resolves).
- **Hide empty (AC 1, AC 4) — flips L91-109:** with `cast: []` and
  `guest_cast: []`, assert `queryByRole("tab", { name: "Cast" })` returns
  `null` and `queryByRole("tab", { name: "Guest" })` returns `null` (absent, not
  disabled); `Crew` is present, enabled and active. Drop the
  `queryByRole("tab", { name: /\(0\)/ })` guard (L108) — no `(0)` tab and no
  disabled tab exist under hide.
- **`?tab=` deep-linking + fallback (AC 3, AC 6):** `?tab=crew` selects Crew
  (L125-134, unchanged outcome); no param selects first-populated; `?tab=nonsense`
  falls back to first-populated (L136-145); `?tab=episode-crew` against an empty
  episode-crew list falls back to first-populated (L147-162, unchanged outcome).
  Add: `?tab=guest` against a guest-less person leaves `?tab=guest` in the
  address bar (via `LocationSpy`) while the first-populated panel renders (D6).
  Switching tabs updates the URL with `replace` — the history-length assertion
  (L164-180) keeps passing unchanged.
- **One-tab sparse filmography (AC 1):** the guest-only "collapses a long
  section" test (L286-309) — with only `guest_cast` populated, `Guest` is the
  sole `tab` role and `aria-selected="true"`; the `Show all 20 shows` toggle
  assertion is unchanged.
- **`sr-only` headings (AC 5):** switch to each populated tab and assert the
  in-panel `<h2>` is present (findable by `getByRole("heading", { name:
  "Cast (2)" })`) and carries the `sr-only` class, and that the panel is
  findable as `getByRole("region", { name: /^Cast/ })` via `aria-labelledby`.

Existing tests that must keep passing unchanged: the header, not-found,
non-numeric-id, error-alert, headshot and dates-line tests, and the whole
grouping/accessibility block. **`ShowDetailPage.test.tsx` and
`EpisodePage.test.tsx` are unchanged** — the extracted `TabCount` renders
byte-identical markup. The MSW fixture `fixturePersonCredits` (all four
populated) and handlers need no change.

## 7. Out of scope

- **Splitting `usePersonCredits` into four queries** — NEU-1210 D1; the single
  payload is a backend design choice this ticket consumes, and the single query
  is what makes hide safe (D1).
- **URL-correcting effect for a stale `?tab=`** — D6; a follow-up if the stale
  deep-link case proves confusing.
- **Changing the sibling pages' tab behaviour** — they keep disabled-when-empty
  + `(0)`; only their `TabCount` definition is removed and imported (D4).
- **`ShowDetailPage`'s 375 px edge** — NEU-1210 D10 noted it as a follow-up;
  unchanged here.
- **Preserving collapse/expanded state across tab switches** — NEU-1210 D11; a
  follow-up if the re-expand cost proves real for heavy guest lists.
- **Redesigning `CreditSection`'s layout** — it keeps its grid, its
  `null`-when-empty branch (D8), its "Show all N shows" toggle. This ticket only
  moves the count into the tab, hides empty tabs, and adds `headingHidden`.
- **Domain vocabulary / CONTEXT.md / ADRs** — no new terms; the four credit kinds
  and their distinction (ADR-0003, in `tvbf-backend/docs/adr/`) already exist. No
  glossary or ADR file is created by this ticket.

## 8. Risk to verify in the browser at 375 px

The tab strip now carries counts where NEU-1210's carried bare labels, so it is
wider. Worth one look at a person with a long guest list (the case the original
ticket exists for — e.g. Zachary Levi's 61 guest credits): that the strip
scrolls rather than clipping `Ep. crew`, that the active panel's grid stays
within the viewport, and that switching tabs does not shift the header or
footer. Also verify a director with only episode-crew credits renders **one**
`Ep. crew (N)` tab (not four with three absent), that the default lands on it
(D5), and that `?tab=guest` to a guest-less person leaves the param in the bar
while the first-populated panel renders (D6) — the one behaviour that is new and
worth eyeballing.
