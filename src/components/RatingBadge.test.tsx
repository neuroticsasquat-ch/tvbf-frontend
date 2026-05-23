import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RatingBadge } from "./RatingBadge";

describe("RatingBadge", () => {
  it("renders nothing when value is null", () => {
    const { container } = render(<RatingBadge value={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when value is undefined", () => {
    const { container } = render(<RatingBadge value={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for 0", () => {
    const { container } = render(<RatingBadge value={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders formatted value when present", () => {
    render(<RatingBadge value={4.2} title="TV Maze average" />);
    expect(screen.getByText("4.2")).toBeInTheDocument();
    expect(screen.getByText("4.2").parentElement).toHaveAttribute("title", "TV Maze average");
  });
});
