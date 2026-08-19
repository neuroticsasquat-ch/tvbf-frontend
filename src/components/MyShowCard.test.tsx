import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MyShowEntry, ShowSummary } from "@/api/types";
import type { RatingOwner } from "@/lib/rating";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MyShowCard } from "./MyShowCard";

function makeShow(overrides: Partial<ShowSummary> = {}): ShowSummary {
  return {
    id: 1,
    name: "Test Show",
    type: null,
    status: "Returning Series",
    language: null,
    premiered: "2020-01-01",
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

function makeEntry(
  my_rating: number | null = null,
  overrides: Partial<MyShowEntry> = {},
): MyShowEntry {
  return {
    show: makeShow(),
    watched_episode_count: 0,
    total_episode_count: 10,
    aired_episode_count: 10,
    upcoming_episode_count: 0,
    last_aired: null,
    last_watched_at: null,
    first_watched_at: null,
    next_episode: null,
    added_at: "2026-01-01T00:00:00Z",
    my_rating,
    ...overrides,
  };
}

const YOU: RatingOwner = { kind: "own" };
const JEANNE: RatingOwner = { kind: "other", ownerName: "Jeanne" };

describe("MyShowCard", () => {
  it("renders my-rating badge when my_rating is set", () => {
    renderWithProviders(<MyShowCard entry={makeEntry(4)} ratingOwner={YOU} inMyShows />);
    expect(screen.getByRole("img", { name: "Your rating: 4.0 out of 5" })).toBeInTheDocument();
  });

  it("hides my-rating badge when my_rating is null", () => {
    renderWithProviders(<MyShowCard entry={makeEntry(null)} ratingOwner={YOU} inMyShows />);
    expect(screen.queryByRole("img", { name: /rating:/ })).not.toBeInTheDocument();
  });

  it("marks a tracked show with the shared library badge, not a green check", () => {
    // The same assertion `ShowCard.test.tsx` makes, which is the point: one
    // claim, one picture. This card drew its own emerald ✓ until the three
    // definitions were unified on `InMyShowsBadge`, and emerald means *watched*
    // everywhere else in the app.
    renderWithProviders(<MyShowCard entry={makeEntry(null)} ratingOwner={YOU} inMyShows />);
    expect(screen.getByRole("img", { name: "In your My Shows" })).toBeInTheDocument();
  });

  it("attributes a friend's rating to the friend, never to the viewer", () => {
    // NEU-1181 AC 1/2 at grid density. The friend endpoint hydrates `my_rating`
    // for the *friend's* user id, and this card is the surface that used to
    // render it under a hard-coded "Your rating".
    renderWithProviders(<MyShowCard entry={makeEntry(4)} ratingOwner={JEANNE} inMyShows />);
    expect(screen.getByRole("img", { name: "Jeanne's rating: 4.0 out of 5" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /your rating/i })).not.toBeInTheDocument();
  });

  it("names a friend once visibly and attributes each of their facts", () => {
    renderWithProviders(
      <MyShowCard
        entry={makeEntry(4, { watched_episode_count: 3, aired_episode_count: 10 })}
        ratingOwner={JEANNE}
        inMyShows
      />,
    );
    expect(screen.getAllByText("Jeanne:")).toHaveLength(1);
    expect(screen.getByText("Jeanne's progress: 3 of 10")).toBeInTheDocument();
    // The friend's fraction is not offered as the viewer's unlabelled progress.
    expect(screen.queryByText(/^Progress: 3\/10$/)).not.toBeInTheDocument();
  });

  it("renders no mark when the show is not in My Shows", () => {
    renderWithProviders(<MyShowCard entry={makeEntry(null)} ratingOwner={YOU} inMyShows={false} />);
    expect(screen.queryByTitle("In your My Shows")).not.toBeInTheDocument();
  });

  it("draws its poster through ShowPoster rather than hand-rolling one", () => {
    // NEU-1183 AC 3. Both this card's corners moved with it: the mark from
    // top-right to top-left and the rating from bottom-left to top-right, and
    // neither is stated here — which is the point.
    const { container } = renderWithProviders(
      <MyShowCard entry={makeEntry(4)} ratingOwner={YOU} inMyShows />,
    );
    expect(container.querySelector("[data-show-poster]")).not.toBeNull();
  });

  it("draws the compact remove chip when the surface opts in", () => {
    // NEU-1187 §3.3 — through the poster, which is what assigns the corner.
    const { container } = renderWithProviders(
      <MyShowCard entry={makeEntry(null)} ratingOwner={YOU} inMyShows={false} removable />,
    );
    const poster = container.querySelector("[data-show-poster]");
    expect(poster?.querySelector("[data-remove-from-my-shows]")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Remove Test Show from My Shows" }),
    ).toBeInTheDocument();
  });

  it("renders no remove chip on a friend's card, even when the surface asks", () => {
    // The card is shared with a friend's library, where the entry is in *their*
    // My Shows: a chip there would offer to remove a show the viewer may never
    // have had, and would DELETE one they do.
    const { container } = renderWithProviders(
      <MyShowCard entry={makeEntry(null)} ratingOwner={JEANNE} inMyShows={false} removable />,
    );
    expect(container.querySelector("[data-remove-from-my-shows]")).toBeNull();
  });

  it("renders no action row by default", () => {
    // NEU-1188's opt-in seam, asserted absent here rather than once per grid:
    // the containment pattern `ShowCard.test.tsx` established for `addable`.
    renderWithProviders(<MyShowCard entry={makeEntry(null)} ratingOwner={YOU} inMyShows={false} />);
    expect(screen.queryByRole("button", { name: /My Shows$/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/^You: /)).not.toBeInTheDocument();
  });

  it("draws the labelled button and the viewer's comparison when the surface opts in", () => {
    // NEU-1188 AC 2/3. The Watched grid could not add a show to My Shows at
    // all, and a friend's grid offered neither control nor comparison — both
    // of which its list rows have always carried.
    const { container } = renderWithProviders(
      <MyShowCard
        entry={makeEntry(null)}
        ratingOwner={JEANNE}
        inMyShows={false}
        callerRelationship={{ inMyShows: false, progress: { watched: 3, aired: 10 } }}
      />,
    );
    const button = screen.getByRole("button", { name: "Add Test Show to My Shows" });
    expect(button).toHaveTextContent("My Shows");
    // Adding is possible here, so the control is labelled and sits *outside*
    // the poster — the position is what says which (NEU-1187 §3.1).
    expect(button.closest("[data-show-poster]")).toBeNull();
    expect(container.contains(button)).toBe(true);
    expect(screen.getByText("You: 3/10")).toBeInTheDocument();
  });

  it("omits the comparison when the viewer has watched nothing", () => {
    renderWithProviders(
      <MyShowCard
        entry={makeEntry(null)}
        ratingOwner={JEANNE}
        inMyShows
        callerRelationship={{ inMyShows: true, progress: null }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Remove Test Show from My Shows" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^You: /)).not.toBeInTheDocument();
  });

  it("carries the last-watched date, which is a per-person fact", () => {
    // NEU-1188 AC 7. It was hard-coded `null` on the grounds that this is the
    // densest surface — an argument for thinning *ownerless* metadata, which
    // this is not, and on Watched it is the tab's default sort key.
    renderWithProviders(
      <MyShowCard
        entry={makeEntry(null, { last_watched_at: "2026-04-15T00:00:00Z" })}
        ratingOwner={YOU}
        inMyShows
      />,
    );
    expect(screen.getByText(/Last Watched:/i)).toBeInTheDocument();
  });

  it("renders no remove chip by default", () => {
    // The containment-seam assertion, per `ShowCard.test.tsx`'s pattern: an
    // affordance belonging to one surface is absent everywhere else.
    const { container } = renderWithProviders(
      <MyShowCard entry={makeEntry(null)} ratingOwner={YOU} inMyShows={false} />,
    );
    expect(container.querySelector("[data-remove-from-my-shows]")).toBeNull();
  });
});
