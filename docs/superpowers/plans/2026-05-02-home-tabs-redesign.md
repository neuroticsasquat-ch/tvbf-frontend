# Home Tabs Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate Watch Next / Upcoming / My Shows into a single Home page with four tabs (Watch Next, Upcoming, All, Watched), and replace the primary nav with three icons (Home, Search, user menu) plus a mobile bottom tab bar.

**Architecture:** One `HomePage` component with URL-driven tabs and four extracted list components under `src/components/home/`. The Watched bucket is derived client-side from `useMyShows()` data — no new backend endpoint. The single backend change is adding `last_watched_at` to `MyShowEntry` so the Watched row can display "last watched <date>". `AppShell` is rewritten to use icon-based nav in the desktop header and a fixed bottom tab bar on mobile.

**Tech Stack:** FastAPI + SQLAlchemy (backend); React + react-router + react-query + Tailwind + lucide-react + Radix Dialog (frontend). Tests: pytest (backend), vitest + msw (frontend).

**Conventions:**
- Spec: `docs/superpowers/specs/2026-05-02-home-tabs-redesign-design.md`.
- This repo's plans **do not include `git commit` steps** — the user commits on their own cadence (per `CLAUDE.md`).
- Backend `task` commands run from `tvbf-backend/`; frontend `task` commands run from `tvbf-frontend/`.

---

## Task 1: Backend — add `last_watched_at` to `MyShowEntry` (failing test)

**Files:**
- Modify: `tvbf-backend/tests/integration/app/services/test_my_shows_service.py`

- [ ] **Step 1: Add a failing assertion to the existing My-Shows integration test**

Open `tvbf-backend/tests/integration/app/services/test_my_shows_service.py`. Find the test that asserts `e.next_episode is not None` and `e.next_episode.number == 2` (around line 180). Locate the test function it lives in, then in the same test add an assertion that the entry exposes a `last_watched_at` matching the watched-episode timestamp.

Concretely, after the existing `assert e.next_episode.number == 2` line, add:

```python
    assert e.last_watched_at is not None
```

If the test does not already mark an episode as watched, a separate test better captures the requirement. Add this new test at the bottom of the file (adapt fixture names to whatever the file already uses — search the file for an existing test that calls `episode_watch_repo.add` or similar to copy the pattern):

```python
async def test_list_my_shows_populates_last_watched_at(
    session, sample_user, sample_show_with_episodes
):
    """list_my_shows should expose the timestamp of the most recent watched
    episode per show, mirroring what Watch Next already provides."""
    from tvbf.app.repos import episode_watch_repo, show_membership_repo
    from tvbf.app.services import my_shows_service

    user_id = sample_user.id
    show = sample_show_with_episodes
    await show_membership_repo.add(session, user_id=user_id, show_id=show.id)
    # Mark the first episode as watched.
    first_ep = show.seasons[0].episodes[0]
    await episode_watch_repo.add(session, user_id=user_id, episode_id=first_ep.id)
    await session.commit()

    entries = await my_shows_service.list_my_shows(session, user_id=user_id)
    assert len(entries) == 1
    assert entries[0].last_watched_at is not None
```

> **Note:** the fixture names (`sample_user`, `sample_show_with_episodes`) are placeholders — match whatever names the file's existing tests use. Read the top of `test_my_shows_service.py` for the right fixture imports before pasting.

- [ ] **Step 2: Run the test and verify it fails**

```bash
cd tvbf-backend && task test -- tests/integration/app/services/test_my_shows_service.py::test_list_my_shows_populates_last_watched_at
```

Expected: FAIL with `AttributeError` or assertion error — `MyShowEntry` has no `last_watched_at`.

---

## Task 2: Backend — implement `last_watched_at`

**Files:**
- Modify: `tvbf-backend/src/tvbf/app/dto.py`
- Modify: `tvbf-backend/src/tvbf/app/services/my_shows_service.py`

- [ ] **Step 1: Add `last_watched_at` field to `MyShowEntry`**

In `tvbf-backend/src/tvbf/app/dto.py`, find the `MyShowEntry` class. Add the field after `last_aired`:

```python
class MyShowEntry(BaseModel):
    show: ShowSummary
    watched_episode_count: int
    total_episode_count: int
    aired_episode_count: int = 0
    upcoming_episode_count: int = 0
    last_aired: date | None = None
    last_watched_at: datetime | None = None
    next_episode: EpisodeOut | None = None
    added_at: datetime
```

- [ ] **Step 2: Populate `last_watched_at` in `list_my_shows`**

In `tvbf-backend/src/tvbf/app/services/my_shows_service.py`, find `list_my_shows`. After the `aired_counts = await episode_repo.count_aired_per_show(...)` line, add a call to `latest_watched_per_show` (the helper Watch Next already uses):

```python
    today = date.today()
    latest_aired = await episode_repo.latest_aired_per_show(db, show_ids, today)
    aired_counts = await episode_repo.count_aired_per_show(db, show_ids, today)
    last_watched = await episode_watch_repo.latest_watched_per_show(
        db, user_id=user_id, show_ids=show_ids
    )
```

Then in the `MyShowEntry(...)` construction loop, add `last_watched_at=last_watched.get(show.id)` alongside the existing fields:

```python
        entries.append(
            MyShowEntry(
                show=build_show_summary_from_refs(
                    show,
                    genres_by_show=genres_by_show,
                    networks_by_id=networks_by_id,
                    wcs_by_id=wcs_by_id,
                ),
                watched_episode_count=watched_counts.get(show.id, 0),
                total_episode_count=total,
                aired_episode_count=aired,
                upcoming_episode_count=total - aired,
                last_aired=latest_aired.get(show.id),
                last_watched_at=last_watched.get(show.id),
                next_episode=_episode_to_out(next_ep) if next_ep is not None else None,
                added_at=added_at_by_show[show.id],
            )
        )
```

