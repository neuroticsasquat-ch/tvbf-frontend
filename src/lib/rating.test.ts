import { describe, expect, it } from "vitest";
import { formatStars, ratingLabel, tenPointToFiveStar } from "./rating";

describe("tenPointToFiveStar", () => {
  it("returns null for null", () => {
    expect(tenPointToFiveStar(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(tenPointToFiveStar(undefined)).toBeNull();
  });

  it("converts 10 to 5", () => {
    expect(tenPointToFiveStar(10)).toBe(5);
  });

  it("converts 0 to 0", () => {
    expect(tenPointToFiveStar(0)).toBe(0);
  });

  it("rounds 4.7 to one decimal (~2.4)", () => {
    expect(tenPointToFiveStar(4.7)).toBeCloseTo(2.4, 5);
  });
});

describe("formatStars", () => {
  it("formats 4 as '4.0'", () => {
    expect(formatStars(4)).toBe("4.0");
  });

  it("formats 4.7 as '4.7'", () => {
    expect(formatStars(4.7)).toBe("4.7");
  });
});

describe("ratingLabel", () => {
  it("names the viewer's own rating", () => {
    expect(ratingLabel({ kind: "own" }, 4.5)).toBe("Your rating: 4.5 out of 5");
  });

  it("names an aggregate by its crowd, so a friend group is not announced as TMDB", () => {
    expect(ratingLabel({ kind: "aggregate", crowdName: "TMDB" }, 4.1)).toBe(
      "TMDB average: 4.1 out of 5",
    );
    expect(ratingLabel({ kind: "aggregate", crowdName: "Friends" }, 4.25)).toBe(
      "Friends average: 4.3 out of 5",
    );
  });

  it("names another person's rating by its owner", () => {
    expect(ratingLabel({ kind: "other", ownerName: "Jeanne" }, 4)).toBe(
      "Jeanne's rating: 4.0 out of 5",
    );
  });

  it("never renders a bare number", () => {
    expect(ratingLabel({ kind: "own" }, 3)).not.toBe("3.0");
  });
});
