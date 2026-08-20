# NEU-1007 — Group person-page credits by show

**Ticket:** [NEU-1007](https://linear.app/neuroticsasquatch/issue/NEU-1007/frontend-group-person-page-credits-by-show-within-each-category)
**Related:** [NEU-964](https://linear.app/neuroticsasquatch/issue/NEU-964), [NEU-965](https://linear.app/neuroticsasquatch/issue/NEU-965) (both shipped)
**Repo:** `tvbf-frontend` — **frontend only**

## Problem

`PersonPage` renders each of its four credit categories as a flat grid of one card per credit. For episode-level credits that reads badly: a director with 40 episodes of one show gets 40 near-identical cards, and the "Show all 40" expander is the only thing between the reader and a wall of them.

Group within each existing category by show, so a person's relationship to a show reads as one entry — a **credit group**.

## No backend work — verified

- `GET /people/{person_id}/credits` is **unpaginated** and returns all four lists complete in one response (`routers/browse.py:234`), so client-side grouping can never be partial. That is the usual reason grouping needs server help, and it does not apply.
- Every credit DTO already carries `show: ShowRef` with `id`, `name` and `premiered` (`tvmaze/schemas.py:226-249`).

## What the current page does

| section | card title | links to |
| --- | --- | --- |
| Cast | show name | `/shows/{id}` |
| Crew | show name | `/shows/{id}` |
| Guest appearances | `Show — S2E11` | `/episodes/{id}` |
| Episode crew | `Show — S1E3` | `/episodes/{id}` |

Layout is a responsive 1/2/3-column card grid, collapsing past `COLLAPSED_COUNT = 12`.

## Decisions

### 1. The expander exists only where grouped credits point at different things

**Cast and Crew already link to the show.** Two cards for one show differ only in their detail line — a second character, a second role. Grouping merges them into one card and joins the details. **No expander**, because nothing is lost.

```
Cast     Severance          Mark S. · Mark Scout · 2022
Crew     The Morning Show   Director · Writer · 2019
```

**Guest appearances and Episode crew link to a specific episode.** Collapsing them to a show-level card would destroy those links, so the card expands in place to list its episodes, each still linking to its episode:

```
┌──────────────────────────────┐
│ Severance                    │
│ Director · 12 episodes   [˅] │
│   S2E10 The After Hours      │
│   S2E9  Sweet Vitriol        │
└──────────────────────────────┘
```

This is why the asymmetry is principled rather than inconsistent: **disclosure is added exactly where grouping would otherwise lose a destination.**

### 2. A single-credit group renders exactly as it does today

One credit on a show gets no expander, no count, no "1 episode". Guest and episode-crew singletons keep the current `Show — S2E11` title linking straight to the episode. The common case must not gain ceremony — for most people every group has one credit, and if grouping makes those pages busier it has made things worse.

### 3. Group ordering — by most recent episode

Guest and Episode crew arrive ordered by `episode.airdate DESC` (`_CREDIT_EPISODE_ORDER`), which interleaves shows. Grouping necessarily replaces that ordering, and the replacement is **the newest episode within each group**:

```
Law & Order: SVU   (2024 episode)   ← premiered 1999
Severance          (2022 episode)
The Wire           (2004 episode)   ← premiered 2002
```

This preserves the recency the air-date ordering exists for: work from last month stays at the top even on a decades-old show. Sorting groups by show premiere date was rejected because it buries exactly that.

Episodes **within** a group stay newest-first, matching the order the API already returns.

Cast and Crew keep their existing order — `show.premiered DESC` (`_CREDIT_SHOW_ORDER`) — which grouping does not disturb, since same-show credits are already adjacent there.

### 4. Within a group, collapse repeats of the same episode

One person routinely holds two roles on one episode — Story and Teleplay is common — and two characters in one episode happens. Today those render as two cards for the same episode, disambiguated only by `CreditRow`'s `linkLabel` escape hatch, which exists so a screen reader doesn't announce two identically-named links to the same href.

Inside a group, collapse per episode and join the roles or characters:

```
  S1E3 The Grim Barbarity of Optics · Story · Teleplay
```

That makes each link's visible name unique within its group, so **`linkLabel` is no longer needed on the episode-crew section** — the workaround can go, rather than being carried forward. Check whether any other caller still needs it before removing the prop.

### 5. Counts and collapse

- The section heading count stays a **credit** count, not a group count. "Episode crew (40)" is a statement about the size of someone's body of work; "(3)" would understate it.
- `COLLAPSED_COUNT` applies to **cards**, since cards are what the grid lays out. Twelve cards, not twelve credits.

## Implementation notes

**`key={i}` stops being safe.** `CreditSection` keys rows by index, justified in a comment as safe because "the list is one query result rendered as-is, never reordered or spliced". Grouping does both. Cards key on `show.id`; entries within a card key on `episode.id` (unique per group once decision 4 collapses repeats).

**Grouping belongs outside `CreditSection`.** That component is generic over `T` and should stay so. Put the grouping in a small module — `personCredits.ts` alongside the page, mirroring how the home tabs keep comparators in `home/*Sort.ts` so they are directly testable without rendering.

**`CreditSection` needs to stay dumb about groups.** It already takes `items` and `renderItem`; the page can hand it groups instead of credits without the component knowing, as long as the count and collapse decisions above are passed in rather than derived from `items.length`.

## Testing

`src/pages/PersonPage.test.tsx` exists; extend it, plus unit tests on the grouping module.

1. Grouping module: credits across three shows produce three groups, ordered by newest episode.
2. Grouping module: two roles on one episode collapse to one entry with both roles.
3. Cast/Crew: two characters (or two roles) on one show render as **one** card with both in the detail.
4. A show with one credit renders with no expander and links straight to the episode.
5. A show with many credits expands to reveal per-episode links, each pointing at its own episode.
6. Section heading shows the credit count, not the group count.
7. Empty sections still hide entirely — the 0/1/0 shape is common in the mirror.
8. A person with no credits at all still shows "No credits yet."

## Acceptance

- Each section groups by show; a person with many episodes of one show reads as one entry
- Every episode remains reachable by its own link
- A person whose credits are all one-per-show looks materially unchanged
- Guest/Episode-crew groups order by newest episode; Cast/Crew order unchanged
- Keys are stable identities, not indices
- `linkLabel` removed if decision 4 makes it unused
- `task lint`, `task typecheck`, `task test` green

## Out of scope

**Merging the four categories into fewer sections.** `CONTEXT.md` keeps **crew credit** and **episode crew credit** distinct, and NEU-965 deliberately gave episode crew its own section — "Executive Producer of *Show*" and "Director of *Show* S3E7" are different claims. Grouping happens *within* a category, never across.

**Backend changes.** Verified unnecessary above.

**Pagination or lazy loading of credits.** The response is already unbounded and this ticket does not change that. If a pathological filmography ever makes the page slow, that is its own ticket with its own measurement.
