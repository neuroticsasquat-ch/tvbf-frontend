# NEU-1509 — New logo: the TV mark, the Manrope wordmark, and the icon set

**Ticket:** [NEU-1509](https://linear.app/neuroticsasquatch/issue/NEU-1509/new-logo)
**Repo:** `tvbf-frontend` — branch `tom/neu-1509-new-logo` from `main`
**Project:** tvbf: Maintenance
**Source assets:** `~/tvbf-icons/` on the workspace that planned this (not in any repo — see §4.1 for what gets committed)
**Precedents this consumes:** `src/components/SasquatchMark.tsx` (why a mark is inlined rather than served from `public/`), `src/components/ShowPoster.tsx` and `src/components/UserIdentity.tsx` (`size` is a variant, never a `className`), `src/manifest.test.ts` (what pins the icon set), `tvbf-backend/docs/specs/tvbf-push-notifications-project-spec.md` §6.1 (the manifest and icon contract this must keep satisfying)
**Vocabulary:** `CONTEXT.md` § Brand
**Status:** approved for implementation

---

## 1. What this is

The app has never had a logo. The header draws lucide's `Tv` icon beside the
words "TV BingeFriend" in the system font; the login hero repeats the same
pairing larger; the favicon is a cyan-and-navy placeholder drawn in 2026-04,
and the PWA icons were rasterised from it.

Claude generated a real mark — an amber television with "TVBF" on its screen,
on a navy tile — and a wordmark treatment. This ticket puts them everywhere
the placeholder was:

1. **A `BrandLockup` component** (mark + wordmark) replaces the icon-plus-text
   pairing in the header and the login hero.
2. **The wordmark is set in Manrope**, self-hosted, used nowhere else.
3. **The favicon and every PWA icon** are replaced by the generated set.

Nothing server-side changes. No route, API call or copy changes.

## 2. What is established

- **Header** (`AppShell.tsx` ~l.233): a `Link to="/"` with
  `aria-label="TV BingeFriend home"`, `text-lg font-semibold`, containing
  `<TvIcon className="h-5 w-5" aria-hidden />` and the text. The link sits in
  a `flex-wrap` row with the search box and the nav; it is `shrink-0`.
- **Login hero** (`LoginPage.tsx` ~l.73): a `div` with `text-xl font-semibold`,
  `<Tv className="h-6 w-6" />` and the text. `SignupPage` has no brand block.
- **Footer** draws `SasquatchMark` inline. Its docblock is the reasoning this
  spec reuses: an SVG through `<img src>` cannot inherit `currentColor`, so a
  mark that should follow the page's colour is inlined as a component.
- **Fonts:** none loaded. `body` is `system-ui, -apple-system, sans-serif`
  (`src/styles/globals.css` l.72). No `@font-face`, no Google Fonts link, no
  Content-Security-Policy anywhere (Cloudflare `_headers` pins one MIME type
  and nothing else).
- **Theme:** Tailwind v4 `@theme` block in `globals.css`; the app is dark-only
  by decision. `--color-background` is `hsl(222 47% 11%)` ≈ `#0f172a`.
- **Icons:** `public/favicon.svg` (64×64, the placeholder), `icon-192.png`,
  `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`,
  `apple-touch-icon.png` (180). `index.html` links the SVG favicon, the
  manifest and the apple-touch-icon. `manifest.webmanifest` lists the four
  PNGs with `any`/`maskable` purposes; `theme_color` and `background_color`
  are `#0f1729`.
- **`src/manifest.test.ts`** pins: manifest identity and colours, the four
  purpose/size pairs, that each named PNG really is a PNG of its declared
  size, that `apple-touch-icon.png` is 180×180, and the `index.html` links and
  metas. It reads everything through Vite imports.
- **The push-notifications project spec §6.1** says the icons are "generated
  from `favicon.svg`" and links `apple-touch-icon` at 180 px. This ticket keeps
  both statements true.
- **Generated assets** (`~/tvbf-icons/`): `tvbf-icon.svg` (512 viewBox, tile
  `rx=112` fill `#0f1729`, the TV group at `translate(32 62.8) scale(2.8)`),
  `tvbf-icon-maskable.svg` (same drawing, `rx=0`, group at
  `translate(104 124.9) scale(1.9)` — the extra padding is the maskable safe
  zone), and PNGs at exactly the sizes the manifest test expects: 192, 512,
  maskable 192, maskable 512, apple-touch 180, plus `favicon-32.png` and a
  `favicon.ico` holding 16/32/48. The TV drawing lives in a ~160×137 user
  space: amber `#f5a524` body (`rect 6,30 148×96 rx20`), two feet, two
  antennae with ball tips, a navy `#1b2a4a` screen (`rect 18,42 124×72 rx12`)
  carrying "TVBF" as amber paths.
- **The wordmark treatment**, from the generator (originally for Outfit; the
  font is swapped, the structure is kept):

  ```html
  <span class="wordmark"><span class="tv">TV</span> <b>Binge</b>Friend</span>
  ```
  ```css
  .wordmark { font-family: 'Outfit', system-ui, sans-serif; font-weight: 300; letter-spacing: -0.01em; }
  .wordmark b, .wordmark .tv { font-weight: 600; }
  .wordmark .tv { color: #f5a524; }
  ```

## 3. Decisions

### 3.1 The font is self-hosted through `@fontsource-variable/manrope`

Add `@fontsource-variable/manrope` (5.x) as a dependency and
`@import "@fontsource-variable/manrope";` at the top of `globals.css`, after
the Tailwind import. The package declares `font-family: 'Manrope Variable'`,
`font-weight: 200 800`, `font-display: swap`, split by `unicode-range` — a
browser rendering "TV BingeFriend" fetches the Latin file only (~30 KB), from
our origin, hashed by Vite.

Rejected: the generator's Google Fonts `<link>`. It sends every visitor's IP
to `fonts.googleapis.com` and `fonts.gstatic.com` on every load, which the
privacy page does not disclose and there is no reason to start disclosing;
it also adds a third-party round trip to the standalone PWA's cold start for
one line of text. Rejected: a hand-copied woff2 in `public/fonts` — same
result as the package with nothing to regenerate it from.

### 3.2 Manrope is the wordmark's font and nothing else's

The theme gains one font token, and only the lockup uses it:

```css
@theme {
  --font-brand: "Manrope Variable", system-ui, sans-serif;
  --color-brand: #f5a524;
}
```

`body`'s system stack is untouched. Headings are untouched. A later ticket
that wants Manrope on headings has the token ready; this one does not decide
that.

`--color-brand` is the icon's amber. It is a token, not a literal in the
component, so the wordmark's "TV" and the inline mark draw from one value
(§3.3). It is **not** a shadcn semantic colour (not `primary`, not `accent`):
those name roles, this names the brand, and nothing but the lockup should
reach for it.

### 3.3 One `BrandLockup`, two sizes

`src/components/BrandLockup.tsx` exports `BrandLockup({ size })` with
`size: "header" | "hero"`, drawn as a `span` (inline-flex, items-center) that
holds the mark then the wordmark. It is the only place the mark or the
wordmark is drawn; the header and the login hero render it and state nothing
but the size.

**The mark** is the TV drawing from `tvbf-icon.svg` inlined as an `<svg>`,
**without the tile**. Two reasons: the tile is `#0f1729` against a header of
`#0f172a`, so it is invisible in place and only shrinks the TV to ~75 % of its
box; and inlining is what lets the amber fill follow `currentColor`
(the `SasquatchMark` reasoning). Concretely:

- `viewBox` is the TV group's own bounds — take the inner `<g>`'s children
  verbatim, drop the `translate/scale` wrapper, and set the viewBox to enclose
  them (approximately `0 0 160 137`: antenna tips reach y≈0, feet reach
  y=136, body spans x 6–154). Compute it from the paths, do not eyeball it.
- Every `#f5a524` fill and stroke becomes `currentColor`; the `svg` carries
  `className="text-brand"`. The screen's `#1b2a4a` stays a literal — it is the
  drawing's own colour, not a theme colour, and must match the icon files.
- The "TVBF" screen paths stay. At header size they read as texture, which is
  fine; removing them would make the header mark a different drawing from
  the icon.
- `aria-hidden` — the wordmark beside it is the accessible name.

**The wordmark** is the generator's structure with the font swapped:

```tsx
<span className="font-brand font-light tracking-[-0.01em] ...">
  <span className="font-semibold text-brand">TV</span>{" "}
  <span className="font-semibold">Binge</span>Friend
</span>
```

`span` + `font-semibold`, not `<b>`: the bold is presentational, and the
generated `<b>` would only invite a "strong" announcement in some readers.
The visible text is exactly `TV BingeFriend` (one space, no trailing text),
so `getByText("TV BingeFriend")` and the existing `aria-label` keep agreeing.

**Sizes:**

| `size`   | mark box   | wordmark            | where           |
| -------- | ---------- | ------------------- | --------------- |
| `header` | `h-7 w-auto` | `text-lg`           | `AppShell` link |
| `hero`   | `h-10 w-auto` | `text-2xl md:text-3xl` | `LoginPage`  |

Gap between mark and wordmark is `gap-2` in both. `size` is a variant on the
`ShowPoster` / `UserIdentity` precedent: a surface that wants a third size
adds it here, not a `className`.

**The header link** keeps `aria-label="TV BingeFriend home"`, `to="/"`,
`shrink-0` and `hover:underline`; it drops `text-lg font-semibold` (the
lockup owns its type) and the `TvIcon` import goes with it. The `hover:underline`
underlines the wordmark only — acceptable, it did the same to the text before.

**The login hero** replaces its `div` + `Tv` + text with
`<BrandLockup size="hero" />` and drops the `Tv` import if nothing else uses
it. The paragraph and feature list beneath are untouched.

Rejected: leaving the login hero for later — it is the one other place the
old pairing exists, and two brand drawings in one app is exactly the drift
`ShowPoster` and `UserIdentity` were created to stop. Rejected: `<img
src="/favicon.svg">` in the header — the invisible tile, the 20 px TV, and no
`currentColor`.

### 3.4 The icon set is replaced in place

Copy from `~/tvbf-icons/` into `public/`:

| source                      | destination                | note                              |
| --------------------------- | -------------------------- | --------------------------------- |
| `tvbf-icon.svg`             | `favicon.svg`              | overwrites the placeholder        |
| `tvbf-icon-maskable.svg`    | `icon-maskable.svg`        | new; the maskable PNGs' source    |
| `favicon.ico`               | `favicon.ico`              | new; 16/32/48                     |
| `icon-192.png`              | `icon-192.png`             | overwrite, same size              |
| `icon-512.png`              | `icon-512.png`             | overwrite, same size              |
| `icon-maskable-192.png`     | `icon-maskable-192.png`    | overwrite, same size              |
| `icon-maskable-512.png`     | `icon-maskable-512.png`    | overwrite, same size              |
| `apple-touch-icon.png`      | `apple-touch-icon.png`     | overwrite, 180×180                |

`favicon-32.png` is **not** copied: the `.ico` already carries a 32 px
bitmap and nothing would link the PNG.

`index.html` head becomes, for icons:

```html
<link rel="icon" href="/favicon.ico" sizes="32x32" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

The `.ico` first with an explicit `sizes` is the standard pair: browsers that
understand SVG icons prefer the SVG, the rest fall back to the `.ico` rather
than to nothing. `staticwebapp.config.json`'s navigation-fallback exclusion
already lists `ico` and `svg`, and Cloudflare serves both by extension, so no
hosting config changes.

`manifest.webmanifest` does not change: same file names, same sizes, same
purposes, same colours (`#0f1729` is the tile's own fill, so the splash
screen matches the icon). `theme-color` does not change for the same reason.
The backend project spec's "generated from `favicon.svg`" sentence stays true
because `favicon.svg` *is* the tile now; no backend doc edit.

