import { describe, expect, it } from "vitest";
import { formatStars, tenPointToFiveStar } from "./rating";

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
