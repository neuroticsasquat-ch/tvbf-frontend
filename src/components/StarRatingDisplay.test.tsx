import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StarRatingDisplay } from "./StarRatingDisplay";

describe("StarRatingDisplay", () => {
  it("names the viewer's own rating", () => {
    render(<StarRatingDisplay kind="own" value={3.5} />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Your rating: 3.5 out of 5");
  });

  it("names an aggregate by its crowd", () => {
    render(<StarRatingDisplay kind="aggregate" crowdName="Friends" value={4.25} />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Friends average: 4.3 out of 5");
  });

  it("names another person's rating by its owner", () => {
    render(<StarRatingDisplay kind="other" ownerName="Alice" value={5} />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Alice's rating: 5.0 out of 5");
  });

  it("handles 0", () => {
    render(<StarRatingDisplay kind="own" value={0} />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Your rating: 0.0 out of 5");
  });

  it("draws an aggregate muted, keeping the fill that encodes the value", () => {
    // The fill is how a five-star draws its value, so it cannot also carry the
    // kind here — an unfilled aggregate rendered as five identical faint
    // outlines and lost the number entirely. Colour is the kind channel.
    const { container } = render(<StarRatingDisplay kind="aggregate" crowdName="TMDB" value={4} />);
    const overlay = container.querySelector<HTMLElement>("span > span:nth-of-type(2)");
    expect(overlay?.className).toContain("text-muted-foreground");
    expect(overlay?.className).not.toContain("text-amber-500");
    expect(overlay?.querySelector("svg")?.getAttribute("class")).toContain("fill-current");
    expect(overlay).toHaveStyle({ width: "80%" });
  });

  it("draws a person's rating filled amber", () => {
    const { container } = render(<StarRatingDisplay kind="other" ownerName="Alice" value={4} />);
    const overlay = container.querySelector<HTMLElement>("span > span:nth-of-type(2)");
    expect(overlay?.className).toContain("text-amber-500");
    expect(overlay?.querySelector("svg")?.getAttribute("class")).toContain("fill-current");
  });
});
