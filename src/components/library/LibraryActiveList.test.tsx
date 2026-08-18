import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { MyShowEntry, ShowSummary } from "@/api/types";
import { renderWithProviders } from "@/test/renderWithProviders";
import { LibraryActiveList } from "./LibraryActiveList";
import type { CallerLibrary } from "./callerLibrary";
import { SELF, type ViewerContext } from "./viewerContext";

const JEANNE: ViewerContext = { kind: "friend", name: "Jeanne" };

function makeShow(overrides: Partial<ShowSummary> = {}): ShowSummary {
  return {
    id: 1,
    name: "The Bear",
    type: null,
    status: "Returning Series",
    language: null,
    premiered: "2022-06-23",
    ended: null,
    image_medium: null,
    image_original: null,
    network: null,
    web_channel: null,
    genres: [],
    matched_aka: null,
    rating_average: null,
    my_rating: null,
    ...overrides,
  };
}

/** One entry as the *friend* endpoint hydrates it: `my_rating` and the watched
 * counts are the friend's, for the friend's user id (`routers/users.py:82`). */
function makeEntry(overrides: Partial<MyShowEntry> = {}): MyShowEntry {
  return {
    show: makeShow(),
    watched_episode_count: 38,
    total_episode_count: 46,
    aired_episode_count: 46,
    upcoming_episode_count: 0,
    last_aired: null,
    last_watched_at: null,
    first_watched_at: null,
    next_episode: null,
    added_at: "2026-01-01T00:00:00Z",
    my_rating: 4,
    ...overrides,
  };
}

/** The caller's own relationship to the same show: fewer episodes watched, and
 * — the case the bug was reproduced on — a different rating of their own. */
const callerLibrary: CallerLibrary = new Map([
  [1, { in_my_shows: true, watched_episode_count: 12, aired_episode_count: 46 }],
]);

function setView(prefix: string, view: "list" | "grid") {
  window.localStorage.setItem(`tvbf:view:${prefix}`, view);
}

describe("LibraryActiveList ownership", () => {
  beforeEach(() => window.localStorage.clear());

  for (const view of ["list", "grid"] as const) {
    it(`does not label a friend's rating as the caller's in ${view} view`, () => {
      // NEU-1181 AC 1/2/6. `my_rating` here is 4.0 and belongs to Jeanne; the
      // caller's own rating for the same show is a different number they can
      // see on their own My Shows.
      setView("friend-active", view);
      renderWithProviders(
        <LibraryActiveList
          data={[makeEntry()]}
          isLoading={false}
          viewerContext={JEANNE}
          callerLibrary={callerLibrary}
          storagePrefix="friend-active"
        />,
      );

      expect(
        screen.getByRole("img", { name: "Jeanne's rating: 4.0 out of 5" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("img", { name: /^your rating/i })).not.toBeInTheDocument();
    });

    it(`attributes the friend's progress in ${view} view`, () => {
      // AC 3, satisfied by grouping the friend's facts under their name rather
      // than by the layout the ticket sketched (spec §6.4).
      setView("friend-active", view);
      renderWithProviders(
        <LibraryActiveList
          data={[makeEntry()]}
          isLoading={false}
          viewerContext={JEANNE}
          callerLibrary={callerLibrary}
          storagePrefix="friend-active"
        />,
      );

      expect(screen.getByText("Jeanne's progress: 38 of 46")).toBeInTheDocument();
      expect(screen.getAllByText("Jeanne:")).toHaveLength(1);
    });
  }

  it("keeps the caller's own comparison labelled as theirs", () => {
    renderWithProviders(
      <LibraryActiveList
        data={[makeEntry()]}
        isLoading={false}
        viewerContext={JEANNE}
        callerLibrary={callerLibrary}
        storagePrefix="friend-active"
      />,
    );
    expect(screen.getByText("You: 12/46")).toBeInTheDocument();
  });

  it("says whose library the mark refers to, on a page that is not yours", () => {
    // AC 4: the mark is the *viewer's* library on every surface, so its label
    // is unconditional rather than context-dependent.
    renderWithProviders(
      <LibraryActiveList
        data={[makeEntry()]}
        isLoading={false}
        viewerContext={JEANNE}
        callerLibrary={callerLibrary}
        storagePrefix="friend-active"
      />,
    );
    expect(screen.getByRole("img", { name: "In your My Shows" })).toBeInTheDocument();
  });

  it("labels the viewer's own rating as theirs on their own library", () => {
    // AC 5: self mode is untouched — same label, same place (the action row).
    renderWithProviders(<LibraryActiveList data={[makeEntry()]} isLoading={false} />);
    expect(screen.getByRole("img", { name: "Your rating: 4.0 out of 5" })).toBeInTheDocument();
    expect(screen.getByText("Progress: 38/46")).toBeInTheDocument();
    expect(screen.queryByText(/Jeanne/)).not.toBeInTheDocument();
  });

  it("draws its row poster through ShowPoster rather than hand-rolling one", () => {
    // NEU-1183 AC 1: the mark sat top-right on a library row and top-left on a
    // Discover card. It is one corner now — asserted once, in
    // `ShowPoster.test.tsx`, and inherited here rather than restated.
    const { container } = renderWithProviders(
      <LibraryActiveList
        data={[makeEntry()]}
        isLoading={false}
        viewerContext={JEANNE}
        callerLibrary={callerLibrary}
        storagePrefix="friend-active"
      />,
    );
    expect(container.querySelector("[data-show-poster]")).not.toBeNull();
    expect(screen.getByRole("img", { name: "In your My Shows" })).toBeInTheDocument();
  });

  it("defaults to self mode", () => {
    renderWithProviders(<LibraryActiveList data={[makeEntry()]} isLoading={false} />);
    expect(SELF.kind).toBe("self");
    expect(screen.queryByText("You: 12/46")).not.toBeInTheDocument();
  });
});
