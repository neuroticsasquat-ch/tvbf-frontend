import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RatingBadge } from "./RatingBadge";

describe("RatingBadge", () => {
  it("renders nothing when value is null", () => {
    const { container } = render(<RatingBadge kind="own" value={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when value is undefined", () => {
    const { container } = render(<RatingBadge kind="own" value={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for 0", () => {
    const { container } = render(<RatingBadge kind="own" value={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("names the viewer's own rating", () => {
    render(<RatingBadge kind="own" value={4.5} />);
    expect(screen.getByRole("img", { name: "Your rating: 4.5 out of 5" })).toBeInTheDocument();
  });

  it("names an aggregate by its crowd", () => {
    render(<RatingBadge kind="aggregate" crowdName="TMDB" value={4.1} />);
    expect(screen.getByRole("img", { name: "TMDB average: 4.1 out of 5" })).toBeInTheDocument();
  });

  it("names another person's rating by its owner", () => {
    render(<RatingBadge kind="other" ownerName="Jeanne" value={4} />);
    expect(screen.getByRole("img", { name: "Jeanne's rating: 4.0 out of 5" })).toBeInTheDocument();
  });

  it("keeps the tooltip in step with the accessible name", () => {
    render(<RatingBadge kind="aggregate" crowdName="TMDB" value={4.1} />);
    expect(screen.getByRole("img")).toHaveAttribute("title", "TMDB average: 4.1 out of 5");
  });

  it("draws a person's rating filled amber and a crowd's unfilled muted", () => {
    const { container: own } = render(<RatingBadge kind="own" value={4.5} />);
    const { container: crowd } = render(
      <RatingBadge kind="aggregate" crowdName="TMDB" value={4.1} />,
    );
    const ownStar = own.querySelector("svg");
    const crowdStar = crowd.querySelector("svg");
    expect(ownStar?.getAttribute("class")).toContain("fill-current");
    expect(ownStar?.getAttribute("class")).toContain("text-amber-500");
    expect(crowdStar?.getAttribute("class")).not.toContain("fill-current");
    expect(crowdStar?.getAttribute("class")).toContain("text-muted-foreground");
  });
});
