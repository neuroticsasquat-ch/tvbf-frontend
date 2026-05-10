import { describe, expect, it } from "vitest";
import { matchesStatus } from "./filterTypes";
import type { ShowSummary } from "@/api/types";

function showWith(status: string | null): ShowSummary {
  return {
    id: 1,
    name: "S",
    type: null,
    status,
    language: null,
    premiered: null,
    ended: null,
    image_medium: null,
    image_original: null,
    network: null,
    web_channel: null,
    genres: [],
    matched_aka: null,
  };
}

describe("matchesStatus", () => {
  it("'all' matches everything including unknown statuses", () => {
    expect(matchesStatus(showWith("Running"), "all")).toBe(true);
    expect(matchesStatus(showWith(null), "all")).toBe(true);
  });

  it("'running' matches Running case-insensitively", () => {
    expect(matchesStatus(showWith("Running"), "running")).toBe(true);
    expect(matchesStatus(showWith("Ended"), "running")).toBe(false);
  });

  it("'ended' matches Ended", () => {
    expect(matchesStatus(showWith("Ended"), "ended")).toBe(true);
  });

  it("'upcoming' matches In Development", () => {
    expect(matchesStatus(showWith("In Development"), "upcoming")).toBe(true);
  });

  it("'upcoming' does NOT match To Be Determined", () => {
    expect(matchesStatus(showWith("To Be Determined"), "upcoming")).toBe(false);
  });

  it("'upcoming' does NOT match Running or Ended", () => {
    expect(matchesStatus(showWith("Running"), "upcoming")).toBe(false);
    expect(matchesStatus(showWith("Ended"), "upcoming")).toBe(false);
  });

  it("returns false when show.status is null and a specific filter is set", () => {
    expect(matchesStatus(showWith(null), "running")).toBe(false);
    expect(matchesStatus(showWith(null), "upcoming")).toBe(false);
  });
});
