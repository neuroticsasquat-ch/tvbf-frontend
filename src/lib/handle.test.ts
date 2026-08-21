import { describe, expect, it } from "vitest";

import { HANDLE_SHAPE, isHandleShapeValid, normaliseHandle } from "./handle";

describe("normaliseHandle", () => {
  it("predicts the server's normalisation for the three forms it accepts", () => {
    // NEU-1163 §1.1's own examples: all three store `tomboone`.
    expect(normaliseHandle("TomBoone")).toBe("tomboone");
    expect(normaliseHandle("@TomBoone")).toBe("tomboone");
    expect(normaliseHandle("  @tomboone ")).toBe("tomboone");
  });

  it("strips exactly one sigil", () => {
    expect(normaliseHandle("@@tom")).toBe("@tom");
  });

  it("leaves an already-normal handle alone", () => {
    expect(normaliseHandle("tom_b")).toBe("tom_b");
  });
});

describe("the shape check", () => {
  it("accepts what the server accepts", () => {
    for (const value of ["tom", "tom_boone", "t0m_b", "a".repeat(30)]) {
      expect(isHandleShapeValid(value)).toBe(true);
    }
  });

  it("refuses NEU-1163 §10's own refusal set", () => {
    for (const value of ["ab", "a_very_long_handle_of_thirty_one", "9lives", "_tom", "tom-boone"]) {
      expect(isHandleShapeValid(value)).toBe(false);
    }
  });

  it("passes the two rules it deliberately leaves to the server", () => {
    // A reserved word and the anonymised shape are both well-formed. The
    // client stops at shape (D2), so these submit and are refused upstream.
    expect(isHandleShapeValid("admin")).toBe(true);
    expect(isHandleShapeValid("user_3f4a2b1c")).toBe(true);
  });

  it("checks the normalised form, never the raw one", () => {
    // The server accepts all three, so refusing them here would invert §1.1.
    expect(isHandleShapeValid("TomBoone")).toBe(true);
    expect(isHandleShapeValid("@TomBoone")).toBe(true);
    expect(isHandleShapeValid("  @tomboone ")).toBe(true);
  });

  it("is anchored at both ends", () => {
    expect(HANDLE_SHAPE.test("tom boone")).toBe(false);
    expect(HANDLE_SHAPE.test("tom\nboone")).toBe(false);
  });
});