`icon-maskable.svg` is committed even though nothing links it, so that a
future regeneration of the maskable PNGs starts from the drawing that
produced them rather than from a re-derivation of the safe zone.

### 3.5 What the tests pin

- **`src/components/BrandLockup.test.tsx`** (new): renders both sizes;
  asserts the visible text is exactly `TV BingeFriend`; asserts the `svg` is
  `aria-hidden` and carries `text-brand`; asserts `data-brand-lockup` is
  present (the tripwire other surfaces assert on, per the `[data-show-poster]`
  / `[data-user-identity]` convention); asserts the two sizes differ in the
  mark's height class.
- **`src/components/AppShell.test.tsx`**: the header link named
  `TV BingeFriend home` contains `[data-brand-lockup]` and no lucide `Tv`.
- **`src/pages/LoginPage.test.tsx`** (or wherever the login page is already
  tested): the hero contains `[data-brand-lockup]`.
- **`src/manifest.test.ts`**: the `index.html` block additionally asserts
  `link[rel="icon"][href="/favicon.ico"]` has `sizes="32x32"` and the SVG
  icon link is still present. The PNG-size cases pass unchanged against the
  new files — that is the point of replacing in place.
- No test asserts on the font: jsdom does not load fonts and a class-name
  assertion (`font-brand`) is enough to catch the token being dropped.

