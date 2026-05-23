import { describe, expect, it } from "vitest";
import { formatStars, tvmazeToFiveStar } from "./rating";

describe("tvmazeToFiveStar", () => {
  it("returns null for null", () => {
    expect(tvmazeToFiveStar(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(tvmazeToFiveStar(undefined)).toBeNull();
  });

  it("converts 10 to 5", () => {
    expect(tvmazeToFiveStar(10)).toBe(5);
  });

  it("converts 0 to 0", () => {
    expect(tvmazeToFiveStar(0)).toBe(0);
  });

  it("rounds 4.7 to one decimal (~2.4)", () => {
    expect(tvmazeToFiveStar(4.7)).toBeCloseTo(2.4, 5);
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