- [ ] **Step 3: Run the new test and verify it passes**

```bash
cd tvbf-backend && task test -- tests/integration/app/services/test_my_shows_service.py::test_list_my_shows_populates_last_watched_at
```

Expected: PASS.

- [ ] **Step 4: Run the full My-Shows test suite and the typechecker**

```bash
cd tvbf-backend && task test -- tests/integration/app/services/test_my_shows_service.py tests/unit/app/services/test_my_shows_pure.py
cd tvbf-backend && task typecheck
```

Expected: all tests pass; pyright reports `0 errors`.

---

## Task 3: Frontend — mirror `last_watched_at` and add `WatchedSort`

**Files:**
- Modify: `tvbf-frontend/src/api/types.ts`
- Modify: `tvbf-frontend/src/api/me.ts`

- [ ] **Step 1: Add `last_watched_at` to the `MyShowEntry` interface**

In `tvbf-frontend/src/api/types.ts`, find the `MyShowEntry` interface (currently lines around 133–142). Add the field after `last_aired`:

```ts
export interface MyShowEntry {
  show: ShowSummary;
  watched_episode_count: number;
  total_episode_count: number;
  aired_episode_count: number;
  upcoming_episode_count: number;
  last_aired: string | null;
  last_watched_at: string | null;
  next_episode: EpisodeOut | null;
  added_at: string;
}
```

- [ ] **Step 2: Add the `WatchedSort` type**

In the same file, after the existing `MyShowsSort`/`WatchNextSort`/`UpcomingSort` declarations, add:

```ts
export type WatchedSort =
  | "last_watched_desc"
  | "name_asc"
  | "name_desc"
  | "added_desc";
```

- [ ] **Step 3: Update `placeholderMyShowEntry`**

In `tvbf-frontend/src/api/me.ts`, find `placeholderMyShowEntry`. Add `last_watched_at: null` after `last_aired: null`:

```ts
function placeholderMyShowEntry(showId: number): MyShowEntry {
  return {
    show: {
      id: showId,
      name: "",
      type: null,
      status: null,
      language: null,
      premiered: null,
      ended: null,
      image_medium: null,
      image_original: null,
      network: null,
      web_channel: null,
      genres: [],
    },
    watched_episode_count: 0,
    total_episode_count: 0,
    aired_episode_count: 0,
    upcoming_episode_count: 0,
    last_aired: null,
    last_watched_at: null,
    next_episode: null,
    added_at: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Verify the types compile**

```bash
cd tvbf-frontend && task typecheck
```

Expected: no errors.

---

## Task 4: Extract `WatchNextList` from `WatchNextPage`

**Files:**
- Create: `tvbf-frontend/src/components/home/WatchNextList.tsx`

- [ ] **Step 1: Create the directory and the new component**

```bash
mkdir -p tvbf-frontend/src/components/home
```

Create `tvbf-frontend/src/components/home/WatchNextList.tsx` with the entire body of `WatchNextPage` (the page wraps a `<div>` containing the title, sort sheet, and list). For the extraction, **drop the `<h1>` (page title)** since the Home page renders the title; keep the sort sheet and the list.

```tsx
import { useMemo, useState } from "react";
import { Link } from "react-router";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { useWatchNext } from "@/api/me";
import type { WatchNextEntry, WatchNextSort } from "@/api/types";
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { cn } from "@/lib/cn";
import { WatchProgressBar } from "@/components/WatchProgressBar";

const SORTS: { key: WatchNextSort; label: string }[] = [
  { key: "oldest_unwatched_asc", label: "Oldest Unwatched" },
  { key: "last_aired_desc", label: "Recently Aired" },
  { key: "last_watched_desc", label: "Last Watched" },
  { key: "added_desc", label: "Recently Added" },
  { key: "name_asc", label: "Show Title" },
];

const nameKey = (s: string) => s.toLowerCase().replace(/^(the|a|an)\s+/i, "");

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatAirdate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return DATE_FMT.format(new Date(y, m - 1, d));
}

function compareEntries(a: WatchNextEntry, b: WatchNextEntry, sort: WatchNextSort): number {
  const tiebreak = nameKey(a.show.name).localeCompare(nameKey(b.show.name));
  const cmpNullable = (av: string | null | undefined, bv: string | null | undefined, desc: boolean) => {
    if (!av && !bv) return tiebreak;
    if (!av) return 1;
    if (!bv) return -1;
    return desc ? bv.localeCompare(av) : av.localeCompare(bv);
  };
  switch (sort) {
    case "oldest_unwatched_asc":
      return cmpNullable(a.episode.airdate, b.episode.airdate, false) || tiebreak;
    case "last_watched_desc":
      return cmpNullable(a.last_watched_at, b.last_watched_at, true) || tiebreak;
    case "last_aired_desc":
      return cmpNullable(a.last_aired, b.last_aired, true) || tiebreak;
    case "added_desc":
      return cmpNullable(a.added_at, b.added_at, true) || tiebreak;
    case "name_asc":
      return tiebreak;
  }
}

const SORT_KEYS = SORTS.map((s) => s.key);