### 3.6 Docs

- `.claude/CLAUDE.md` module map gains
  `BrandLockup.tsx    # the mark + wordmark, header and hero sizes; the only place either is drawn (NEU-1509)`.
- `CONTEXT.md` § Brand (written with this spec) is the vocabulary; do not
  redefine the terms in component docblocks, cite it.

## 4. Acceptance criteria

1. The header shows the amber TV mark beside "TV BingeFriend" in Manrope
   (light, with "TV" amber and "TV" + "Binge" semibold), and the link still
   has the accessible name "TV BingeFriend home" and goes to `/`.
2. The login hero shows the same lockup at the hero size; no lucide `Tv`
   icon remains in either place.
3. The browser tab shows the new tile icon in browsers that take SVG icons
   and in ones that take `.ico`. iOS "Add to Home Screen" and Android
   install use the new tile / maskable icons. Lighthouse's PWA installability
   check still passes.
4. `curl` of the built site shows the Manrope woff2 served from our origin and
   **no** request to `fonts.googleapis.com` or `fonts.gstatic.com`.
5. Body text, headings and every other surface render exactly as before
   (system font stack, unchanged classes).
6. `task lint`, `task typecheck`, `task test` pass; `manifest.test.ts`'s
   size cases pass without edits to the manifest.

## 5. Out of scope / deferred

- **Manrope on headings or body.** The `--font-brand` token exists; using it
  elsewhere is a separate decision.
- **A light theme.** The mark's `currentColor` and the tile's navy assume the
  dark-only app; nothing here makes the light case worse or better.
- **Push-notification icon.** Notifications use the show poster (push spec
  Q15); the badge/icon fallback is not touched.
- **Open Graph / social preview images.** No `og:image` exists today and this
  ticket does not add one; the 512 tile would be the obvious source when one
  is wanted.
- **`favicon-32.png`** — generated but unused, not committed.
- **Footer.** The `SasquatchMark` and the copyright line are the developer's
  attribution, not the app's brand, and stay as they are.
