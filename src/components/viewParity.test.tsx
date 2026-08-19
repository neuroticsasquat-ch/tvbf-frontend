import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReactElement } from "react";

import type { MyShowEntry, ShowSummary, WatchedEntry } from "@/api/types";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ShowGrid } from "./ShowGrid";
import { ShowList } from "./ShowList";
import { LibraryActiveList } from "./library/LibraryActiveList";
import { LibraryWatchedList } from "./library/LibraryWatchedList";
import type { CallerLibrary } from "./library/callerLibrary";
import type { ViewerContext } from "./library/viewerContext";

/** NEU-1188 AC 5 — **the rule, made testable.**
 *
 * > A view toggle is a **density** choice. **Controls** and **per-person facts**
 * > are identical across views; ownerless catalog metadata may thin out as
 * > density increases, never the reverse.
 *
 * So each surface is rendered twice, its parity items are collected from the
 * rendered row or card, and the two sets must be equal. The ownerless half is
 * deliberately not probed — the search row's `Hulu · Ended · en · Comedy, Drama`
 * line is allowed to have no counterpart on a ~97px card, which is exactly the
 * asymmetry this version of the rule permits and the original forbade.
 *
 * Five surfaces, because both library lists run in self **and** friend mode.
 *
 * **The one known asymmetry is closed.** My Shows · Watched's list row carried
 * a "Watch History" removal the card did not, and this file asserted it in both
 * directions through `knownAsymmetries` rather than omitting it from the probe
 * set — which is what made NEU-1193 adding the card drawing a *failing* test
 * here rather than a silent improvement. The mechanism stays for the next such
 * gap; nothing passes it today.
 */

/** The parity items: every control, and every fact that belongs to a person.
 *
 * Each probe is scoped to one row or card, never to the whole surface — the
 * sort sheet's trigger reads "Last Watched" and "My Rating, High → Low", and
 * the view toggle's group is labelled "My Shows display", so an unscoped probe
 * would pass on every surface whether or not the fact reached a row.
 */
const PARITY_PROBES: { key: string; present: (scope: HTMLElement) => boolean }[] = [
  {
    key: "library mark",
    present: (s) => s.querySelector('[aria-label="In your My Shows"]') !== null,
  },
  {
    key: "viewer's own rating",
    present: (s) => s.querySelector('[aria-label^="Your rating"]') !== null,
  },
  {
    key: "row owner's rating",
    present: (s) => s.querySelector('[aria-label^="Jeanne\'s rating"]') !== null,
  },
  {
    key: "crowd rating",
    present: (s) => s.querySelector('[aria-label^="TMDB average"]') !== null,
  },
  {
    key: "owner progress",
    present: (s) => /Progress: \d+\/\d+|'s progress: \d+ of \d+/.test(s.textContent ?? ""),
  },
  {
    key: "last watched",
    present: (s) => /last watched/i.test(s.textContent ?? ""),
  },
  {
    key: "viewer's comparison",
    present: (s) => /You: \d+\/\d+/.test(s.textContent ?? ""),
  },
  {
    key: "watch-history removal",
    present: (s) => s.querySelector('button[aria-label$="watch history"]') !== null,
  },
  {
    key: "add/remove control",
    // Both variants, and neither the sort trigger nor the view toggle: the
    // labelled chip and the compact one share this accessible-name shape and
    // nothing else on the surface does.
    present: (s) =>
      s.querySelector('button[aria-label$="to My Shows"], button[aria-label$="from My Shows"]') !==
      null,
  },
];

/** The parity items one rendering exposes.
 *
 * The scope is the poster's parent, which is the row's `<li>` or the card's
 * wrapper on every one of the five surfaces — so it needs no test-only markup
 * and it cannot accidentally widen to the toolbar.
 */
function exposedBy(container: HTMLElement): Set<string> {
  const poster = container.querySelector("[data-show-poster]");
  expect(poster, "every surface draws its poster through ShowPoster").not.toBeNull();
  const scope = poster!.parentElement!;
  return new Set(PARITY_PROBES.filter((p) => p.present(scope)).map((p) => p.key));
}

