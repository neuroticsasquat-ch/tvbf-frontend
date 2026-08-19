import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import type { MyShowEntry, ShowSummary } from "@/api/types";
import { env } from "@/env";
import { server } from "@/test/msw/server";
import { useMyShows, useRecommendations } from "@/api/me";
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
    // NEU-1181 AC 5: same label. Its *place* moved to the poster's top-right
    // in NEU-1187 §3.4, which the assertion below is deliberately silent about
    // — the corner is `ShowPoster.test.tsx`'s to assert.
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

describe("LibraryActiveList self-mode controls (NEU-1187)", () => {
  beforeEach(() => window.localStorage.clear());

  for (const view of ["list", "grid"] as const) {
    it(`carries no action-row control and no library mark in ${view} view`, () => {
      // AC 2. Every row on this tab is in My Shows by definition, so the
      // labelled "✓ My Shows" chip could only say one thing and the mark could
      // only be true.
      setView("my-shows", view);
      renderWithProviders(<LibraryActiveList data={[makeEntry()]} isLoading={false} />);

      // No labelled chip: the labelled variant is the only one with visible
      // text, and its whole cost was the line it occupied.
      expect(screen.queryByText("My Shows")).not.toBeInTheDocument();
      expect(screen.queryByRole("img", { name: "In your My Shows" })).not.toBeInTheDocument();
    });

    it(`offers removal as one activation in ${view} view`, async () => {
      // AC 3: the compact chip in the poster's bottom-right, on the page.
      let deleted = 0;
      server.use(
        http.delete(`${env.apiBaseUrl}/me/shows/1`, () => {
          deleted += 1;
          return new HttpResponse(null, { status: 204 });
        }),
      );
      setView("my-shows", view);
      const { container } = renderWithProviders(
        <LibraryActiveList data={[makeEntry()]} isLoading={false} />,
      );

      const chip = screen.getByRole("button", { name: "Remove The Bear from My Shows" });
      expect(container.querySelector("[data-show-poster]")?.contains(chip)).toBe(true);

      await userEvent.click(chip);
      await waitFor(() => expect(deleted).toBe(1));
    });
  }

  it("puts the viewer's own rating on the row poster, not in an action row", () => {
    // AC 4's other half (§2.4): stripping the button alone leaves a rated row
    // its `RatingBadge` line and its height. NEU-1183's last holdout.
    const { container } = renderWithProviders(
      <LibraryActiveList data={[makeEntry()]} isLoading={false} />,
    );
    const poster = container.querySelector("[data-show-poster]");
    const badge = screen.getByRole("img", { name: "Your rating: 4.0 out of 5" });
    expect(poster?.contains(badge)).toBe(true);
  });

  it("keeps the friend row's labelled button and its action row", () => {
    // Adding is possible on a friend's library, so the control stays labelled
    // and stays in the action row (§3.6).
    renderWithProviders(
      <LibraryActiveList
        data={[makeEntry()]}
        isLoading={false}
        viewerContext={JEANNE}
        callerLibrary={callerLibrary}
        storagePrefix="friend-active"
      />,
    );
    const button = screen.getByRole("button", { name: "Remove The Bear from My Shows" });
    expect(button).toHaveTextContent("My Shows");
    expect(button.closest("[data-show-poster]")).toBeNull();
  });

  it("moves focus to the chip that took the freed slot", async () => {
    // AC 7. The card unmounts on `onMutate`, so focus would otherwise fall to
    // `<body>` on the one surface where removing several shows is expected.
    //
    // The list is driven by `useMyShows()` rather than by a prop, and that is
    // the whole point of the test: `useRemoveShow` is optimistic, so the row
    // leaves the list *before* the request settles. A prop-fed harness updates
    // the list only after the click has been awaited, which is the one ordering
    // under which reporting the removal on success would also look correct.
    const three = [
      makeEntry({ show: makeShow({ id: 1, name: "Andor" }) }),
      makeEntry({ show: makeShow({ id: 2, name: "The Bear" }) }),
      makeEntry({ show: makeShow({ id: 3, name: "Slow Horses" }) }),
    ];
    let remaining = three;
    server.use(
      http.get(`${env.apiBaseUrl}/me/shows`, () => HttpResponse.json(remaining)),
      http.delete(`${env.apiBaseUrl}/me/shows/2`, () => {
        remaining = [three[0], three[2]];
        return new HttpResponse(null, { status: 204 });
      }),
    );

    function Harness() {
      const { data, isLoading } = useMyShows();
      return <LibraryActiveList data={data} isLoading={isLoading} />;
    }
    renderWithProviders(<Harness />);
    await screen.findByText("Slow Horses");

    // The *middle* row, deliberately: removing the first lands on chip 0
    // whether the index is right or wrong, which is the assertion this test
    // exists not to make.
    await userEvent.click(screen.getByRole("button", { name: "Remove The Bear from My Shows" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remove Slow Horses from My Shows" }),
      ).toHaveFocus(),
    );
  });

  it("focuses the results container when the last row goes", async () => {
    server.use(
      http.delete(`${env.apiBaseUrl}/me/shows/1`, () => new HttpResponse(null, { status: 204 })),
    );
    const { container, rerender } = renderWithProviders(
      <LibraryActiveList data={[makeEntry()]} isLoading={false} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Remove The Bear from My Shows" }));
    rerender(<LibraryActiveList data={[]} isLoading={false} />);

    await waitFor(() => {
      const results = container.querySelector<HTMLElement>('[tabindex="-1"]');
      expect(results).not.toBeNull();
      expect(results).toHaveFocus();
      expect(
        within(results!).getByText("You're not tracking any shows yet."),
      ).toBeInTheDocument();
    });
  });

  it("invalidates the recommendations grid when a show leaves My Shows", async () => {
    // AC 5. `GET /me/recommendations` suppresses a suggestion the viewer has a
    // record for as a live join (NEU-1175), so a removal changes that body —
    // and the rule lives in `api/me.ts`, not in any component.
    let recommendationFetches = 0;
    server.use(
      http.delete(`${env.apiBaseUrl}/me/shows/1`, () => new HttpResponse(null, { status: 204 })),
      http.get(`${env.apiBaseUrl}/me/recommendations`, () => {
        recommendationFetches += 1;
        return HttpResponse.json({ recommendations: [] });
      }),
    );

    function Harness() {
      useRecommendations();
      return <LibraryActiveList data={[makeEntry()]} isLoading={false} />;
    }
    renderWithProviders(<Harness />);
    await waitFor(() => expect(recommendationFetches).toBe(1));

    await userEvent.click(screen.getByRole("button", { name: "Remove The Bear from My Shows" }));

    await waitFor(() => expect(recommendationFetches).toBe(2));
  });
});

describe("LibraryActiveList empty states (NEU-1190 §2)", () => {
  beforeEach(() => window.localStorage.clear());

  it("says the viewer tracks nothing when their own library is empty", () => {
    // AC 4. This read "No shows match the current filters." with every picker
    // on "All" — the one list of six that never split the two states.
    renderWithProviders(<LibraryActiveList data={[]} isLoading={false} />);
    expect(screen.getByText("You're not tracking any shows yet.")).toBeInTheDocument();
  });

  it("names the friend when their library is empty", () => {
    renderWithProviders(
      <LibraryActiveList
        data={[]}
        isLoading={false}
        viewerContext={JEANNE}
        storagePrefix="friend-active"
      />,
    );
    expect(screen.getByText("Jeanne isn't tracking any shows.")).toBeInTheDocument();
  });

  for (const [label, prefix, props] of [
    ["self", "my-shows", {}],
    ["a friend's", "friend-active", { viewerContext: JEANNE, storagePrefix: "friend-active" }],
  ] as const) {
    it(`still says so distinctly when filters exclude everything on ${label} library`, () => {
      // AC 5. The filters are the viewer's own in both modes, so this sentence
      // claims nothing about whose library it is and needs no attribution.
      // The filter is set through the persisted state the pickers write, which
      // is what makes the assertion about the message rather than about the
      // picker's option list.
      window.localStorage.setItem(`tvbf:sort:${prefix}-status`, "ended");
      renderWithProviders(<LibraryActiveList data={[makeEntry()]} isLoading={false} {...props} />);

      expect(screen.getByText("No shows match the current filters.")).toBeInTheDocument();
    });
  }
});

describe("LibraryActiveList row links (NEU-1190 §1)", () => {
  beforeEach(() => window.localStorage.clear());

  it("exposes exactly one link per row, and it is the show's name", () => {
    // AC 1. The poster and the title were two links to `/shows/1`, identically
    // named.
    renderWithProviders(<LibraryActiveList data={[makeEntry()]} isLoading={false} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/shows/1");
    expect(links[0]).toHaveTextContent("The Bear");
  });

  it("keeps the poster's rating badge announced, and its control working", () => {
    // The reason the poster drops its link rather than being `aria-hidden`
    // (§1.3) — and the compact My Shows chip rides the same poster, as a
    // sibling of the link that is no longer there.
    renderWithProviders(<LibraryActiveList data={[makeEntry()]} isLoading={false} />);
    expect(screen.getByRole("img", { name: "Your rating: 4.0 out of 5" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove The Bear from My Shows" }),
    ).toBeInTheDocument();
  });
});
