# NEU-1209 — Episode guest cast and crew into tabs in the same space

**Ticket:** [NEU-1209](https://linear.app/neuroticsasquatch/issue/NEU-1209/on-episode-page-place-guest-cast-and-crew-into-tabs-in-same-space)
**Repo:** `tvbf-frontend`
**Project:** tvbf: Maintenance
**Blocked by:** —
**Related:** —
**Precedent consumed:** `src/pages/ShowDetailPage.tsx` (the Tabs pattern: `Tabs`/`TabsTrigger`/`TabsContent`, `?tab=` URL sync, `TabCount`, disabled-when-empty, errored-stays-enabled, page-fetches-for-counts) and its test `src/pages/ShowDetailPage.test.tsx`
**Status:** approved for implementation

This spec lives in this repo's `docs/specs/` because nothing in another repo cites
it: it is entirely a `tvbf-frontend` change consuming contracts that already
exist (CLAUDE.md's cross-repo-citation rule).

---

## 1. What this is

The episode page (`src/pages/EpisodePage.tsx`) renders guest cast and crew as
two **stacked sections** (`EpisodePage.tsx:219-220`):

```tsx
<EpisodeGuestCast episodeId={ep.id} />
<EpisodeCrew episodeId={ep.id} />
```

NEU-1209 moves them into a tabbed region that occupies the same space — one
visible panel at a time — so a long guest cast no longer pushes crew (and the
rest of the page) down, and vice versa.

The sibling show page already does exactly this for cast/crew/similar
(`ShowDetailPage.tsx:179-322`), and this ticket lands the same pattern with the
one difference that matters: **the episode page has no always-present tab.**
~74% of episodes have *neither* guest cast nor crew (guest cast is empty on
96% of episodes, crew on 22.5%), and both components today *deliberately*
render nothing for that case — no header, no placeholder, no reserved space.
That changes the strip-presence and default-tab decisions, and nothing else.

## 2. What is established before any decision below

**2.1 The components already do the right thing per-panel.** `EpisodeGuestCast`
wraps `CastList`, which **already supports `headingHidden`** (`CastList.tsx:27`)
and returns nothing when empty; `EpisodeCrew` renders its own inline
`<h2 id="episode-crew-heading">` (no `headingHidden` yet) and returns `null`
when empty. Both return `<ErrorState />` on a failed fetch rather than
collapsing to the empty look — a contract both files state in comments and
this ticket must not break.

**2.2 The Tabs primitive is already imported and styled.** `ui/tabs.tsx`
(Radix) is in use on `ShowDetailPage`. `TabCount` is a one-line local
component at `ShowDetailPage.tsx:328`; this ticket adds a second local copy
(see §4 D7).

**2.3 `EpisodePage` has no dedicated test file.** `src/pages/EpisodePage.test.tsx`
does not exist. The page's only coverage is as the render vehicle in
`SpecialsSeasonLabel.test.tsx` (`L18` import, `L149` route), which asserts the
season-0 back-link reads "Specials." That test renders the full page, so it
exercises whatever this ticket lands — and because it sets up no episode-credit
handlers, its queries stay pending, which is exactly the case §3.1 renders
nothing for. **That test must keep passing unchanged.** NEU-1209 creates
`EpisodePage.test.tsx` (see §6).

**2.4 `ShowDetailPage.test.tsx` is the test model.** It asserts tab presence +
counts, the default-open tab, `?tab=` deep-linking, `toBeDisabled()` on empty
tabs, and fallback from `?tab=nonsense` and from an empty requested tab to the
default (`L38-205`). The episode-page test mirrors the subset of these that
apply to a two-tab, no-always-present-tab region.

**2.5 No `blockedBy` or related tickets, no project-wide spec.** NEU-1209
carries no relations and the "tvbf: Maintenance" project has an empty
description; there are no merged dependency specs to honour beyond the live
`ShowDetailPage` code.

## 3. What to build

### 3.1 The region renders only when it has something to show (D1)

Gate the whole tabbed block on at least one populated or errored query:

```tsx
const guestQuery = useEpisodeGuestCast(ep.id); // for counts/empty/gate
const crewQuery = useEpisodeCrew(ep.id);       // for counts/empty/gate

const guestCount = guestQuery.data?.length ?? 0;
const crewCount = crewQuery.data?.length ?? 0;
const guestEmpty = guestQuery.isSuccess && guestCount === 0;
const crewEmpty = crewQuery.isSuccess && crewCount === 0;

const showCredits =
  crewCount > 0 || guestCount > 0 || crewQuery.isError || guestQuery.isError;
```

When `showCredits` is false — the common case, including both queries in flight
and both resolved-empty — render **nothing**, preserving the current "render
nothing for the empty case" philosophy (§1). This is what keeps
`SpecialsSeasonLabel.test.tsx` green without it needing credit handlers (§2.3).

### 3.2 Tabs, with Crew default and URL sync (D2, D3, D8)

```tsx
{showCredits && (
  <Tabs value={tab} onValueChange={selectTab}>
    <TabsList>
      <TabsTrigger value="crew" disabled={crewEmpty}>
        Crew {crewQuery.isSuccess && <TabCount value={crewCount} />}
      </TabsTrigger>
      <TabsTrigger value="guest-cast" disabled={guestEmpty}>
        Guest cast {guestQuery.isSuccess && <TabCount value={guestCount} />}
      </TabsTrigger>
    </TabsList>
    <TabsContent value="crew">
      <EpisodeCrew episodeId={ep.id} headingHidden />
    </TabsContent>
    <TabsContent value="guest-cast">
      <EpisodeGuestCast episodeId={ep.id} headingHidden />
    </TabsContent>
  </Tabs>
)}
```

Tab `value` strings are `"crew"` and `"guest-cast"` (D8). `"crew"` is
byte-identical to the sibling page; `"guest-cast"` is the kebab of the visible
label and avoids `"guest"`, which `PersonPage` already uses as a region id for
"Guest appearances" — a different surface.

**Default and fallback** (no always-present tab, so the fallback differs from
`ShowDetailPage`'s "always seasons"):

```tsx
const [searchParams, setSearchParams] = useSearchParams();
const requested = searchParams.get("tab");
const wanted = requested === "crew" || requested === "guest-cast" ? requested : "crew";
// An empty requested/default tab falls back to the other tab. If both are
// empty the region is gated out (§3.1), so `tab` is never used in that case.
const tab =
  wanted === "crew" && crewEmpty
    ? "guest-cast"
    : wanted === "guest-cast" && guestEmpty
      ? "crew"
      : wanted;

function selectTab(next: string) {
  const params = new URLSearchParams(searchParams);
  if (next === "crew") params.delete("tab"); // crew is the default
  else params.set("tab", next);
  setSearchParams(params, { replace: true }); // tab switches don't stack history
}
```

This mirrors `ShowDetailPage.tsx:69-91` exactly in shape, with `"crew"` standing
in for `"seasons"` as the URL-absent default and the fallback target adjusted
to the other credit tab rather than a present anchor. When both tabs are empty
the region is not rendered (§3.1), so the `wanted === "crew" && crewEmpty &&
guestEmpty` path never produces a visible fallback-to-empty; the gate absorbs
it.

### 3.3 The components gain `headingHidden` (D4)

`EpisodePage` passes `headingHidden` on both (§3.2), so the in-panel headings
go `sr-only` — the tab label already carries title + count, and a visible
duplicate heading is the thing `ShowDetailPage` avoids with the same prop.

- **`EpisodeGuestCast`** — add `headingHidden?: boolean` (default `false`),
  forward to `CastList` (which already supports it, `CastList.tsx:27`). One
  prop threaded through, no other change.
- **`EpisodeCrew`** — add `headingHidden?: boolean` (default `false`); apply
  `sr-only` to its inline `<h2 id="episode-crew-heading">` when set, the same
  `headingHidden ? "sr-only" : "mb-3 text-lg font-semibold"` pattern
  `CastList.tsx:48` uses.

Both components **keep their own queries, error rendering, and empty-render
branches unchanged** (D4). The page fetches the same keys for counts/empty/gate;
React Query dedupes on the key, so this costs no extra request — the exact
arrangement `ShowDetailPage.tsx:48-51` documents for its own cast/crew.

### 3.4 What deliberately does not change

- **`CastList`** — `headingHidden` already supported. Zero diff.
- **`EpisodeGuestCast` / `EpisodeCrew` query, error, and empty behaviour** —
  untouched; only a new opt-in `headingHidden` prop each.
- **`ui/tabs.tsx`** — reused as-is.
- **Prev/next episode buttons** (`EpisodePage.tsx:174-197`) — keep bare-path
  `navigate(\`/episodes/${prev.id}\`)`. Switching episodes resets the tab to
  the Crew default (D9). The ticket is a layout/maintenance item, not a
  navigation change, and Crew-default already serves the cross-episode crew
  case on the ~77.5% of episodes that have crew.
- **`TabCount`** — a second local copy in `EpisodePage`, not extracted (D7).

## 4. Decisions

**D1 — Hide the region when both are empty (§3.1).** The alternative
considered and rejected was to always render a fixed strip, faithful to
`ShowDetailPage`. `ShowDetailPage`'s own rationale (`ShowDetailPage.tsx:53-67`)
is anchored on *Seasons* — a tab that's always present, so absence in the
other tabs is information against a present anchor. The episode page has no
such anchor: both credits are empty ~74% of the time, so a fixed strip would
land two disabled tabs on most episode pages — visual noise the ticket does
not ask for. Rendering nothing for the empty case is also what both components
already do deliberately and what keeps `SpecialsSeasonLabel.test.tsx` green
without credit handlers (§2.3). The strip *appears* with its first populated
tab — that's content arriving, not a width-jump of an already-present strip,
so it dodges the pop-in concern that motivated the always-present strip
elsewhere.

**D2 — Crew is the default tab (§3.2).** Crew is populated on ~77.5% of
episodes vs guest cast ~4%, so defaulting to Crew lands most pages on
content — the same role Seasons plays on the show page. Current stack order
(`EpisodeGuestCast` first at line 219) is not a statement of primacy; it's
just render order. Fallback to Guest cast when Crew is empty (the ~0.9% with
guest cast but no crew) is the ShowDetailPage empty-requested-tab rule adapted
to a no-anchor region.

**D3 — Tab state syncs to `?tab=` (§3.2).** Mirrors `ShowDetailPage.tsx:69-91`:
`?tab=guest-cast|crew`, default out of the URL, `setSearchParams(..., { replace:
true })`. Deep-linkable and consistent with the sibling page. The cost is one
`useSearchParams`; the episode page already uses `useNavigate` and `useParams`.

**D4 — Page fetches for counts; components keep their query/render and gain
`headingHidden` (§3.3).** The alternative was to lift the data into props and
drop the components' own hooks. Rejected because the dedup makes the
double-fetch free (the precedent's own note, `ShowDetailPage.tsx:48-51`) and
lifting is more churn for no gain. `headingHidden` is opt-in (default `false`)
so the components' contracts stay intact for any future caller.

**D5 — Never swallow a fetch error (§3.1).** The gate includes
`crewQuery.isError || guestQuery.isError`. A single errored query with the
other empty-success would otherwise be silently dropped by a data-only gate —
hiding a failure the user can't retry. Errored is not `isSuccess && 0`, so an
errored tab stays **enabled** and its panel shows its `ErrorState` with retry,
exactly `ShowDetailPage`'s "disabling would bury the ErrorState." Both
components already carry comments stating a failed request must not look like
the empty case; this gate carries that promise up to the region level.

**D6 — Show `(0)` on a disabled-empty tab (§3.2).** `Crew {crewQuery.isSuccess
&& <TabCount value={crewCount} />}` — identical to
`ShowDetailPage.tsx:185-189`. A disabled empty tab reads `Guest cast (0)`; the
count is the information that it's empty, and it's disabled so you can't land
on nothing. An in-flight tab shows no count. Consistent with the sibling page.

**D7 — A second local `TabCount`, not extracted (§3.4).** `TabCount` is a
one-line component; `ShowDetailPage.tsx:328` holds the first copy, this ticket
adds the second. Per this repo's own convention (AGENTS.md: extraction lands at
the *third* copy — NEU-1057's three library marks, NEU-1176's two, NEU-1193
extracted at the third), two is under the threshold. The spec records the
deliberate non-extraction so the third occurrence knows to extract both prior
copies.

**D8 — Tab `value` strings `"crew"` / `"guest-cast"` (§3.2).** `"crew"` shares
the sibling page's vocabulary; `"guest-cast"` is the kebab of the visible
"Guest cast" label and avoids `"guest"`, which `PersonPage` already uses as a
region id for the distinct "Guest appearances" surface.

**D9 — Prev/next episode buttons stay bare-path (§3.4).** Switching episodes
resets to the Crew default. Preserving the tab across episodes was considered
and rejected as new behaviour the ticket doesn't ask for; Crew-default already
serves the cross-episode crew case on the ~77.5% of episodes with crew, and a
preserved tab onto an empty next episode would fall back via §3.2 anyway,
making the affordance partly illusory.

## 5. Acceptance criteria

1. Guest cast and crew render as two tabs in the same space — one visible
   panel at a time — replacing the two stacked sections.
2. The region renders only when at least one of guest cast or crew has data,
   or a query has errored; it renders nothing when both are empty or in flight.
3. Crew is the default tab; when Crew is empty and Guest cast has data, Guest
   cast is the default.
4. A resolved-empty tab is `disabled` with its `(0)` count showing; an errored
   tab is enabled and its panel shows its `ErrorState` with retry.
5. `?tab=guest-cast` deep-links to the Guest cast panel; `?tab=crew` (and the
   absence of the param) deep-links to Crew; an unknown value falls back to
   Crew; a requested tab that is empty falls back to the other tab.
6. The in-panel headings are `sr-only` (the tab label carries title + count).
7. Prev/next episode navigation resets the tab to the Crew default.
8. `SpecialsSeasonLabel.test.tsx` passes unchanged.
9. `task lint`, `task typecheck` and `task test` pass (run from
   `tvbf-frontend/`).

## 6. Tests

Create **`src/pages/EpisodePage.test.tsx`** (does not exist today, §2.3),
mirroring the relevant subset of `ShowDetailPage.test.tsx`:

- **Region presence / gate (AC 2):** with both credits empty (or queries
  pending) the tabbed region is absent; with crew data it renders; with guest
  cast data only it renders; with one query errored and the other empty it
  renders (AC 2, AC 4).
- **Default tab (AC 3):** with crew data present, `Crew` is
  `aria-selected="true"` on render; with crew empty and guest cast present,
  `Guest cast` is selected.
- **Disabled-empty + count (AC 4):** `Crew (0)` is `toBeDisabled()` when crew
  is empty; `Guest cast (0)` likewise; a populated tab stays enabled and shows
  its `(N)`.
- **Error state (AC 4):** a failed crew query with guest cast empty leaves the
  Crew tab enabled and its panel shows the retry affordance (not the empty
  look, not a disabled tab).
- **`?tab=` deep-linking + fallback (AC 5):** `?tab=guest-cast` selects Guest
  cast; `?tab=crew` and no param select Crew; `?tab=nonsense` falls back to
  Crew; `?tab=guest-cast` against an empty guest-cast list falls back to Crew;
  switching tabs updates the URL with `replace` (no history stacking).
- **Headings `sr-only` (AC 6):** the in-panel `h2`s are present in the DOM for
  assistive tech but not visibly rendered when inside tabs.
- **Prev/next resets (AC 7):** with `?tab=guest-cast` active, navigating to
  the next episode lands on Crew.

Existing tests that must keep passing: **`SpecialsSeasonLabel.test.tsx`**
(AC 8) — it renders the full page and asserts the season-0 back-link; because
it sets up no credit handlers, the queries stay pending and the region renders
nothing (§3.1), so the back-link assertion is unaffected.

## 7. Out of scope

- **`TabCount` extraction** — waits for a third copy per the repo's convention
  (D7).
- **Preserving the tab across prev/next episode navigation** — D9; a
  follow-up if the cross-episode browsing case proves real.
- **Redesigning `EpisodeCrew`'s layout** — it keeps its flat role-ordered list
  (deliberately not grouped, per its own docstring citing ADR-0003). This
  ticket only moves it into a tab.
- **The show page's tab pattern** — unchanged; this ticket consumes it as the
  precedent, not the other way around.

## 8. Risk to verify in the browser at 375 px

The tab strip has never rendered on the episode page. Worth one look at an
episode with a long guest cast (the case the ticket exists for): that the
strip does not wrap at ~375 px, that the active panel's `PersonChip` grid
stays within the viewport, and that the region's appearance when credits
resolve does not shift the prev/next buttons or the summary block above it
unexpectedly.
