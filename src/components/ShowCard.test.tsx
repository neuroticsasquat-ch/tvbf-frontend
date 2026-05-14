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
});
