import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ShowSummary } from "@/api/types";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ShowCard } from "./ShowCard";

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

describe("ShowCard", () => {
  it("renders matched AKA when present", () => {
    renderWithProviders(<ShowCard show={makeShow({ matched_aka: "The Chestnut Man" })} />);
    expect(screen.getByText("The Chestnut Man")).toBeInTheDocument();
  });

  it("omits matched AKA element when null", () => {
    renderWithProviders(<ShowCard show={makeShow()} />);
    expect(screen.queryByText(/Matched:/i)).not.toBeInTheDocument();
  });

  it("distinguishes the viewer's rating from the aggregate without hover", () => {
    // NEU-1182 AC 5. The two badges were pixel-identical and separated only by a
    // `title` tooltip, which does not exist on touch — so the accessible names
    // are what this asserts, and neither may be a bare number.
    renderWithProviders(<ShowCard show={makeShow({ rating_average: 8.4, my_rating: 4.5 })} />);
    expect(screen.getByRole("img", { name: "Your rating: 4.5 out of 5" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "TMDB average: 4.2 out of 5" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "4.5" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "4.2" })).not.toBeInTheDocument();
  });

  it("renders the name and date lines and no body text under them", () => {
    // The card used to carry a recommendation's model-authored `reason` as one
    // truncated 10px line. The server stopped serving it — that is not room for
    // a sentence — so the card's own lines are all there are.
    renderWithProviders(<ShowCard show={makeShow({ premiered: "2021-09-29" })} />);
    expect(screen.getByText("Kastanjemanden")).toBeInTheDocument();
    expect(screen.getByText("2021")).toBeInTheDocument();
  });

  it("marks a show the viewer already tracks, naming the mark once", () => {
    renderWithProviders(<ShowCard show={makeShow()} inMyShows />);
    expect(screen.getByRole("img", { name: "In your My Shows" })).toBeInTheDocument();
    expect(screen.getByTitle("In your My Shows")).toBeInTheDocument();
  });

  it("renders no mark when the card carries no in-My-Shows flag", () => {
    renderWithProviders(<ShowCard show={makeShow()} />);
    expect(screen.queryByTitle("In your My Shows")).not.toBeInTheDocument();
  });

  it("renders the premiere year by default", () => {
    renderWithProviders(<ShowCard show={makeShow({ premiered: "2021-09-29" })} />);
    expect(screen.getByText("2021")).toBeInTheDocument();
  });

  it("renders the full premiere date when asked for one", () => {
    // Most Anticipated's surface (NEU-1060): every entry premieres inside one
    // window, so the year alone separates almost nothing.
    renderWithProviders(
      <ShowCard show={makeShow({ premiered: "2027-02-18" })} premiereDisplay="date" />,
    );
    expect(screen.getByText("Feb 18, 2027")).toBeInTheDocument();
  });

  it("renders the premiere date from its parts, not as a UTC instant", () => {
    // `new Date("2027-01-01")` is midnight UTC and renders as Dec 31 for any
    // viewer west of it — the same trap the Upcoming lists avoid.
    renderWithProviders(
      <ShowCard show={makeShow({ premiered: "2027-01-01" })} premiereDisplay="date" />,
    );
    expect(screen.getByText("Jan 1, 2027")).toBeInTheDocument();
  });

  it("reads an undated show as a dash on a year card and TBA on a date card", () => {
    const { unmount } = renderWithProviders(<ShowCard show={makeShow({ premiered: null })} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    unmount();

    renderWithProviders(<ShowCard show={makeShow({ premiered: null })} premiereDisplay="date" />);
    expect(screen.getByText("TBA")).toBeInTheDocument();
  });

  it("reads an unparseable premiere date as TBA rather than an Invalid Date", () => {
    renderWithProviders(<ShowCard show={makeShow({ premiered: "soon" })} premiereDisplay="date" />);
    expect(screen.getByText("TBA")).toBeInTheDocument();
    expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument();
  });

  it("renders an add control only when the surface asks for one", () => {
    // The containment seam (NEU-1176): the card is shared by trending, most
    // anticipated, similar shows, search and browse, so a control that belongs
    // to one surface is opt-in and absent by default. Asserted here, in the
    // shared component, rather than once per grid.
    renderWithProviders(<ShowCard show={makeShow()} addable />);
    expect(
      screen.getByRole("button", { name: "Add Kastanjemanden to My Shows" }),
    ).toBeInTheDocument();
  });

  it("renders no add control by default", () => {
    renderWithProviders(<ShowCard show={makeShow()} />);
    expect(screen.queryByRole("button", { name: /My Shows/ })).not.toBeInTheDocument();
  });

  it("keeps the add control outside the card's link", () => {
    // A `<button>` inside an `<a>` is invalid content nesting and a real
    // focus-order problem, so activating it can never navigate.
    renderWithProviders(<ShowCard show={makeShow()} addable />);
    const button = screen.getByRole("button", { name: "Add Kastanjemanden to My Shows" });
    expect(button.closest("a")).toBeNull();
  });

  it("renders a dismiss control only when the surface asks for one", () => {
    // The same containment seam one control further along (NEU-1179): only
    // "My Recommendations" passes `dismissible`, and asserting its absence
    // here covers trending, most anticipated, similar shows, search and browse
    // in one place rather than once per grid.
    renderWithProviders(<ShowCard show={makeShow()} dismissible />);
    expect(
      screen.getByRole("button", { name: /Don't recommend Kastanjemanden again/i }),
    ).toBeInTheDocument();
  });

  it("renders no dismiss control by default", () => {
    renderWithProviders(<ShowCard show={makeShow()} />);
    expect(screen.queryByRole("button", { name: /Don't recommend/i })).not.toBeInTheDocument();
  });

  it("keeps the dismiss control outside the card's link", () => {
    // AC 2: activating it can never navigate, because it is a sibling of the
    // `Link` rather than a descendant — no `preventDefault` needed.
    renderWithProviders(<ShowCard show={makeShow()} dismissible />);
    const chip = screen.getByRole("button", { name: /Don't recommend/i });
    expect(chip.closest("a")).toBeNull();
  });

  it("draws its poster through ShowPoster rather than hand-rolling one", () => {
    // The tripwire (NEU-1183 AC 3): placement is inherited from `ShowPoster`,
    // which is where the corner rule is asserted. A surface that hand-rolls a
    // poster is a surface that has stated a corner of its own.
    const { container } = renderWithProviders(<ShowCard show={makeShow()} inMyShows />);
    expect(container.querySelector("[data-show-poster]")).not.toBeNull();
  });

  it("hands the dismiss chip to the poster's control slot, stating no corner", () => {
    // AC 4: the chip used to position itself top-right — the corner the
    // viewer's rating owns — and was safe only by coincidence. It is now the
    // poster's `control`, so which corner it lands in is asserted once, in
    // `ShowPoster.test.tsx`, and this card states nothing about it.
    renderWithProviders(<ShowCard show={makeShow()} dismissible />);
    const chip = screen.getByRole("button", { name: /Don't recommend/i });
    expect(chip.closest("[data-show-poster]")).not.toBeNull();
    expect(chip.className).not.toContain("absolute");
  });

  it("hides rating badges when both are null", () => {
    renderWithProviders(<ShowCard show={makeShow()} />);
    expect(screen.queryByTitle("TMDB average")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Your rating")).not.toBeInTheDocument();
  });
});
