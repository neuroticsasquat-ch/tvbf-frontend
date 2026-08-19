import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReactElement } from "react";

import { renderWithProviders } from "@/test/renderWithProviders";
import { SearchOverlay } from "./SearchOverlay";
import { LibraryActiveList } from "./library/LibraryActiveList";
import { LibraryWatchedList } from "./library/LibraryWatchedList";
import { UpcomingList } from "./home/UpcomingList";
import { WatchNextList } from "./home/WatchNextList";

/** NEU-1189 AC 1 — **the toolbar rule, made testable.**
 *
 * > View toggle, then sort, then filters — same order, same alignment, every
 * > listing page.
 *
 * There were four layouts across five sibling pages before this, so the check
 * that matters is not "each page has controls" but "every page puts them in the
 * same sequence". Each surface is rendered and its controls are collected **in
 * document order**, then compared against the rule.
 *
 * The probes key on accessible names rather than on class strings, because a
 * class string is exactly what drifted: `ListingToolbar` is what actually holds
 * the order, and a surface that stopped using it would still have the right
 * classes on hand-written divs.
 *
 * Alignment is checked as the absence of `ml-auto` — the one thing Search did
 * that pushed its view toggle and sort to the far right of the heading row.
 */
type Control = "view" | "sort" | "filter";

function controlsOf(container: HTMLElement): Control[] {
  // The view toggle is found by `ViewToggle`'s *own* invariant — it always
  // renders a "Grid view" button — rather than by the group's `ariaLabel`,
  // which each caller supplies. Keying on that label would make a page which
  // omits it invisible to this probe, and the probe would then cheerfully
  // assert the page has no toggle.
  const nodes = container.querySelectorAll<HTMLElement>(
    'button[aria-label="Grid view"], button[aria-label^="Sort "], button[aria-label^="Filter by "]',
  );
  return [...nodes].map((n) => {
    const label = n.getAttribute("aria-label") ?? "";
    if (label === "Grid view") return "view";
    return label.startsWith("Sort ") ? "sort" : "filter";
  });
}

/** Left-aligned, asserted where it means something: `ml-auto` inside the
 * toolbar is what pushed Search's view toggle and sort to the far right. Over
 * the whole surface this would be a claim about every row as well, which is a
 * different rule and one an empty fixture could not check anyway. */
function expectLeftAligned(container: HTMLElement) {
  const toolbar = container.querySelector("[data-listing-toolbar]");
  expect(toolbar).not.toBeNull();
  expect(toolbar!.querySelector(".ml-auto")).toBeNull();
  expect(toolbar!.className).not.toContain("justify-between");
}

/** The rule: at most one view toggle, exactly one sort, both ahead of every
 * filter — and the sort after the toggle where a toggle exists. */
function expectToolbarRule(controls: Control[], { view }: { view: boolean }) {
  expect(controls.filter((c) => c === "view")).toHaveLength(view ? 1 : 0);
  expect(controls.filter((c) => c === "sort")).toHaveLength(1);
  expect(controls.filter((c) => c === "filter").length).toBeGreaterThan(0);
  const expectedHead: Control[] = view ? ["view", "sort"] : ["sort"];
  expect(controls.slice(0, expectedHead.length)).toEqual(expectedHead);
  expect(controls.slice(expectedHead.length).every((c) => c === "filter")).toBe(true);
}

async function renderSurface(ui: ReactElement) {
  const { container } = renderWithProviders(ui);
  // Every one of these renders its toolbar before its results, so waiting on
  // the sort trigger is enough and does not depend on a fixture loading.
  await waitFor(() => expect(screen.getByRole("button", { name: /^Sort / })).toBeInTheDocument());
  // The order below is `ListingToolbar`'s to hold; a surface hand-rolling the
  // same sequence would satisfy it today and drift tomorrow.
  expect(container.querySelector("[data-listing-toolbar]")).not.toBeNull();
  return container;
}

describe("every listing page orders its controls the same way (NEU-1189 AC 1)", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it("My Shows · Active", async () => {
    const c = await renderSurface(<LibraryActiveList data={[]} isLoading={false} />);
    expectToolbarRule(controlsOf(c), { view: true });
    expectLeftAligned(c);
  });

  it("My Shows · Watched", async () => {
    const c = await renderSurface(
      <LibraryWatchedList data={[]} isLoading={false} isError={false} />,
    );
    expectToolbarRule(controlsOf(c), { view: true });
    expectLeftAligned(c);
  });

  it("Search", async () => {
    const c = await renderSurface(<SearchOverlay search="bear" />);
    expectToolbarRule(controlsOf(c), { view: true });
    expectLeftAligned(c);
  });

  it("Watch Next — no view toggle, by decision (AC 4)", async () => {
    const c = await renderSurface(<WatchNextList />);
    expectToolbarRule(controlsOf(c), { view: false });
    expectLeftAligned(c);
    // AC 2: the sort no longer shares the `h1`'s row. It used to be the `h1`'s
    // sibling inside a `justify-between` flex div, which is what put it on the
    // far right of the heading and nowhere near the other pages' sort.
    const heading = screen.getByRole("heading", { name: "Watch Next" });
    const sort = screen.getByRole("button", { name: /^Sort / });
    expect(sort.parentElement?.contains(heading)).toBe(false);
  });

  it("Upcoming — no view toggle, by decision (AC 4)", async () => {
    const c = await renderSurface(<UpcomingList />);
    expectToolbarRule(controlsOf(c), { view: false });
    expectLeftAligned(c);
  });
});
