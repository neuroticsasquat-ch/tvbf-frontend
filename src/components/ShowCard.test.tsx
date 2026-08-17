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

  it("renders both aggregate and my_rating badges when present", () => {
    renderWithProviders(<ShowCard show={makeShow({ rating_average: 8.4, my_rating: 4.5 })} />);
    expect(screen.getByTitle("TMDB average")).toBeInTheDocument();
    expect(screen.getByTitle("Your rating")).toBeInTheDocument();
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
    expect(screen.getByRole("img", { name: "In My Shows" })).toBeInTheDocument();
    expect(screen.getByTitle("In My Shows")).toBeInTheDocument();
  });

  it("renders no mark when the card carries no in-My-Shows flag", () => {
    renderWithProviders(<ShowCard show={makeShow()} />);
    expect(screen.queryByTitle("In My Shows")).not.toBeInTheDocument();
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

  it("hides rating badges when both are null", () => {
    renderWithProviders(<ShowCard show={makeShow()} />);
    expect(screen.queryByTitle("TMDB average")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Your rating")).not.toBeInTheDocument();
  });
});