export function WatchNextList() {
  const [sort, setSort] = usePersistedSort<WatchNextSort>(
    "watch-next",
    SORT_KEYS,
    "oldest_unwatched_asc",
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data, isLoading } = useWatchNext();
  const sorted = useMemo(
    () => (data ? [...data].sort((a, b) => compareEntries(a, b, sort)) : data),
    [data, sort],
  );
  const currentLabel = SORTS.find((s) => s.key === sort)?.label ?? "";

  return (
    <div>
      <div className="flex items-baseline justify-end mb-4">
        <DialogPrimitive.Root open={sheetOpen} onOpenChange={setSheetOpen}>
          <DialogPrimitive.Trigger
            aria-label={`Sort Watch Next (current: ${currentLabel})`}
            className="text-sm rounded border border-border px-2 py-1 bg-background hover:bg-accent inline-flex items-center gap-1"
          >
            <ArrowDown className="h-4 w-4" aria-hidden />
            <ArrowUp className="h-4 w-4 -ml-2" aria-hidden />
            <span>{currentLabel}</span>
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <DialogPrimitive.Content
              aria-describedby={undefined}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=open]:duration-200 data-[state=closed]:duration-150"
            >
              <DialogPrimitive.Title className="text-base font-semibold mb-3">
                Sort Watch Next
              </DialogPrimitive.Title>
              <ul className="flex flex-col">
                {SORTS.map((s) => {
                  const active = s.key === sort;
                  return (
                    <li key={s.key}>
                      <button
                        type="button"
                        onClick={() => {
                          setSort(s.key);
                          setSheetOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 text-left rounded px-3 py-3 text-sm hover:bg-accent",
                          active && "font-semibold",
                        )}
                      >
                        <span className="w-4 inline-flex justify-center">
                          {active && <Check className="h-4 w-4" aria-hidden />}
                        </span>
                        <span>{s.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
      {isLoading && <p>Loading…</p>}
      {!isLoading && sorted && sorted.length === 0 && (
        <p className="text-muted-foreground">
          You're caught up. Add shows or wait for new episodes.
        </p>
      )}
      {!isLoading && sorted && sorted.length > 0 && (
        <ul className="space-y-3">
          {sorted.map((entry) => (
            <li key={entry.show.id}>
              <Link
                to={`/shows/${entry.show.id}`}
                className="border border-border rounded p-3 flex items-center gap-4 hover:bg-accent"
              >
                {entry.show.image_medium && (
                  <img
                    src={entry.show.image_medium}
                    alt=""
                    className="w-16 aspect-[2/3] object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg mb-1">{entry.show.name}</p>
                  <div className="text-xs text-muted-foreground leading-tight">
                    <p><em>Watch Next:</em></p>
                    <p>
                      S{entry.episode.season}E{entry.episode.number}
                      {entry.episode.name && (
                        <>
                          {" — "}
                          <span className="font-semibold">{entry.episode.name}</span>
                        </>
                      )}
                    </p>
                    {entry.episode.airdate && <p>{formatAirdate(entry.episode.airdate)}</p>}
                  </div>
                  <WatchProgressBar
                    watched={entry.watched_episode_count}
                    aired={entry.aired_episode_count}
                    upcoming={entry.upcoming_episode_count}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

```bash
cd tvbf-frontend && task typecheck
```

Expected: no errors. (`WatchNextPage.tsx` still exists at this point and is still wired via the router; both compile.)

---

## Task 5: Extract `UpcomingList` from `UpcomingPage`

**Files:**
- Create: `tvbf-frontend/src/components/home/UpcomingList.tsx`

- [ ] **Step 1: Create the new component**

Create `tvbf-frontend/src/components/home/UpcomingList.tsx`. Same extraction approach as Task 4 — drop the `<h1>`, keep everything else. The component is a near-verbatim copy of `UpcomingPage.tsx`'s body.

```tsx
import { useState } from "react";
import { Link } from "react-router";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { useUpcoming } from "@/api/me";
import type { UpcomingSort } from "@/api/types";
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { cn } from "@/lib/cn";
import { WatchProgressBar } from "@/components/WatchProgressBar";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatAirdate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return DATE_FMT.format(new Date(y, m - 1, d));
}

const SORTS: { key: UpcomingSort; label: string }[] = [
  { key: "airdate_asc", label: "Next Air Date" },
  { key: "added_desc", label: "Recently Added" },
  { key: "name_asc", label: "Show Title" },
];

const SORT_KEYS = SORTS.map((s) => s.key);

export function UpcomingList() {
  const [sort, setSort] = usePersistedSort<UpcomingSort>("upcoming", SORT_KEYS, "airdate_asc");
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data, isLoading } = useUpcoming(sort);
  const currentLabel = SORTS.find((s) => s.key === sort)?.label ?? "";

  return (
    <div>
      <div className="flex items-baseline justify-end mb-4">
        <DialogPrimitive.Root open={sheetOpen} onOpenChange={setSheetOpen}>
          <DialogPrimitive.Trigger
            aria-label={`Sort Upcoming (current: ${currentLabel})`}
            className="text-sm rounded border border-border px-2 py-1 bg-background hover:bg-accent inline-flex items-center gap-1"
          >
            <ArrowDown className="h-4 w-4" aria-hidden />
            <ArrowUp className="h-4 w-4 -ml-2" aria-hidden />
            <span>{currentLabel}</span>
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <DialogPrimitive.Content
              aria-describedby={undefined}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=open]:duration-200 data-[state=closed]:duration-150"
            >
              <DialogPrimitive.Title className="text-base font-semibold mb-3">
                Sort Upcoming
              </DialogPrimitive.Title>
              <ul className="flex flex-col">
                {SORTS.map((s) => {
                  const active = s.key === sort;
                  return (
                    <li key={s.key}>
                      <button
                        type="button"
                        onClick={() => {
                          setSort(s.key);
                          setSheetOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 text-left rounded px-3 py-3 text-sm hover:bg-accent",
                          active && "font-semibold",
                        )}
                      >
                        <span className="w-4 inline-flex justify-center">
                          {active && <Check className="h-4 w-4" aria-hidden />}
                        </span>
                        <span>{s.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
      {isLoading && <p>Loading…</p>}
      {!isLoading && data && data.length === 0 && (
        <p className="text-muted-foreground">No upcoming episodes scheduled for your shows.</p>
      )}
      {!isLoading && data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((entry) => (
            <li key={entry.show.id}>
              <Link
                to={`/shows/${entry.show.id}`}
                className="border border-border rounded p-3 flex items-center gap-4 hover:bg-accent"
              >
                {entry.show.image_medium && (
                  <img
                    src={entry.show.image_medium}
                    alt=""
                    className="w-16 aspect-[2/3] object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg mb-1">{entry.show.name}</p>
                  <div className="text-xs text-muted-foreground leading-tight">
                    <p><em>Upcoming:</em></p>
                    <p>
                      S{entry.episode.season}E{entry.episode.number}
                      {entry.episode.name && (
                        <>
                          {" — "}
                          <span className="font-semibold">{entry.episode.name}</span>
                        </>
                      )}
                    </p>
                    {entry.episode.airdate && <p>{formatAirdate(entry.episode.airdate)}</p>}
                  </div>
                  <WatchProgressBar
                    watched={entry.watched_episode_count}
                    aired={entry.aired_episode_count}
                    upcoming={entry.upcoming_episode_count}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

```bash
cd tvbf-frontend && task typecheck
```

Expected: no errors.

---

## Task 6: Extract `AllList` from `MyShowsPage`

**Files:**
- Create: `tvbf-frontend/src/components/home/AllList.tsx`

- [ ] **Step 1: Create the new component**

Create `tvbf-frontend/src/components/home/AllList.tsx`. Same approach — drop the `<h1>`, otherwise verbatim from `MyShowsPage`.

```tsx
import { useState } from "react";
import { Link } from "react-router";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { useMyShows } from "@/api/me";
import type { MyShowsSort } from "@/api/types";
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { cn } from "@/lib/cn";
import { WatchProgressBar } from "@/components/WatchProgressBar";

const SORTS: { key: MyShowsSort; label: string }[] = [
  { key: "recent_activity", label: "Recent activity" },
  { key: "name_asc", label: "Name A→Z" },
  { key: "name_desc", label: "Name Z→A" },
  { key: "added", label: "Recently added" },
];

const SORT_KEYS = SORTS.map((s) => s.key);

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatAirdate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return DATE_FMT.format(new Date(y, m - 1, d));
}

export function AllList() {
  const [sort, setSort] = usePersistedSort<MyShowsSort>(
    "my-shows",
    SORT_KEYS,
    "recent_activity",
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data, isLoading } = useMyShows(sort);
  const currentLabel = SORTS.find((s) => s.key === sort)?.label ?? "";

  return (
    <div>
      <div className="flex items-baseline justify-end mb-4">
        <DialogPrimitive.Root open={sheetOpen} onOpenChange={setSheetOpen}>
          <DialogPrimitive.Trigger
            aria-label={`Sort My Shows (current: ${currentLabel})`}
            className="text-sm rounded border border-border px-2 py-1 bg-background hover:bg-accent inline-flex items-center gap-1"
          >
            <ArrowDown className="h-4 w-4" aria-hidden />
            <ArrowUp className="h-4 w-4 -ml-2" aria-hidden />
            <span>{currentLabel}</span>
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <DialogPrimitive.Content
              aria-describedby={undefined}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=open]:duration-200 data-[state=closed]:duration-150"
            >
              <DialogPrimitive.Title className="text-base font-semibold mb-3">
                Sort My Shows
              </DialogPrimitive.Title>
              <ul className="flex flex-col">
                {SORTS.map((s) => {
                  const active = s.key === sort;
                  return (
                    <li key={s.key}>
                      <button
                        type="button"
                        onClick={() => {
                          setSort(s.key);
                          setSheetOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 text-left rounded px-3 py-3 text-sm hover:bg-accent",
                          active && "font-semibold",
                        )}
                      >
                        <span className="w-4 inline-flex justify-center">
                          {active && <Check className="h-4 w-4" aria-hidden />}
                        </span>
                        <span>{s.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
      {isLoading && <p>Loading…</p>}
      {!isLoading && data && data.length === 0 && (
        <p className="text-muted-foreground">Nothing here yet. Search for shows and add them to your list.</p>
      )}
      {!isLoading && data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((entry) => (
            <li key={entry.show.id}>
              <Link
                to={`/shows/${entry.show.id}`}
                className="border border-border rounded p-3 flex items-center gap-4 hover:bg-accent"
              >
                {entry.show.image_medium && (
                  <img
                    src={entry.show.image_medium}
                    alt=""
                    className="w-16 aspect-[2/3] object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg mb-1">{entry.show.name}</p>
                  <div className="text-xs text-muted-foreground leading-tight">
                    <p>
                      <em>Premiered:</em>{" "}
                      {entry.show.premiered ? formatAirdate(entry.show.premiered) : "—"}
                    </p>
                    <p>
                      <em>Last Aired:</em>{" "}
                      {entry.last_aired ? formatAirdate(entry.last_aired) : "—"}
                    </p>
                  </div>
                  <WatchProgressBar
                    watched={entry.watched_episode_count}
                    aired={entry.aired_episode_count}
                    upcoming={entry.upcoming_episode_count}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

```bash
cd tvbf-frontend && task typecheck
```

Expected: no errors.

---

## Task 7: Create `WatchedList`

**Files:**
- Create: `tvbf-frontend/src/components/home/WatchedList.tsx`

- [ ] **Step 1: Create the new component**

Create `tvbf-frontend/src/components/home/WatchedList.tsx`. This is a new component — there's no existing page to extract from. It uses `useMyShows()` (so it shares the cache with `AllList`) but filters and sorts client-side with its own persistence key.

```tsx
import { useMemo, useState } from "react";
import { Link } from "react-router";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { useMyShows } from "@/api/me";
import type { MyShowEntry, WatchedSort } from "@/api/types";
import { usePersistedSort } from "@/hooks/usePersistedSort";
import { cn } from "@/lib/cn";

const SORTS: { key: WatchedSort; label: string }[] = [
  { key: "last_watched_desc", label: "Last Watched" },
  { key: "added_desc", label: "Recently Added" },
  { key: "name_asc", label: "Name A→Z" },
  { key: "name_desc", label: "Name Z→A" },
];

const SORT_KEYS = SORTS.map((s) => s.key);

const nameKey = (s: string) => s.toLowerCase().replace(/^(the|a|an)\s+/i, "");

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(iso: string): string {
  // last_watched_at is a full ISO datetime; take the date portion.
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return DATE_FMT.format(new Date(y, m - 1, d));
}

function isCaughtUp(entry: MyShowEntry): boolean {
  return (
    entry.aired_episode_count > 0 &&
    entry.watched_episode_count >= entry.aired_episode_count
  );
}

function compareEntries(a: MyShowEntry, b: MyShowEntry, sort: WatchedSort): number {
  const tiebreak = nameKey(a.show.name).localeCompare(nameKey(b.show.name));
  const cmpNullable = (av: string | null | undefined, bv: string | null | undefined, desc: boolean) => {
    if (!av && !bv) return tiebreak;
    if (!av) return 1;
    if (!bv) return -1;
    return desc ? bv.localeCompare(av) : av.localeCompare(bv);
  };
  switch (sort) {
    case "last_watched_desc":
      return cmpNullable(a.last_watched_at, b.last_watched_at, true) || tiebreak;
    case "added_desc":
      return cmpNullable(a.added_at, b.added_at, true) || tiebreak;
    case "name_asc":
      return tiebreak;
    case "name_desc":
      return -tiebreak;
  }
}

export function WatchedList() {
  // Use the default `recent_activity` sort upstream — we filter and re-sort here.
  const [sort, setSort] = usePersistedSort<WatchedSort>(
    "watched",
    SORT_KEYS,
    "last_watched_desc",
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data, isLoading } = useMyShows();
  const filteredAndSorted = useMemo(() => {
    if (!data) return data;
    return data.filter(isCaughtUp).sort((a, b) => compareEntries(a, b, sort));
  }, [data, sort]);
  const currentLabel = SORTS.find((s) => s.key === sort)?.label ?? "";

  return (
    <div>
      <div className="flex items-baseline justify-end mb-4">
        <DialogPrimitive.Root open={sheetOpen} onOpenChange={setSheetOpen}>
          <DialogPrimitive.Trigger
            aria-label={`Sort Watched (current: ${currentLabel})`}
            className="text-sm rounded border border-border px-2 py-1 bg-background hover:bg-accent inline-flex items-center gap-1"
          >
            <ArrowDown className="h-4 w-4" aria-hidden />
            <ArrowUp className="h-4 w-4 -ml-2" aria-hidden />
            <span>{currentLabel}</span>
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <DialogPrimitive.Content
              aria-describedby={undefined}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=open]:duration-200 data-[state=closed]:duration-150"
            >
              <DialogPrimitive.Title className="text-base font-semibold mb-3">
                Sort Watched
              </DialogPrimitive.Title>
              <ul className="flex flex-col">
                {SORTS.map((s) => {
                  const active = s.key === sort;
                  return (
                    <li key={s.key}>
                      <button
                        type="button"
                        onClick={() => {
                          setSort(s.key);
                          setSheetOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 text-left rounded px-3 py-3 text-sm hover:bg-accent",
                          active && "font-semibold",
                        )}
                      >
                        <span className="w-4 inline-flex justify-center">
                          {active && <Check className="h-4 w-4" aria-hidden />}
                        </span>
                        <span>{s.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
      {isLoading && <p>Loading…</p>}
      {!isLoading && filteredAndSorted && filteredAndSorted.length === 0 && (
        <p className="text-muted-foreground">
          Nothing here yet — finish a show to see it here.
        </p>
      )}
      {!isLoading && filteredAndSorted && filteredAndSorted.length > 0 && (
        <ul className="space-y-3">
          {filteredAndSorted.map((entry) => (
            <li key={entry.show.id}>
              <Link
                to={`/shows/${entry.show.id}`}
                className="border border-border rounded p-3 flex items-center gap-4 hover:bg-accent"
              >
                {entry.show.image_medium && (
                  <img
                    src={entry.show.image_medium}
                    alt=""
                    className="w-16 aspect-[2/3] object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg mb-1">{entry.show.name}</p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    Caught up
                    {entry.last_watched_at && (
                      <> · last watched {formatDate(entry.last_watched_at)}</>
                    )}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

```bash
cd tvbf-frontend && task typecheck
```

Expected: no errors.

---

## Task 8: Create `HomePage`

**Files:**
- Create: `tvbf-frontend/src/pages/HomePage.tsx`

- [ ] **Step 1: Create the page component**

`HomePage` resolves the active tab from `pathname`, eagerly fetches Watch Next + Upcoming for count badges, renders a sticky tab bar, and dispatches to the matching list component.

```tsx
import { NavLink, useLocation } from "react-router";
import { useMyShows, useUpcoming, useWatchNext } from "@/api/me";
import { cn } from "@/lib/cn";
import { WatchNextList } from "@/components/home/WatchNextList";
import { UpcomingList } from "@/components/home/UpcomingList";
import { AllList } from "@/components/home/AllList";
import { WatchedList } from "@/components/home/WatchedList";

type TabKey = "watch-next" | "upcoming" | "all" | "watched";

const TAB_BY_PATH: Record<string, TabKey> = {
  "/": "watch-next",
  "/upcoming": "upcoming",
  "/all": "all",
  "/watched": "watched",
};

export function HomePage() {
  const location = useLocation();
  const tab: TabKey = TAB_BY_PATH[location.pathname] ?? "watch-next";

  // Eager fetches for tab count badges. The active tab also reads from these
  // caches via its own hook call — react-query dedupes.
  const watchNext = useWatchNext();
  const upcoming = useUpcoming();
  // Prime the my-shows cache so AllList/WatchedList render fast on switch.
  useMyShows();

  const watchNextCount = watchNext.data?.length;
  const upcomingCount = upcoming.data?.length;

  const tabLink = (key: TabKey, to: string, label: string, count?: number) => (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "px-3 py-2 text-sm whitespace-nowrap border-b-2",
          isActive
            ? "font-semibold border-foreground text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )
      }
      aria-current={tab === key ? "page" : undefined}
    >
      {label}
      {typeof count === "number" && <span className="ml-1">({count})</span>}
    </NavLink>
  );

  return (
    <div>
      <nav
        aria-label="Home tabs"
        className="sticky top-0 z-10 -mx-4 px-4 mb-4 bg-background border-b border-border overflow-x-auto"
      >
        <div className="flex">
          {tabLink("watch-next", "/", "Watch Next", watchNextCount)}
          {tabLink("upcoming", "/upcoming", "Upcoming", upcomingCount)}
          {tabLink("all", "/all", "All")}
          {tabLink("watched", "/watched", "Watched")}
        </div>
      </nav>
      {tab === "watch-next" && <WatchNextList />}
      {tab === "upcoming" && <UpcomingList />}
      {tab === "all" && <AllList />}
      {tab === "watched" && <WatchedList />}
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

```bash
cd tvbf-frontend && task typecheck
```

Expected: no errors.

---

## Task 9: Wire the router and delete old pages

**Files:**
- Modify: `tvbf-frontend/src/router.tsx`
- Delete: `tvbf-frontend/src/pages/MyShowsPage.tsx`
- Delete: `tvbf-frontend/src/pages/WatchNextPage.tsx`
- Delete: `tvbf-frontend/src/pages/UpcomingPage.tsx`

- [ ] **Step 1: Replace the router file**

```tsx
import { createBrowserRouter, Navigate } from "react-router";
import { AppShell } from "@/components/AppShell";
import { SearchPage } from "@/pages/SearchPage";
import { ShowDetailPage } from "@/pages/ShowDetailPage";
import { EpisodesPage } from "@/pages/EpisodesPage";
import { EpisodePage } from "@/pages/EpisodePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { RequireAuth } from "@/components/RequireAuth";
import { HomePage } from "@/pages/HomePage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { path: "login", element: <LoginPage /> },
      { path: "signup", element: <SignupPage /> },
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "upcoming", element: <HomePage /> },
          { path: "all", element: <HomePage /> },
          { path: "watched", element: <HomePage /> },
          // Redirects from old paths.
          { path: "watch-next", element: <Navigate to="/" replace /> },
          { path: "my-shows", element: <Navigate to="/" replace /> },
          { path: "search", element: <SearchPage /> },
          { path: "shows/:id", element: <ShowDetailPage /> },
          { path: "shows/:id/episodes", element: <EpisodesPage /> },
          { path: "episodes/:episodeId", element: <EpisodePage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
```

- [ ] **Step 2: Delete the three old page files**

```bash
rm tvbf-frontend/src/pages/MyShowsPage.tsx
rm tvbf-frontend/src/pages/WatchNextPage.tsx
rm tvbf-frontend/src/pages/UpcomingPage.tsx
```

- [ ] **Step 3: Typecheck and lint**

```bash
cd tvbf-frontend && task typecheck && task lint
```

Expected: no errors. If lint flags an unused import in `router.tsx` or any test file that imported the deleted pages, fix the import.

---

## Task 10: Rewrite `AppShell` (icon nav + mobile bottom bar)

**Files:**
- Modify: `tvbf-frontend/src/components/AppShell.tsx`

- [ ] **Step 1: Replace the `AppShell` component**

Replace the entire file with the icon-based nav. Removes hamburger drawer + `menuOpen` state; adds Home/Search/UserMenu icon row to desktop header; adds fixed mobile bottom tab bar (auth-gated).

```tsx
import { useCallback, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { Home as HomeIcon, Search as SearchIcon } from "lucide-react";
import { useAuth } from "./AuthContext";
import { UserMenu } from "./UserMenu";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { cn } from "@/lib/cn";

const HOME_PATHS = new Set(["/", "/upcoming", "/all", "/watched"]);

export function AppShell() {
  const { user } = useAuth();
  const location = useLocation();
  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const onHomeTab = HOME_PATHS.has(location.pathname);

  const handleHomeClick = useCallback(
    (e: React.MouseEvent) => {
      if (onHomeTab) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        // Let NavLink navigate to "/" normally.
      }
    },
    [onHomeTab],
  );

  // The icon trio used in both the desktop header and the mobile bottom bar.
  const iconNav = (placement: "header" | "bottom") => {
    const iconCls =
      placement === "header"
        ? "inline-flex items-center justify-center h-9 w-9 rounded hover:bg-accent"
        : "flex flex-col items-center justify-center flex-1 py-2 text-xs gap-0.5";
    const activeCls =
      placement === "header"
        ? "text-foreground bg-accent"
        : "text-foreground";
    const inactiveCls = "text-muted-foreground hover:text-foreground";
    return (
      <>
        <NavLink
          to="/"
          end={false}
          onClick={handleHomeClick}
          className={({ isActive }) =>
            cn(iconCls, (isActive || onHomeTab) ? activeCls : inactiveCls)
          }
          aria-label="Home"
        >
          <HomeIcon className="h-5 w-5" aria-hidden />
          {placement === "bottom" && <span>Home</span>}
        </NavLink>
        <NavLink
          to="/search"
          className={({ isActive }) =>
            cn(iconCls, isActive ? activeCls : inactiveCls)
          }
          aria-label="Search"
        >
          <SearchIcon className="h-5 w-5" aria-hidden />
          {placement === "bottom" && <span>Search</span>}
        </NavLink>
        <UserMenu
          onChangePassword={() => setPwOpen(true)}
          onDeleteAccount={() => setDelOpen(true)}
          variant={placement === "header" ? "icon" : "bottom-tab"}
        />
      </>
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold">
            TV Binge Friend
          </Link>
          {user && (
            <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
              {iconNav("header")}
            </nav>
          )}
        </div>
      </header>

      <main className={cn("mx-auto w-full max-w-6xl flex-1 px-4 py-6", user && "pb-20 md:pb-6")}>
        <Outlet />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground">
          TV data and images provided by{" "}
          <a
            href="https://www.tvmaze.com"
            target="_blank"
            rel="noreferrer noopener"
            className="underline hover:text-foreground"
          >
            TVmaze
          </a>
          , licensed under{" "}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noreferrer noopener"
            className="underline hover:text-foreground"
          >
            CC BY-SA 4.0
          </a>
          .
        </div>
      </footer>

      {user && (
        <nav
          aria-label="Primary"
          className="md:hidden fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
        >
          {iconNav("bottom")}
        </nav>
      )}

      <ChangePasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
      <DeleteAccountDialog open={delOpen} onClose={() => setDelOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Replace `UserMenu` with a variant-aware version**

Replace `tvbf-frontend/src/components/UserMenu.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { User as UserIcon } from "lucide-react";
import { useAuth } from "./AuthContext";
import { cn } from "@/lib/cn";

type UserMenuProps = {
  onChangePassword: () => void;
  onDeleteAccount: () => void;
  variant?: "icon" | "bottom-tab";
};

export function UserMenu({
  onChangePassword,
  onDeleteAccount,
  variant = "icon",
}: UserMenuProps) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  if (!user) return null;

  const triggerCls =
    variant === "bottom-tab"
      ? cn(
          "flex flex-col items-center justify-center flex-1 py-2 text-xs gap-0.5",
          open ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )
      : cn(
          "inline-flex items-center justify-center h-9 w-9 rounded hover:bg-accent",
          open ? "text-foreground bg-accent" : "text-muted-foreground hover:text-foreground",
        );

  // Bottom-tab menu opens upward so it doesn't get clipped by the screen edge.
  const menuPositionCls =
    variant === "bottom-tab"
      ? "absolute right-0 bottom-full mb-2 w-48"
      : "absolute right-0 mt-2 w-48";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.display_name}`}
        className={triggerCls}
      >
        <UserIcon className="h-5 w-5" aria-hidden />
        {variant === "bottom-tab" && <span>Account</span>}
      </button>
      {open && (
        <ul
          role="menu"
          className={cn(
            menuPositionCls,
            "rounded border border-border bg-background shadow z-50",
          )}
        >
          <li className="px-3 py-2 text-xs text-muted-foreground border-b border-border">
            Signed in as {user.display_name}
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onChangePassword();
              }}
              className="w-full text-left px-3 py-2 hover:bg-muted"
            >
              Change password
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDeleteAccount();
              }}
              className="w-full text-left px-3 py-2 hover:bg-muted"
            >
              Delete account
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                setOpen(false);
                await logout();
              }}
              className="w-full text-left px-3 py-2 hover:bg-muted"
            >
              Log out
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck, lint, and run existing tests**

```bash
cd tvbf-frontend && task typecheck && task lint && task test
```

Expected: all green. If `LoginPage.test.tsx` or `SignupPage.test.tsx` fail because they assumed specific nav text, update them — the nav is icons now.

---

## Task 11: Update tests for the new structure

**Files:**
- Modify (if needed): `tvbf-frontend/src/pages/ShowDetailPage.test.tsx` — add MSW handler for `/me/watch-next` and `/me/upcoming` if not already present.
- Create: `tvbf-frontend/src/pages/HomePage.test.tsx`

- [ ] **Step 1: Audit test MSW handlers**

```bash
grep -rn "msw\|setupServer\|http.get" tvbf-frontend/src --include="*.test.tsx" --include="*.test.ts" | head -20
```

For each test that mounts the app shell or any component that invokes `useMyShows`, `useWatchNext`, or `useUpcoming`, ensure handlers exist for `/me/shows`, `/me/watch-next`, and `/me/upcoming`. The existing MSW warning in `ShowDetailPage.test.tsx` (`intercepted a request without a matching request handler … /me/watch-next`) is a known gap from prior work; close it now. Look at how other tests register handlers and follow the same pattern.

- [ ] **Step 2: Write `HomePage.test.tsx`**

Create `tvbf-frontend/src/pages/HomePage.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { AppShell } from "@/components/AppShell";
import { HomePage } from "@/pages/HomePage";
import { AuthProvider } from "@/components/AuthContext";

const API = "https://api.tvbf.localhost";

const handlers = [
  http.get(`${API}/me`, () =>
    HttpResponse.json({
      id: "u1",
      email: "t@example.com",
      display_name: "T",
      created_at: "2026-01-01T00:00:00Z",
      csrf_token: "x",
    }),
  ),
  http.get(`${API}/me/shows`, () => HttpResponse.json([])),
  http.get(`${API}/me/watch-next`, () => HttpResponse.json([])),
  http.get(`${API}/me/upcoming`, () => HttpResponse.json([])),
];

const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "upcoming", element: <HomePage /> },
          { path: "all", element: <HomePage /> },
          { path: "watched", element: <HomePage /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("HomePage", () => {
  it("renders the Watch Next tab at /", async () => {
    renderAt("/");
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Watch Next/i })).toHaveAttribute("aria-current", "page");
    });
    expect(screen.getByText(/You're caught up/i)).toBeInTheDocument();
  });

  it("renders the Upcoming tab at /upcoming", async () => {
    renderAt("/upcoming");
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /^Upcoming/i })).toHaveAttribute("aria-current", "page");
    });
    expect(screen.getByText(/No upcoming episodes/i)).toBeInTheDocument();
  });

  it("renders the All tab at /all", async () => {
    renderAt("/all");
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /^All$/i })).toHaveAttribute("aria-current", "page");
    });
    expect(screen.getByText(/Nothing here yet/i)).toBeInTheDocument();
  });

  it("renders the Watched tab at /watched", async () => {
    renderAt("/watched");
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /^Watched$/i })).toHaveAttribute("aria-current", "page");
    });
    expect(screen.getByText(/finish a show/i)).toBeInTheDocument();
  });

  it("shows count badges on Watch Next and Upcoming when data is present", async () => {
    server.use(
      http.get(`${API}/me/watch-next`, () =>
        HttpResponse.json([
          {
            show: { id: 1, name: "S", type: null, status: null, language: null, premiered: null, ended: null, image_medium: null, image_original: null, network: null, web_channel: null, genres: [] },
            episode: { id: 10, show_id: 1, season_id: null, season: 1, number: 1, name: null, airdate: null, airtime: null, runtime: null, summary: null, image_medium: null, image_original: null },
            last_watched_at: null,
            last_aired: null,
            watched_episode_count: 0,
            aired_episode_count: 1,
            upcoming_episode_count: 0,
            added_at: null,
          },
        ]),
      ),
      http.get(`${API}/me/upcoming`, () =>
        HttpResponse.json([
          {
            show: { id: 2, name: "T", type: null, status: null, language: null, premiered: null, ended: null, image_medium: null, image_original: null, network: null, web_channel: null, genres: [] },
            episode: { id: 20, show_id: 2, season_id: null, season: 1, number: 1, name: null, airdate: null, airtime: null, runtime: null, summary: null, image_medium: null, image_original: null },
            watched_episode_count: 0,
            aired_episode_count: 0,
            upcoming_episode_count: 1,
            added_at: null,
          },
        ]),
      ),
    );
    renderAt("/");
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Watch Next \(1\)/ })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Upcoming \(1\)/ })).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 3: Run frontend tests and verify all green**

```bash
cd tvbf-frontend && task test
```

Expected: all tests pass. If `LoginPage.test.tsx` or `SignupPage.test.tsx` reference removed nav text or pages, update those tests to assert on the new icon-based nav (e.g., look for `aria-label="Home"` instead of "Watch Next" link text).

---

## Task 12: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Backend full check**

```bash
cd tvbf-backend && task lint && task typecheck && task test
```

Expected: all green.

- [ ] **Step 2: Frontend full check**

```bash
cd tvbf-frontend && task lint && task typecheck && task test
```

Expected: all green.

- [ ] **Step 3: Manual smoke test in the browser**

The user will start the stack and walk through:

1. `task infra:up` (from either project) — Postgres + Traefik running.
2. `cd tvbf-backend && task up && task migrate`.
3. `cd tvbf-frontend && task up`.
4. Visit `https://tvbf.localhost`. Confirm:
   - Logged in, lands on `/` showing Watch Next tab with the tab bar above the list.
   - Tab bar shows "Watch Next (N)" and "Upcoming (N)" with counts; "All" and "Watched" with no count.
   - Clicking each tab navigates to the corresponding URL and renders the right list.
   - Old paths `/my-shows` and `/watch-next` redirect to `/`.
   - On desktop, the top header shows app title + three icons on the right; no text links.
   - On mobile (DevTools responsive), top header shows just the title; bottom tab bar with three icons appears at the bottom; main content has padding so the last item isn't covered.
   - Tapping the Home icon while on `/upcoming` navigates to `/` (different path). Tapping while on `/` scrolls to top.
   - Marking an episode watched on the show detail page invalidates the queries — counts on the Home tabs update on next visit.
   - On Watched tab, a fully-caught-up show appears with "Caught up · last watched <date>".

If any step fails, fix and re-run typecheck + tests before declaring complete.
