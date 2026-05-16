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
    renderWithProviders(
      <ShowCard show={makeShow({ rating_average: 8.4, my_rating: 4.5 })} />,
    );
    expect(screen.getByTitle("TV Maze average")).toBeInTheDocument();
    expect(screen.getByTitle("Your rating")).toBeInTheDocument();
  });

  it("hides rating badges when both are null", () => {
    renderWithProviders(<ShowCard show={makeShow()} />);
    expect(screen.queryByTitle("TV Maze average")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Your rating")).not.toBeInTheDocument();
  });
});
