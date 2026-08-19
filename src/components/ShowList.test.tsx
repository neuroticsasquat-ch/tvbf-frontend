import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ShowSummary } from "@/api/types";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ShowList } from "./ShowList";

function makeShow(overrides: Partial<ShowSummary> = {}): ShowSummary {
  return {
    id: 1,
    name: "Kastanjemanden",
    type: "Scripted",
    status: "Ended",
    language: "Danish",
    premiered: "2021-09-29",
    ended: null,
    image_medium: null,
    image_original: null,
    network: null,
    web_channel: null,
    genres: ["Drama"],
    matched_aka: null,
    rating_average: null,
    my_rating: null,
    ...overrides,
  };
}

describe("ShowList", () => {
  it("renders 'Matched: <aka>' when matched_aka is present", () => {
    renderWithProviders(<ShowList shows={[makeShow({ matched_aka: "The Chestnut Man" })]} />);
    expect(screen.getByText(/Matched: The Chestnut Man/i)).toBeInTheDocument();
  });

  it("does not render 'Matched:' when matched_aka is null", () => {
    renderWithProviders(<ShowList shows={[makeShow()]} />);
    expect(screen.queryByText(/Matched:/i)).not.toBeInTheDocument();
  });

  it("carries the library mark, the viewer's rating and the crowd's", () => {
    // NEU-1188 AC 1. This row rendered no badge of any kind: switching from the
    // grid lost the answer to "do I already have this?" on the one surface
    // where that is the question. NEU-1186 landed the mark on the grid and
    // deferred the row here rather than giving it a mark and still no rating.
    renderWithProviders(
      <ShowList
        shows={[{ ...makeShow({ my_rating: 4.5, rating_average: 8.2 }), in_my_shows: true }]}
      />,
    );
    expect(screen.getByRole("img", { name: "In your My Shows" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Your rating: 4.5 out of 5" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "TMDB average: 4.1 out of 5" })).toBeInTheDocument();
  });

  it("renders no mark on an untracked show, and none at all without the field", () => {
    // `in_my_shows` is optional on the way in, exactly as it is on `ShowGrid`,
    // so a payload that predates the field renders a row without a mark rather
    // than a false one.
    const { rerender } = renderWithProviders(
      <ShowList shows={[{ ...makeShow(), in_my_shows: false }]} />,
    );
    expect(screen.queryByRole("img", { name: "In your My Shows" })).not.toBeInTheDocument();
    rerender(<ShowList shows={[makeShow()]} />);
    expect(screen.queryByRole("img", { name: "In your My Shows" })).not.toBeInTheDocument();
  });

  it("draws its poster through ShowPoster rather than hand-rolling one", () => {
    // NEU-1183's tripwire: the corner each badge lands in is asserted once, in
    // `ShowPoster.test.tsx`, and this row inherits it rather than restating it.
    const { container } = renderWithProviders(<ShowList shows={[makeShow()]} />);
    expect(container.querySelector("[data-show-poster]")).not.toBeNull();
  });

  it("keeps the poster and the name pointing at the show", () => {
    // The row was one `<Link>` over everything and is now two, because
    // `ShowPoster` owns its own link and an `<a>` inside an `<a>` is invalid.
    renderWithProviders(<ShowList shows={[makeShow()]} />);
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("href", "/shows/1");
    }
  });
});
