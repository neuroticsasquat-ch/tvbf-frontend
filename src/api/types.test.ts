import { describe, expect, it } from "vitest";

import { ALL_SORT_KEYS } from "./types";

describe("ALL_SORT_KEYS", () => {
  it("registers popularity both ways, as the API does (NEU-1513)", () => {
    expect(ALL_SORT_KEYS).toContain("popularity");
    expect(ALL_SORT_KEYS).toContain("-popularity");
  });
});