/** Render one surface in both views and assert the two agree.
 *
 * The view is selected the way a returning user selects it — through the key
 * `usePersistedView` persists — and the rendering is then **asked which view it
 * is in**, via the toggle's own `aria-pressed`. That second step is the one
 * that matters: this file writes that key by hand, and if it ever drifts from
 * the hook's, both renders would silently fall back to the same default and
 * every parity assertion below would pass while comparing a view against
 * itself. A vacuous pass is the one failure mode a parity test must not have.
 */
function expectViewParity(
  renderSurface: (view: "list" | "grid") => ReactElement,
  storagePrefix: string | null,
  expected: string[],
  knownAsymmetries: string[] = [],
) {
  const seen: Record<string, Set<string>> = {};
  for (const view of ["list", "grid"] as const) {
    if (storagePrefix) window.localStorage.setItem(`tvbf:view:${storagePrefix}`, view);
    const { container } = renderWithProviders(renderSurface(view));
    if (storagePrefix) {
      const label = view === "grid" ? "Grid view" : "List view";
      expect(
        container.querySelector(`button[aria-label="${label}"]`)?.getAttribute("aria-pressed"),
        `the surface is actually in ${view} view`,
      ).toBe("true");
    }
    seen[view] = exposedBy(container);
    cleanup();
  }
  // Parity, minus whatever this surface is knowingly still missing.
  expect([...seen.grid].sort()).toEqual(
    [...seen.list].filter((k) => !knownAsymmetries.includes(k)).sort(),
  );
  // Pinned membership as well as equality: two views agreeing on nothing would
  // satisfy equality alone, and every one of these items is a fact or control
  // some surface was dropping before this ticket.
  expect([...seen.list].sort()).toEqual([...expected, ...knownAsymmetries].sort());
  // And each asymmetry is asserted in both directions, so it cannot quietly
  // close or quietly widen.
  for (const key of knownAsymmetries) {
    expect(seen.list.has(key), `${key} is in the list view`).toBe(true);
    expect(seen.grid.has(key), `${key} is not yet in the grid view`).toBe(false);
  }
}

function makeShow(overrides: Partial<ShowSummary> = {}): ShowSummary {
  return {
    id: 1,
    name: "The Bear",
    type: "Scripted",
    status: "Returning Series",
    language: "en",
    premiered: "2022-06-23",
    ended: null,
    image_medium: null,
    image_original: null,
    network: { id: 10, name: "Hulu" },
    web_channel: null,
    genres: ["Comedy", "Drama"],
    matched_aka: null,
    rating_average: 8.2,
    my_rating: 4.5,
    ...overrides,
  };
}

function makeMyShow(overrides: Partial<MyShowEntry> = {}): MyShowEntry {
  return {
    show: makeShow(),
    watched_episode_count: 8,
    total_episode_count: 10,
    aired_episode_count: 10,
    upcoming_episode_count: 0,
    last_aired: "2026-04-10",
    last_watched_at: "2026-04-15T00:00:00Z",
    first_watched_at: "2026-03-01T00:00:00Z",
    next_episode: null,
    added_at: "2026-01-01T00:00:00Z",
    my_rating: 4,
    ...overrides,
  };
}

function makeWatched(overrides: Partial<WatchedEntry> = {}): WatchedEntry {
  return {
    show: makeShow(),
    watched_episode_count: 8,
    aired_episode_count: 10,
    total_episode_count: 10,
    last_watched_at: "2026-04-15T00:00:00Z",
    last_aired: "2026-04-10",
    first_watched_at: "2026-03-01T00:00:00Z",
    in_my_shows: true,
    status: "in_progress",
    my_rating: 4,
    ...overrides,
  };
}

const JEANNE: ViewerContext = { kind: "friend", name: "Jeanne" };

/** The viewer's own relationship to the same show: they track it and are
 * further behind, so both the mark and the `You: x/y` comparison have something
 * to say. */
