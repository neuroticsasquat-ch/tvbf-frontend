import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./relativeTime";

describe("formatRelativeTime", () => {
  const now = new Date("2026-05-13T12:00:00Z");

  it("returns 'just now' for very recent timestamps", () => {
    const recent = new Date(now.getTime() - 5 * 1000).toISOString();
    expect(formatRelativeTime(recent, now)).toBe("just now");
  });

  it("formats minutes ago", () => {
    const t = new Date(now.getTime() - 3 * 60 * 1000).toISOString();
    expect(formatRelativeTime(t, now)).toMatch(/3 minutes ago/);
  });

  it("formats hours ago", () => {
    const t = new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(t, now)).toMatch(/5 hours ago/);
  });

  it("formats days ago", () => {
    const t = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(t, now)).toMatch(/4 days ago/);
  });
});
