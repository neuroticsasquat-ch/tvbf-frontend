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
    language: "da",
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

  it("renders no My Shows control unless `addable` is passed", () => {
    // NEU-1192 AC 5. The prop is opt-in for `ShowGrid`'s reason: the component
    // is shared, and every caller that says nothing keeps the default.
    renderWithProviders(<ShowList shows={[makeShow()]} />);
    expect(screen.queryByRole("button", { name: /My Shows/i })).not.toBeInTheDocument();
  });

  it("offers to add an untracked show, and to remove a tracked one, when `addable`", () => {
    // The labelled chip's two states are the completed-action feedback: a
    // search result stays on screen after the add, so the state change is the
    // only confirmation there is. The name is in the accessible name because
    // fifty identical "Add to My Shows" buttons are unnavigable (NEU-1187 §D3).
    const { rerender } = renderWithProviders(
      <ShowList shows={[{ ...makeShow(), in_my_shows: false }]} addable />,
    );
    const add = screen.getByRole("button", { name: "Add Kastanjemanden to My Shows" });
    expect(add).toBeInTheDocument();
    // The **labelled** variant, asserted on its visible text: the compact chip
    // is icon-only and shares this accessible-name shape, so the name alone
    // would pass for the variant NEU-1187 §3.1 reserves for surfaces where
    // adding is impossible — which search is not.
    expect(add).toHaveTextContent("My Shows");

    rerender(<ShowList shows={[{ ...makeShow(), in_my_shows: true }]} addable />);
    expect(
      screen.getByRole("button", { name: "Remove Kastanjemanden from My Shows" }),
    ).toHaveTextContent("My Shows");
  });

  it("draws its poster through ShowPoster rather than hand-rolling one", () => {
    // NEU-1183's tripwire: the corner each badge lands in is asserted once, in
    // `ShowPoster.test.tsx`, and this row inherits it rather than restating it.
    const { container } = renderWithProviders(<ShowList shows={[makeShow()]} />);
    expect(container.querySelector("[data-show-poster]")).not.toBeNull();
  });

  it("exposes exactly one link per row, and it is the show's name", () => {
    // NEU-1190 AC 1. NEU-1188 left the poster and the name as two links with
    // the same accessible name to the same destination — one tab stop per row
    // that offered nothing. The poster is presentational now.
    renderWithProviders(<ShowList shows={[makeShow()]} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/shows/1");
    expect(links[0]).toHaveTextContent("Kastanjemanden");
  });

  it("keeps the poster's badges announced even though it is no longer a link", () => {
    // The reason the poster drops its link rather than being `aria-hidden`
    // (§1.3): hiding the subtree would delete both labels from every row.
    renderWithProviders(
      <ShowList shows={[{ ...makeShow({ my_rating: 4.5 }), in_my_shows: true }]} />,
    );
    expect(screen.getByRole("img", { name: "In your My Shows" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Your rating: 4.5 out of 5" })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("prints the language as an English name, never its ISO code", () => {
    // AC 6. `show.language` has carried `original_language` since NEU-1047, so
    // this line read `NBC · Ended · en`.
    renderWithProviders(
      <ShowList shows={[makeShow({ language: "en", status: "Ended", network: null })]} />,
    );
    expect(screen.getByText("Ended · English")).toBeInTheDocument();
  });

  it("omits the language segment for a code it cannot map, separators intact", () => {
    // TMDB's non-standard `cn` for Cantonese. Printing it back is exactly what
    // AC 6 forbids, so the segment is absent rather than raw — and the segments
    // either side of it keep their one `·`, which is why this row carries a
    // network: with a single remaining segment a dangling separator could not
    // show up at all.
    renderWithProviders(
      <ShowList
        shows={[makeShow({ language: "cn", status: "Ended", network: { id: 9, name: "NBC" } })]}
      />,
    );
    expect(screen.getByText("NBC · Ended")).toBeInTheDocument();
    expect(screen.queryByText(/\bcn\b/)).not.toBeInTheDocument();
  });

  it("renders no language segment when the show has none", () => {
    renderWithProviders(
      <ShowList
        shows={[makeShow({ language: null, status: "Ended", network: { id: 9, name: "NBC" } })]}
      />,
    );
    expect(screen.getByText("NBC · Ended")).toBeInTheDocument();
  });
});