const callerLibrary: CallerLibrary = new Map([
  [1, { in_my_shows: true, watched_episode_count: 3, aired_episode_count: 10 }],
]);

describe("grid and list carry the same facts and controls (NEU-1188 AC 5)", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it("search results", () => {
    // AC 1. The row carried no rating and no mark of any kind: the app knew the
    // show was tracked and declined to say so on the one surface where "should
    // I add this?" is the question. The control was absent from *both* views
    // rather than one, which is why it was NEU-1192's rather than this
    // ticket's — it has since landed, on both at once, so it is counted here.
    const shows = [{ ...makeShow(), in_my_shows: true }];
    expectViewParity(
      (view) =>
        view === "grid" ? <ShowGrid shows={shows} addable /> : <ShowList shows={shows} addable />,
      null,
      ["library mark", "viewer's own rating", "crowd rating", "add/remove control"],
    );
  });

  it("My Shows · Active, the viewer's own", () => {
    // No mark by design (NEU-1187 §2.2: every row here is tracked, so the badge
    // could only ever be true), and the control is the compact chip in both
    // views. `last watched` is the item this surface was dropping from the card.
    expectViewParity(
      () => <LibraryActiveList data={[makeMyShow()]} isLoading={false} />,
      "my-shows",
      ["viewer's own rating", "owner progress", "last watched", "add/remove control"],
    );
  });

  it("My Shows · Active, a friend's", () => {
    // AC 3. The grid carried neither the comparison nor the control.
    expectViewParity(
      () => (
        <LibraryActiveList
          data={[makeMyShow()]}
          isLoading={false}
          viewerContext={JEANNE}
          callerLibrary={callerLibrary}
          storagePrefix="friend-active"
        />
      ),
      "friend-active",
      [
        "library mark",
        "row owner's rating",
        "owner progress",
        "last watched",
        "viewer's comparison",
        "add/remove control",
      ],
    );
  });

  it("My Shows · Watched, the viewer's own", () => {
    // AC 2, 4 and 6 at once: the grid could not add a show to My Shows at all,
    // the rating was dropped in both views, and the list never drew the mark.
    expectViewParity(
      () => <LibraryWatchedList data={[makeWatched()]} isLoading={false} />,
      "watched",
      [
        "library mark",
        "viewer's own rating",
        "owner progress",
        "last watched",
        "add/remove control",
        // Closed by NEU-1193: the compact variant in the poster's bottom-right
        // corner, which is the position that means remove-only (NEU-1187 §3.1).
        "watch-history removal",
      ],
    );
  });

  it("My Shows · Watched, a friend's", () => {
    expectViewParity(
      () => (
        <LibraryWatchedList
          data={[makeWatched({ in_my_shows: false })]}
          isLoading={false}
          viewerContext={JEANNE}
          callerLibrary={callerLibrary}
          storagePrefix="friend-watched"
        />
      ),
      "friend-watched",
      [
        "library mark",
        "row owner's rating",
        "owner progress",
        "last watched",
        "viewer's comparison",
        "add/remove control",
      ],
    );
  });
});

describe("the rule's other half: ownerless metadata may thin out", () => {
  afterEach(() => cleanup());

  it("keeps the search row's catalog line, which the card has no room for", () => {
    // The rule as originally drafted ("a fact that does not fit a dense grid
    // card is dropped from *both*, or the toggle is not offered") required
    // deleting this line. Nothing asks for that, and a ~97px card cannot hold
    // it — which is why the adopted rule is directional.
    const shows = [{ ...makeShow(), in_my_shows: true }];

    const list = renderWithProviders(<ShowList shows={shows} />);
    expect(list.container.textContent).toContain("Hulu · Returning Series · en");
    expect(list.container.textContent).toContain("Comedy, Drama");
    cleanup();

    const grid = renderWithProviders(<ShowGrid shows={shows} />);
    expect(grid.container.textContent).not.toContain("Hulu");
  });
});
