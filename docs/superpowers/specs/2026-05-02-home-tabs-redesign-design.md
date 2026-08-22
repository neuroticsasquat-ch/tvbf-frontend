# Home Tabs Redesign

**Status:** Approved
**Date:** 2026-05-02

## Problem

The frontend currently exposes four sibling top-level pages — Watch Next, Upcoming, My Shows, and Search — plus a user menu. Watch Next, Upcoming, and My Shows are all views into the same underlying entity (the user's tracked shows), so giving each a distinct top-level slot in the navigation:

- creates four equally-weighted destinations when only two of them ("stuff to watch now", "stuff coming up") are actionable day-to-day,
- makes "completed shows you've finished" invisible — there is no view for caught-up shows today,
- duplicates header real estate that could be a single primary destination ("your shows") with internal filters.

We want one consolidated **Home** destination with internal tabs that filter the same underlying My-Shows data, and a simplified primary nav of three icons: Home, Search, user menu.

## Goals

- Collapse Watch Next / Upcoming / My Shows into one Home page with four tabs: **Watch Next**, **Upcoming**, **All**, **Watched**.
- Surface a "Watched" view (shows where every aired episode is watched) — currently impossible.
- Reduce the primary nav to three icons: Home, Search, user-menu trigger.
- Add a mobile bottom tab bar (icon-only) so the primary destinations are reachable with one thumb.
- Preserve the existing per-row content on Watch Next and Upcoming (next episode info), and the existing sort menus and persisted sort preferences.

## Non-goals

- No backend filtering endpoint for the Watched bucket — it's a client-side derivation from existing My-Shows data.
- No tab-count badges on All or Watched (decoration only; would just add fetches).
- No new authentication, no changes to `/search`, `/shows/:id`, `/login`, `/signup`.
- No changes to admin / catalog / browse endpoints.
- No analytics events.

## User-facing changes

### Routes

| Path | Behavior |
|------|----------|
| `/` | Home, **Watch Next** tab (default landing) |
| `/upcoming` | Home, Upcoming tab |
| `/all` | Home, All tab |
| `/watched` | Home, Watched tab |
| `/my-shows` | Redirect → `/` |
| `/watch-next` | Redirect → `/` |
| `/search` | Unchanged |
| `/shows/:id` | Unchanged |
| `/login`, `/signup` | Unchanged; do **not** render Home shell or bottom bar |

All Home routes are auth-gated identically to the current pages.

### Primary navigation

Three icon buttons, used in both the desktop top header and the mobile bottom tab bar:

| Icon | Source | Action |
|------|--------|--------|
| House | `lucide-react` `Home` | If on `/`, `/upcoming`, `/all`, or `/watched` → scroll window to top (no nav). Otherwise → navigate to `/`. |
| Magnifying glass | `lucide-react` `Search` | Navigate to `/search`. |
| User menu | Existing `UserMenu` component | Opens popover (display name, change password, delete account, log out). On mobile this is the same `UserMenu`, just triggered from the bottom bar. |

**Active state:** Home icon highlighted whenever `pathname` is `/`, `/upcoming`, `/all`, or `/watched`. Search icon highlighted on `/search` and `/shows/:id`. User-menu icon is never "active" — it's a button, not a route.

**Desktop:** the three icons sit on the right of the top header, replacing the four existing text links (`Watch Next`, `Upcoming`, `My Shows`, `Search`) and the existing inline `<UserMenu />`. App title (`TV Binge Friend`) stays on the left of the header.

**Mobile:** top header is reduced to just the app title link. The three icons live in a fixed bottom tab bar:
- `fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background`
- `pb-[env(safe-area-inset-bottom)]`
- Each icon: 44px+ tap target, vertically centered, with a small label underneath (`Home`, `Search`, account display name's first initial — same letter the existing `UserMenu` uses).
- The bottom bar renders **only when `user` is non-null** (same gate that wraps the current nav-link block).
- `<main>` gets `pb-16 md:pb-0` so list content scrolls above the bar.

The current mobile hamburger drawer (`menuOpen` state, drawer markup, `<svg>` icons) is removed.

### Home page

`HomePage` is a single component at `src/pages/HomePage.tsx`. It:

1. Reads `pathname` to determine the active tab (`/` → watch-next, `/upcoming` → upcoming, `/all` → all, `/watched` → watched).
2. Eagerly invokes `useWatchNext()` and `useUpcoming()` on mount so tab count badges populate without waiting for a tab switch. The active tab also renders its list from the same query.
3. Renders a sticky tab bar followed by the active list component.

**Tab bar:**
- `sticky top-0 z-10 bg-background border-b border-border`
- Order: **Watch Next**, **Upcoming**, **All**, **Watched**.
- Each tab is a `<NavLink>` to its corresponding path. Active tab styled with bold text and a 2px bottom border in `border-foreground`; inactive tabs use `text-muted-foreground`.
- On narrow viewports the row is horizontally scrollable (`overflow-x-auto`, `whitespace-nowrap`); on `md+` it's a flex row.
- **Counts:** only on Watch Next and Upcoming, format `Watch Next (3)`. Count is hidden until the corresponding query resolves (no `0` flicker, no skeleton). If the query errors, the bare label shows.

**Per-tab list components** (under `src/components/home/`):

| Component | Data source | Row content |
|-----------|-------------|-------------|
| `WatchNextList` | `useWatchNext()` | image · name · "Watch Next:" + S/E + episode name + airdate · `WatchProgressBar` |
| `UpcomingList` | `useUpcoming(sort)` | image · name · "Upcoming:" + S/E + episode name + airdate · `WatchProgressBar` |
| `AllList` | `useMyShows(sort)` | image · name · Premiered + Last Aired · `WatchProgressBar` |
| `WatchedList` | `useMyShows(sort)` filtered to `aired_episode_count > 0 && watched_episode_count >= aired_episode_count` | image · name · "Caught up · last watched {date}" · **no progress bar** |

`AllList` and `WatchedList` share the `["my-shows", sort]` query — react-query dedupes — but they keep **independent sort menus and persistence keys**. The All tab keeps the existing four sorts and `tvbf:sort:my-shows` key. The Watched tab gets its own key `tvbf:sort:watched` with these options:

- `last_watched_desc` ("Last watched") — default, sorts by `last_watched_at` descending; null → bottom.
- `name_asc` ("Name A→Z")
- `name_desc` ("Name Z→A")
- `added_desc` ("Recently added")

The four existing page files (`MyShowsPage.tsx`, `WatchNextPage.tsx`, `UpcomingPage.tsx`) are deleted; their bodies move into the four list components verbatim, then `WatchedList` is added.

**Empty states:**
- Watch Next: existing copy ("You're caught up. Add shows or wait for new episodes.")
- Upcoming: existing copy ("No upcoming episodes scheduled for your shows.")
- All: existing copy ("Nothing here yet. Search for shows and add them to your list.")
- Watched: **new** — "Nothing here yet — finish a show to see it here."

## Data model

### Backend

Add `last_watched_at: datetime | None = None` to the `MyShowEntry` DTO (`src/tvbf/app/dto.py`). Populate in `my_shows_service.list_my_shows` using `episode_watch_repo.latest_watched_per_show` (the same helper Watch Next already uses). No new endpoint, no new repository method.

### Frontend types

Mirror on `src/api/types.ts`:

```ts
export interface MyShowEntry {
  // ...existing fields
  last_watched_at: string | null;
}
```

Update `placeholderMyShowEntry` in `src/api/me.ts` with `last_watched_at: null`.

Add to `src/api/types.ts`:

```ts
export type WatchedSort = "last_watched_desc" | "name_asc" | "name_desc" | "added_desc";
```

### "Watched" derivation (client-side)

```ts
const watched = (data ?? []).filter(
  (e) => e.aired_episode_count > 0 && e.watched_episode_count >= e.aired_episode_count,
);
```

This includes ongoing shows where the user is currently caught up. The tab membership churns naturally as new episodes air and as the user marks them watched, which matches the agreed semantics ("am I current?").

## Implementation order

Each step is independently testable; the user commits between steps on their own cadence.

1. **Backend.** Add `last_watched_at` to `MyShowEntry`; populate in `list_my_shows`. Run `task typecheck`, `task test -- tests/integration/app/services/test_my_shows_service.py tests/unit/app/services/test_my_shows_pure.py`.
2. **Frontend types.** Mirror `last_watched_at`, update `placeholderMyShowEntry`, add `WatchedSort` type. `task typecheck`.
3. **Extract list components.** Move existing page bodies into `src/components/home/{WatchNextList,UpcomingList,AllList}.tsx` (no behavior changes). Add `src/components/home/WatchedList.tsx`. Old page files still imported by router; tests still passing.
4. **`HomePage` shell.** New `src/pages/HomePage.tsx` with the sticky tab bar, active-tab-from-URL logic, and eager Watch Next + Upcoming fetches for count badges. Renders the matching list component.
5. **Router.** Wire `/`, `/upcoming`, `/all`, `/watched` to `HomePage`. Add redirects for `/my-shows` and `/watch-next` → `/`. Delete the four old page files. Update or delete `LoginPage.test.tsx`'s post-login redirect assertion if it changes (it should still expect `/`).
6. **AppShell rewrite.** Replace top text links with three icon buttons (Home, Search, user-menu trigger). Remove hamburger drawer + `menuOpen` state. Add mobile bottom tab bar (fixed, safe-area inset, gated on `user`). Add `pb-16 md:pb-0` to `<main>`. Implement Home-icon scroll-to-top behavior.
7. **Tests.** Update existing page tests to import the new list components. Add `HomePage.test.tsx` covering: each path renders the correct list, tab count badges appear after fetch resolves, Home-icon click on a Home path scrolls instead of navigating. Add MSW handlers for `/me/watch-next` and `/me/upcoming` to any test that mounts `HomePage` (the eager fetches will hit them).

## Risks & considerations

- **Mobile bottom bar on auth pages.** Bar must not render on `/login` or `/signup` — gate on `user` truthiness, same as the current authenticated nav block.
- **Sticky tab bar + sticky bottom bar on short viewports.** On a small phone in landscape, the visible content area shrinks. Eyeball in iOS Safari sim during step 6; if too cramped, consider non-sticky tab bar as a fallback.
- **MSW handler coverage.** Eager fetches of Watch Next + Upcoming on every Home mount will surface missing MSW handlers in tests that previously only mocked one endpoint (a stray warning is already visible in `ShowDetailPage.test.tsx`). Audit during step 7.
- **Persisted sort keys.** Existing users keep `tvbf:sort:watch-next`, `tvbf:sort:upcoming`, `tvbf:sort:my-shows`. New users — and existing users on Watched — get `tvbf:sort:watched` defaulting to `last_watched_desc`.
- **Conventional Commits.** All commits the user makes from this work must follow Conventional Commits format (repo convention).

## Out of scope (explicit non-goals revisited)

- No `/me/watched` endpoint. The client filters.
- No counts on All / Watched tabs.
- No analytics.
- No changes to the show-detail page, episode-watch endpoints, search, login/signup flows, or admin endpoints.
