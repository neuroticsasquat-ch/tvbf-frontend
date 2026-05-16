import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StarRatingDisplay } from "./StarRatingDisplay";

describe("StarRatingDisplay", () => {
  it("renders aria-label with formatted value", () => {
    render(<StarRatingDisplay value={3.5} />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "3.5 out of 5");
  });

  it("handles 0", () => {
    render(<StarRatingDisplay value={0} />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "0.0 out of 5");
  });

  it("handles 5", () => {
    render(<StarRatingDisplay value={5} />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "5.0 out of 5");
  });
});
