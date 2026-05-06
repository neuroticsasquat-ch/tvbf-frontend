import { describe, expect, it, afterEach, vi } from "vitest";
import { localToday } from "./today";

describe("localToday", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns YYYY-MM-DD using the device's local date components", () => {
    const fake = new Date(2026, 4, 6, 18, 14, 0); // months are 0-indexed: 4 = May
    vi.useFakeTimers();
    vi.setSystemTime(fake);
    expect(localToday()).toBe("2026-05-06");
  });

  it("zero-pads month and day", () => {
    const fake = new Date(2026, 0, 3, 9, 0, 0); // Jan 3
    vi.useFakeTimers();
    vi.setSystemTime(fake);
    expect(localToday()).toBe("2026-01-03");
  });
});
