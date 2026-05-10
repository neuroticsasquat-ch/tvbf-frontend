import { describe, expect, it } from "vitest";
import { libraryStatusFor, matchesStatus, watchStateOf } from "./filterTypes";
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

  it("'tbd' matches To Be Determined", () => {
    expect(matchesStatus(showWith("To Be Determined"), "tbd")).toBe(true);
  });

  it("'tbd' does NOT match In Development, Running, or Ended", () => {
    expect(matchesStatus(showWith("In Development"), "tbd")).toBe(false);
    expect(matchesStatus(showWith("Running"), "tbd")).toBe(false);
    expect(matchesStatus(showWith("Ended"), "tbd")).toBe(false);
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

describe("watchStateOf", () => {
  function entry(opts: { watched: number; aired: number; status?: string | null }) {
    return {
      watched_episode_count: opts.watched,
      aired_episode_count: opts.aired,
      show: { status: opts.status ?? null },
    };
  }

  it("not_started when zero watched", () => {
    expect(watchStateOf(entry({ watched: 0, aired: 5 }))).toBe("not_started");
  });

  it("watching when some watched, not all aired", () => {
    expect(watchStateOf(entry({ watched: 3, aired: 10 }))).toBe("watching");
  });

  it("caught_up when all aired watched and show is Running", () => {
    expect(watchStateOf(entry({ watched: 10, aired: 10, status: "Running" }))).toBe("caught_up");
  });

  it("caught_up when show status is In Development / TBD", () => {
    expect(watchStateOf(entry({ watched: 10, aired: 10, status: "In Development" }))).toBe(
      "caught_up",
    );
    expect(watchStateOf(entry({ watched: 10, aired: 10, status: "To Be Determined" }))).toBe(
      "caught_up",
    );
  });

  it("finished when all aired watched and show is Ended", () => {
    expect(watchStateOf(entry({ watched: 10, aired: 10, status: "Ended" }))).toBe("finished");
  });

  it("watching when aired is zero", () => {
    // Edge case: a show in My Shows but no aired episodes yet. With 0 watched
    // it's not_started; with >0 watched (which shouldn't happen but defensive)
    // it's still 'watching' (not caught up since aired === 0 fails the guard).
    expect(watchStateOf(entry({ watched: 0, aired: 0 }))).toBe("not_started");
  });
});

describe("libraryStatusFor", () => {
  function entry(opts: { watched: number; aired: number; status?: string | null }) {
    return {
      watched_episode_count: opts.watched,
      aired_episode_count: opts.aired,
      show: { status: opts.status ?? null },
    };
  }

  it("returns 'finished' for Ended + caught up", () => {
    expect(libraryStatusFor(entry({ watched: 5, aired: 5, status: "Ended" }))).toBe("finished");
  });

  it("returns 'caught_up' for Running + caught up", () => {
    expect(libraryStatusFor(entry({ watched: 5, aired: 5, status: "Running" }))).toBe("caught_up");
  });

  it("returns null for partial progress", () => {
    expect(libraryStatusFor(entry({ watched: 2, aired: 5 }))).toBeNull();
  });

  it("returns null for not started", () => {
    expect(libraryStatusFor(entry({ watched: 0, aired: 5 }))).toBeNull();
  });
});
