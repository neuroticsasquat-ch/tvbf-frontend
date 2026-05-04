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
});
