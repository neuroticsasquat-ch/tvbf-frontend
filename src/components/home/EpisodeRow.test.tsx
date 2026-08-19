import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";

import type { EpisodeOut, ShowSummary } from "@/api/types";
import { renderWithProviders } from "@/test/renderWithProviders";
import { EpisodeRow } from "./EpisodeRow";

const SHOW: ShowSummary = {
  id: 7,
  name: "Slow Horses",
  type: "Scripted",
  status: "Returning Series",
  language: "en",
  premiered: "2022-04-01",
  ended: null,
  image_medium: "https://img.example/poster.jpg",
  image_original: null,
  network: { id: 3, name: "Apple TV+" },
  web_channel: null,
  genres: ["Drama"],
  matched_aka: null,
  rating_average: 8.1,
  my_rating: null,
};

const EPISODE: EpisodeOut = {
  id: 55,
  show_id: 7,
  season_id: 2,
  season: 4,
  number: 3,
  name: "Hard Landing",
  airdate: "2026-09-11",
  airtime: null,
  runtime: 48,
  summary: null,
  // A still exists on 0.18% of mirrored episodes and on none belonging to a
  // tracked show, so the row must not be drawing this even when it is present.
  image_medium: "https://img.example/still.jpg",
  image_original: null,
  watched: false,
  rating_average: null,
  my_rating: null,
};

describe("EpisodeRow (NEU-1189 AC 3)", () => {
  it("draws the show poster through ShowPoster, not the episode still", () => {
    const { container } = renderWithProviders(<EpisodeRow show={SHOW} episode={EPISODE} />);
    // The tripwire NEU-1183 installed: every poster in the app is this
    // component, so a hand-rolled `<img>` here would fail rather than drift.
    expect(container.querySelector("[data-show-poster]")).not.toBeNull();
    const images = [...container.querySelectorAll("img")].map((i) => i.getAttribute("src"));
    expect(images).toEqual(["https://img.example/poster.jpg"]);
    expect(images).not.toContain("https://img.example/still.jpg");
  });

  it("links the poster to the show and the episode text to the episode", () => {
    renderWithProviders(<EpisodeRow show={SHOW} episode={EPISODE} />);
    // The poster's accessible name is the show's, so its destination has to be
    // the show's too.
    expect(screen.getByRole("link", { name: "Slow Horses" })).toHaveAttribute("href", "/shows/7");
    expect(screen.getByRole("link", { name: /Hard Landing/ })).toHaveAttribute(
      "href",
      "/episodes/55",
    );
  });

  it("carries the episode's number, title and airdate", () => {
    renderWithProviders(<EpisodeRow show={SHOW} episode={EPISODE} />);
    expect(screen.getByText("S4E3")).toBeInTheDocument();
    expect(screen.getByText("Hard Landing")).toBeInTheDocument();
    expect(screen.getByText(/Fri, Sep 11, 2026 · 48 min/)).toBeInTheDocument();
  });

  it("renders a trailing action only when one is passed", () => {
    const { rerender } = renderWithProviders(<EpisodeRow show={SHOW} episode={EPISODE} />);
    expect(screen.queryByRole("button")).toBeNull();
    rerender(
      <EpisodeRow show={SHOW} episode={EPISODE} action={<button type="button">Watched</button>} />,
    );
    expect(screen.getByRole("button", { name: "Watched" })).toBeInTheDocument();
  });
});
