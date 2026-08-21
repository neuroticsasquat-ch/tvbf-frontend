# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

This is the **frontend** repo for **TV Binge Friend**, a web app for tracking TV watching with a
social layer (accepted/pending/blocked connections + friend-scoped show/episode activity). It is a
React 19 + Vite 6 + TypeScript + Tailwind v4 + shadcn/ui SPA: a read+write app covering
signup/login, browse/search, show/season/episode pages, My Shows, Watch Next, Upcoming, watch
tracking, ratings, friends and recommendations.

Its sibling is **[`tvbf-backend`](https://github.com/neuroticsasquat-ch/tvbf-backend)** — a FastAPI
service holding the TMDB catalog mirror and every API this SPA calls. It carries its own
`.claude/CLAUDE.md`, and that file is the reference for anything server-side. Both repos are cloned
side by side under one parent directory, alongside `tbc-localdev-infra`:

```
<parent>/
  tvbf-frontend/    <- you are here
  tvbf-backend/
  tbc-localdev-infra/
```

Nothing outside this repo is required to work in it. There is no umbrella-level `CLAUDE.md` or
`docs/` any more — everything relocated into the two repos on 2026-08-20 so a `git clone` is
sufficient on a new machine.

- `docs/specs/` — approved design specs. **`specs_dir: docs`** (repo-relative). **Frontend-only**
  specs live here — the ones whose `**Repo:**` header says `tvbf-frontend`, which is what the
  split was made on.
  **A spec that is a cross-repo contract belongs in `tvbf-backend/docs/specs/` instead**, even
  when the work is shared: that is where the frontend half cites the request/response shape by
  URL. NEU-1031 drew that rule and the relocation kept it. The three project specs
  (`tvbf-*-project-spec.md`) are in the backend repo for the same reason — both repos cite them.
- `docs/plans/` — implementation plans, when a spec needs a separate one.
- `docs/superpowers/{specs,plans}/` — the retired layout, kept as an archive. It holds only the
  two frontend-only pairs (`2026-04-19-frontend-mvp`, `2026-05-02-home-tabs-redesign`); the
  cross-stack pairs from that era are in `tvbf-backend/docs/superpowers/`. New docs go to the flat
  paths above.

**Specs written before 2026-08-20 say they "live in the umbrella `docs/`".** That directory is
gone; read those sentences as "this repo's `docs/specs/`". The rationale each one gives — that
nothing in another repo cites it — is still the rule; only the two homes it chose between were
renamed.

**Linear home** (for `/personal:projectit`, per `spec-and-plan-convention.md`):

- `linear_initiative: TV BingeFriend`
- `linear_team: Neuroticsasquatch`
- `linear_repos: tvbf-backend, tvbf-frontend`

The `repo:<name>` label `loop.py` filters on is derived per repo from its own git remote basename,
so it is `repo:tvbf-frontend` here — the name above must match.

## Hard constraints

- **Git is allowed here, within limits.** Branching, staging, committing and pushing are fine to do without asking, including from subagents. Never commit directly to `main`, cut a branch first. Destructive operations — `reset --hard`, `push --force`, branch deletion, history rewriting — still need explicit confirmation every time.
- **Containerization is non-negotiable. There is no local Node toolchain.** Every `pnpm`/`vite`/`tsc`/`eslint`/`vitest` invocation runs inside the `tvbf_frontend` container, which uses pnpm 9. `task` targets wrap `docker compose exec` — use them.
- **The shared localdev infra at `../tbc-localdev-infra/` must be running first.** That compose project owns `tbc_postgresql_db`, Traefik (TLS termination for `*.localhost`), Mailpit, and the external `proxy` Docker network this SPA joins. If Traefik isn't up, nothing here works. Start it with `task infra:up` (namespace comes from an include in `Taskfile.yml`).
- **The backend must be running for anything past the login screen.** `cd ../tvbf-backend && task up`. Its `task` commands run from that repo, not this one.

## Commands

All `task` commands run from this repo's root.

- `task up` / `task down` / `task build` — docker compose up/down/build
- `task logs` — follow (Ctrl+C to stop, container keeps running)
- `task shell` — shell inside the container
- `task install` — install dependencies via pnpm inside the container
- `task infra:up` / `task infra:down` — wraps the shared localdev infra Taskfile

Quality gates:

- `task test` — `vitest run`
- `task test:watch` — vitest in watch mode
- `task lint` — eslint
- `task typecheck` — `tsc --noEmit`

## The backend contract

Every endpoint this SPA calls, its cache headers, its per-user fields and its status codes are
documented in the backend repo — read those before changing an API call or adding one:

- `tvbf-backend/.claude/docs/architecture-endpoints.md` — the annotated endpoint surface.
- `tvbf-backend/.claude/docs/patterns-auth-and-abuse.md` — sessions, CSRF, the signup/login gates,
  Turnstile, and the moderation surface (`disabled_at`, reports).
- `tvbf-backend/.claude/docs/patterns-recommendations.md` — the never-recommend rule and
  `GET /me/recommendations`, which the *"mutation that creates or removes a never-recommend
  record"* convention below is the client half of.
- `tvbf-backend/docs/specs/` — the cross-repo contract specs, cited by ticket id from this repo's
  own specs.

## Module map

```
tvbf-frontend/src/
  main.tsx, router.tsx, env.ts
  api/
    client.ts          # fetch wrapper: credentials: include, CSRF header, JSON handling
    auth.ts            # signup/login/logout/password-change hooks
    me.ts              # useMyShows, useWatchNext, useUpcoming, useMarkEpisode, etc.
    shows.ts           # public browse hooks
    types.ts           # API DTOs + FE-internal sort literals (MyShowsSort, WatchNextSort, UpcomingSort)
  components/
    AuthContext.tsx, RequireAuth.tsx, AppShell.tsx, UserMenu.tsx, SearchOverlay.tsx
    EpisodeWatchCheckbox.tsx, SeasonWatchCheckbox.tsx, ShowWatchCheckbox.tsx
    ShowCard.tsx, ShowList.tsx, ShowGrid.tsx, MyShowCard.tsx, NextEpisodeCard.tsx
    UserIdentity.tsx   # the display-name-over-handle pairing, for every surface drawing a person as an entity (NEU-1169)
    home/              # tab list components + filter pickers + sort modules (myShowsSort.ts, watchNextSort.ts)
    ui/                # shadcn primitives
  hooks/
    usePersistedSort.ts, usePersistedView.ts  # validated localStorage state; usePersistedString.ts is NOT validated
    useFieldErrors.ts  # one form's per-field messages, server-sent and client-checked alike, plus the aria-describedby join (NEU-1196, NEU-1169)
  lib/
    handle.ts          # normaliseHandle + the handle shape regex — the only server rule the SPA mirrors (NEU-1169)
    userLabel.ts       # nameWithHandle: the same pairing where a surface builds prose or an accessible name
  pages/               # WatchNextPage, UpcomingPage, MyShowsPage, SearchPage, ShowDetailPage, EpisodesPage, EpisodePage, LoginPage, SignupPage, NotFoundPage
  test/                # MSW handlers + setup
```

## Conventions

- **Hostnames:** `https://app.tvbf.localhost` (frontend) / `https://api.tvbf.localhost` (backend). Both are in `CORS_ALLOWED_ORIGINS`. Cookies are scoped to `.tvbf.localhost` so the session is shared across both subdomains.
- **Network:** the `tvbf_frontend` container joins the external `proxy` Docker network owned by `tbc-localdev-infra`. Traefik routes `Host(\`app.tvbf.localhost\`)` to it.
- **Containerization is non-negotiable.** No local Node toolchain. Vite HMR runs over Traefik's TLS — config uses `clientPort: 443` + `protocol: "wss"`.
- **API client (`src/api/client.ts`):** every request sends `credentials: "include"`. Mutating requests automatically include `X-CSRF-Token` from the in-memory auth context. Errors throw typed objects that pages render into `<ErrorState />`. Don't bypass it for ad-hoc fetches.
- **Sort + filter state is persisted to localStorage** via `usePersistedSort` / `usePersistedString` / `usePersistedView`. `usePersistedSort` and `usePersistedView` validate against an allowed key list, so adding a new sort option is safe (old persisted values that aren't in the list fall back to the default). **`usePersistedString` does not validate at all** — it returns the raw stored string — so a persisted *value* (a genre or status name) survives a vocabulary change and is sent to the API unchecked, which is NEU-1064's finding and NEU-1037's to fix.
- **Watch Next + My Shows + Upcoming sort/filter client-side**, not via query params. The endpoints return the full bounded list (≤ # of My Shows entries); the SPA filters and re-sorts in `useMemo`. New sort keys go in the per-tab `*Sort.ts` module (e.g. `home/watchNextSort.ts`, `home/myShowsSort.ts`) — extract the comparator and `SORTS` array there so they're directly testable.
- **A mutation that creates or removes a never-recommend record must invalidate `["me-recommendations"]`.** Those records are project spec §8's four — My Shows membership, a show rating, any episode watch, any episode rating — plus NEU-1178's dismissal; `GET /me/recommendations` suppresses a stored suggestion for any of them, as a **live join** rather than a stored flag (NEU-1175), so every one of those mutations changes the payload in one direction or the other. `src/api/me.ts` does it in `invalidateAll` (membership plus every episode-watch path) and by hand in `useShowRating`, `useEpisodeRating` and `useRemoveFromHistory`, which do not route through it. The client **never re-implements the suppression rule itself** — it is one definition on the server (`recommendations/exclusion.py`), cited by the NEU-1112 contract §4.1, and a client-side copy is a second expression of it that drifts. A new source added to that module changes both ends, as NEU-1178's dismissal did — `POST /me/recommendations/{show_id}/dismiss` is the fifth, and the grid is stale after one exactly as it is after the other four. Its client half is `useDismissRecommendation` (NEU-1179), and it is the one such mutation invalidating on **`onSuccess` rather than `onSettled`**: the others settle-invalidate because they carry optimistic updates whose rollback still leaves the server authoritative, and this one carries none, so a refetch after a failure would spend a request to be told the same thing — firing only on success is what makes "a failed dismissal leaves the card in place" structural rather than incidental. Its failure feedback is a `toast.error` and never a page-level error, because there is no optimistic override to visibly revert and silence would read as a dead button. There is deliberately **no optimistic update**: the replacement card is the server's choice from the stored set, so the client cannot know what it is, and the grid legitimately shrinks rather than backfilling.
- **`ShowCard`'s opt-in props are the containment seam for surface-specific controls.** The card is shared by trending, most anticipated, similar shows, search and browse, so an affordance belonging to *one* surface arrives as an opt-in prop threaded through `ShowGrid` (`addable`, NEU-1176 — only `RecommendedForYou` passes it) and is **asserted absent by default** in `ShowCard.test.tsx` rather than once per grid. NEU-1179's dismiss control landed on the same seam, as `dismissible` (plus an `onDismissed` reporting a landed dismissal back to the surface — one function reference for every card, never a per-row closure; the card hands its own id back). A control is a **sibling of the poster's `Link`, never a descendant** — a `<button>` inside an `<a>` is invalid nesting and a real focus-order problem — whether it sits in the action row or overlays the poster; since NEU-1183 `ShowPoster` makes that structural rather than remembered per card. The dismiss chip overlays because the row will not hold it: measured at a 375px viewport a card is ~109px wide and `MyShowsButton` alone is ~78px of the ~97px inside it, so a second control needs 110px, and wrapping would make recommendation cards taller than every other card in a shared grid. **Which corner it overlays is no longer the card's to decide** (NEU-1183): it sat `top-0 right-0` and was safe only by coincidence — `my_rating` is null on the recommendations contract and a tracked or rated show is suppressed before it can be recommended — so it is now passed as `ShowPoster`'s `control` and lands bottom-right under the placement rule below. Making a rating and a control mutually exclusive in the type was rejected: that encodes the constraint as a prohibition, and the prohibited thing (a recommendations grid that eventually shows the viewer's rating) is reasonable. Because the removal is not optimistic, the dismissed card unmounts on the refetch and focus falls to `<body>`; `RecommendedForYou` owns the fix, moving focus to the chip that took the freed slot (clamped when the dismissed card was last) or to the sign-off line when none remain. It gates that move on **the dismissed id having actually left the list** — `onSuccess` fires before the refetch resolves, so an effect running on the callback alone focuses the card that is about to unmount. `MyShowCard` grew the same seam one card over, as `removable` + `onRemoved` (NEU-1187), and `LibraryActiveList` owns the identical focus move for it — including the absence gate, which there is satisfied almost immediately because `useRemoveShow` filters the row out in `onMutate`, and is kept anyway so the effect stays correct if the list changed meanwhile. **The move itself is no longer written per surface**: NEU-1193 extracted it as `hooks/useFocusAfterRemoval.ts` at the third copy, the threshold this repo keeps naming (NEU-1057's three library marks, NEU-1176's two copies of the optimistic reconciliation). The hook owns the absence gate, the clamp and the container fallback; what a surface still decides is its two selectors — the per-item control, and optionally what takes focus when none remain (`RecommendedForYou` names its sign-off line, the two library tabs let their `tabIndex={-1}` results container take it). `keyOf` belongs at module scope in the calling file, since it lands in the hook's effect dependencies. Two differences follow from that mutation being **optimistic** where the dismissal is not. **The freed slot's index survives only because `mutate`'s callback closes over the surface's list as of the click** — the surface has already re-rendered without the show by the time `onSuccess` fires, so anything that re-resolved the callback afterwards would hand it an id its list no longer holds. And **`removable` is honoured only on a card drawn from the viewer's own library** (`ratingOwner.kind === "own"`): `MyShowCard` is shared with a friend's, where the entry is in *their* My Shows and says nothing about the viewer's, so an unguarded opt-in would draw "Remove" over a show the viewer may never have had and DELETE one they do — the exact combination NEU-1188 is going to reach for.
- **One add/remove control, and its *position* is what says whether adding is possible (NEU-1187).** `MyShowsButton` draws the affordance on every card and row that has one, in two variants: `labelled` is the action-row chip, `compact` is icon-only and reuses `DismissRecommendationButton`'s shell in the poster's bottom-right corner. The rule is **the control overlays the poster where it can only remove; it sits in the card or row's action row wherever adding is possible** — so exactly one surface takes `compact` today, the viewer's own My Shows · Active in both views, where every row is in My Shows by definition and the labelled chip could only ever say one thing while costing a full line of the tallest rows in the app (measured at 375px: 138px → 116px unrated, 160px → 120px rated, 15.5% off the whole list). Everything else — Watched rows, friend libraries, the recommendations grid, the browse grids — keeps `labelled`. Three things are load-bearing. **`compact` renders its add state too**, even though its one surface can never reach it: hard-coding it would put a second decision inside a component whose contract is that it takes the answer, not the sources. **The glyph is `BookMinus`**, never the emerald `Check` (that means *watched* everywhere else in this app) and never `CircleMinus` (which says nothing about what it removes *from*, on cards that carry a watch-progress bar, so it could read as removing watch history). **Both variants' accessible names carry the show's name**, which is why `showName` is required — the compact chip has no visible text at all, and the labelled one renders twelve identical times on the recommendations grid. The show *detail* page keeps `MyShowsToggle` and is deliberately not converged: it is a page-level primary CTA rather than a card or row control, and `ShowDetail` carries no `in_my_shows` to feed the takes-the-answer contract. **`RemoveWatchHistoryButton` is the same shape one act over** (NEU-1193): it owns `useRemoveFromHistory` and the confirm dialog the Watched row used to hold inline, and it carries the identical `labelled` / `compact` pair — labelled in the row's action row, where the My Shows button beside it means adding *is* possible, and compact in the Watched **card's** poster corner, which is the drawing NEU-1188 declined to invent and handed here. The two controls share that corner across surfaces and must not converge on one picture: this one keeps `Trash2` where `MyShowsButton` uses `BookMinus`, which is the same distinction `CircleMinus` was rejected for. It reaches the card through `MyShowCard`'s `historyRemovable` — a **second** boolean beside `removable` rather than a widening of it, because a card that took one flag and decided which act it meant from its tab would be the decision-inside-the-component that seam exists to avoid; `ShowPoster` exposes one control slot, so the two are mutually exclusive by construction, and both are honoured only when `ratingOwner.kind === "own"` (a friend's watch history is not the viewer's to delete). With that, `viewParity.test.tsx`'s one `knownAsymmetries` entry is closed — the mechanism stays for the next gap, and nothing passes it today.
- **One poster, one placement rule: facts on top, controls on the bottom (NEU-1183).** `ShowPoster` (`src/components/ShowPoster.tsx`) draws every poster in the app and **assigns every corner** — top-left the library mark, top-right the viewer's own rating, bottom-right a control, bottom-left reserved for a second one; an aggregate goes inline beside the title and another person's rating never occupies a corner at all. **Corners are never passed in per call site**, which is the whole point: both marks used to move between Discover and My Shows and traded places diagonally, so nothing on a card was a stable landmark, and a shared class string is not the fix — a string is what drifted, exactly as it had for the mark's *picture* one ticket earlier (NEU-1057). A new surface gets correct placement by using the component and stating no position. Three things hold it up. **It owns its own `Link`**, so every overlay slot is a sibling of it by construction rather than by each card's care — and because a card's caption lives *inside* that link (a card has always been one link over poster and title together; two would double the tab stops on a twelve-card grid and announce every show twice), the overlay layer mirrors the image's aspect ratio to stay over the poster rather than over the caption. A list row passes no caption, so its link holds the image alone and `linkLabel` names it. **Facts are values, controls are nodes** — `inMyShows` is a boolean and `ownRating` a bare number, so the poster builds the badges itself and a caller *cannot* put a friend's rating in the top-right; `control` stays a `ReactNode` because controls genuinely vary and facts do not. **`size` is a variant (`"card"` / `"row"`), not a `className`** — anything else is a new surface making a decision that belongs here. It also absorbed a triplicated poster with two behaviours: `ShowCard` and `MyShowCard` each declared their own identical `FALLBACK_POSTER` while the two library rows rendered a `bg-muted` div for a missing image, so all four now render the same absence. Placement is asserted **once**, in `ShowPoster.test.tsx`; each surface's own test asserts only that it renders through the component (`[data-show-poster]`), which is the tripwire against a sixth surface hand-rolling one.
- **A rating states which of three kinds it is, and the type checker enforces it (NEU-1182).** `src/lib/rating.ts` owns the vocabulary: a rating is the viewer's own (`own`), one named person's (`other`, carrying `ownerName`) or a crowd's (`aggregate`, carrying `crowdName`), and `ratingLabel` derives the one accessible name — `Your rating: 4.5 out of 5`, `Jeanne's rating: 4.0 out of 5`, `TMDB average: 4.1 out of 5` — that both forms use for `aria-label` *and* `title`. **Two forms, one vocabulary**: the compact chip (`RatingBadge`) wherever width binds, five stars (`StarRatingDisplay`) on detail pages and the friend surfaces; the choice between them is density, never meaning, and both draw the same lucide `Star`. **Amber-filled means a person rated this, unfilled muted means a crowd did** — fill and colour are two independent channels, so the distinction survives greyscale and colour-blindness, and it is carried by **no text label**: the aggregate chip shares a card's title line with a truncating `h3` at ~97px, where `TMDB 4.1` costs ~6 characters of show name against a starred value. `RatingBadge`'s free-text `title` prop is **deleted** — it is what let the viewer's rating and TMDB's average render pixel-identically, separated only by a tooltip that does not exist on touch, and while it survived a fourth meaning could enter through it. `crowdName` is a deliberate departure from the spec's union, which gave `aggregate` no fields: `FriendRatingsList`'s friends-average is also an aggregate, and a fixed "TMDB average" label would announce a friend group's score as TMDB's. `StarRatingInput` is untouched — it is an input, its amber is the interactive affordance. **Two call sites are knowingly mislabelled** until NEU-1181 lands: `MyShowCard` and `LibraryActiveList` pass `kind="own"` for a rating that is the *friend's* in friend mode, which is the label production already ships; the fix needs a `ViewerContext` carrying the friend's name.
- **One person, drawn one way, and prose is the exception (NEU-1169).** `UserIdentity` (`src/components/UserIdentity.tsx`) owns the display-name-over-`@handle` pairing on every surface that draws a person as an **entity** — the row of a list, the item of a search result, a page header: people search, both sides of the requests inbox, the connections list, the blocks list, `FriendProfilePage`'s `h1`, `FriendRatingsList` and the admin user rows. **Always stacked, and `size` is a variant, not a `className`**, on `ShowPoster`'s precedent: a handle is 30 characters by contract (NEU-1163 §1) and a connections row has ~250px beside its buttons, so the inline form holds for today's values and breaks on values the API is allowed to return. The layout is asserted **once**, in `UserIdentity.test.tsx`; every surface asserts only `[data-user-identity]`, which is the tripwire against an eighth surface hand-rolling one. **The two prose surfaces deliberately keep the display name alone** — `FeedItemRow`'s actor and `FriendActivity`'s watched-by strip — because everyone reachable through either is already an accepted connection, so the impersonation decision the handle informs was made upstream; both assert the *absence*, so the boundary stays deliberate. Where a surface builds a sentence or an accessible name rather than drawing a row, `nameWithHandle` (`src/lib/userLabel.ts`) is the same pairing in prose, and it draws one further line: **consequential copy names both, possessive prose keeps the display name**. Both destructive confirmations, the repeated admin switch's `aria-label` (which otherwise announces the same name on two switches, one granting admin to the wrong person) and `ReportUserButton`'s label and title take both; `Nothing happens to Alice's account`, `OwnerFacts`'s `ownerName` and `rating.ts`'s `ratingLabel` keep the display name, because `@alice's rating` disambiguates nothing inside one person's own context. `ReportUserButton` therefore takes the **pair**, never a pre-joined string — a caller passing one string cannot express that split, and the first one that tried shipped `Nothing happens to Alice (@alice)'s account`.
- **The client mirrors the handle's shape and no other handle rule (NEU-1169 D2).** `src/lib/handle.ts` owns `normaliseHandle` (trim, strip one leading `@`, lowercase — the *prediction* of what the server stores, since the raw string still goes on the wire) and the `^[a-z][a-z0-9_]{2,29}$` regex, shared by the signup field and the settings editor. **Reserved words, the `user_<8 hex>` pattern and uniqueness are not checked here**: `RESERVED_HANDLES` is a snapshot nothing tracks and already exists twice server-side, and a third copy would drift *toward permissive* — telling a visitor `@moderator` is fine right up until the server refuses it. Those arrive as a 422 or a 409 and land on the input through `useFieldErrors`, which is also where a form's **own** client-side message goes (`setFieldError`), so both kinds share one store and one `aria-describedby` join. The check runs on blur and on submit, never per keystroke — `t` is invalid until the third character.
- **No secrets in the SPA.** Everything shipped to the browser is public. `ADMIN_TOKEN` stays server-to-server.
- **Tailwind v4** uses `@theme` + `@plugin "..."` blocks. shadcn theme requires `popover` / `accent` / `card` / `input` / `ring` color tokens defined in the theme block.
- **Vitest + jsdom** needs `ResizeObserver` and pointer-capture polyfills (already in `src/test/setup.ts`). Tests use MSW handlers from `src/test/msw/handlers.ts`.

## Planning workflow

Multi-step features follow the spec-then-plan flow already used in these repos:

1. Design spec lives at `docs/specs/<TICKET-ID>-<slug>.md`.
2. Implementation plan lives at `docs/plans/<TICKET-ID>-<slug>.md` and references its spec. Plans use TDD-style step-by-step tasks with full code in each step. Plans in this repo explicitly do NOT include `git commit` steps — the user commits on their own cadence.

Read a recent spec (e.g. `docs/specs/NEU-1187-one-add-remove-control.md` or
`docs/specs/NEU-1182-the-card-badge-system.md`) to see the expected structure before starting a new
feature. `docs/superpowers/{specs,plans}/` holds the retired layout — an archive, not where new
docs go.

## Quality gates

This repo has **no pre-commit hooks** (the backend does). Gates run via `task lint` /
`task typecheck` / `task test`, and in CI. Run all three locally before pushing.
