import { describe, expect, it } from "vitest";
import type { WatchNextEntry } from "@/api/types";
import {
  WATCH_NEXT_SORTS,
  WATCH_NEXT_SORT_KEYS,
  compareWatchNextEntries,
} from "./watchNextSort";

function makeEntry(overrides: {
  id: number;
  name: string;
  airdate?: string | null;
  last_aired?: string | null;
  last_watched_at?: string | null;
  added_at?: string | null;
}): WatchNextEntry {
  return {
    show: {
      id: overrides.id,
      name: overrides.name,
      type: null,
      status: null,
      language: null,
      premiered: null,
      ended: null,
      image_medium: null,
      image_original: null,
      network: null,
      web_channel: null,
      genres: [],
      matched_aka: null,
    },
    episode: {
      id: overrides.id * 100,
      show_id: overrides.id,
      season_id: null,
      season: 1,
      number: 1,
      name: null,
      airdate: overrides.airdate ?? null,
      airtime: null,
      runtime: null,
      summary: null,
      image_medium: null,
      image_original: null,
    },
    last_watched_at: overrides.last_watched_at ?? null,
    last_aired: overrides.last_aired ?? null,
    watched_episode_count: 0,
    aired_episode_count: 0,
    upcoming_episode_count: 0,
    added_at: overrides.added_at ?? null,
  };
}

function order(entries: WatchNextEntry[], sort: Parameters<typeof compareWatchNextEntries>[2]) {
  return [...entries].sort((a, b) => compareWatchNextEntries(a, b, sort)).map((e) => e.show.id);
}

describe("WATCH_NEXT_SORTS", () => {
  it("lists options in the expected display order with Newest Unwatched after Oldest Unwatched", () => {
    expect(WATCH_NEXT_SORTS.map((s) => s.key)).toEqual([
      "last_aired_desc",
      "last_watched_desc",
      "oldest_unwatched_asc",
      "newest_unwatched_desc",
      "added_desc",
      "name_asc",
    ]);
  });

  it("uses the expected human labels", () => {
    const byKey = Object.fromEntries(WATCH_NEXT_SORTS.map((s) => [s.key, s.label]));
    expect(byKey.last_aired_desc).toBe("Last Aired");
    expect(byKey.oldest_unwatched_asc).toBe("Oldest Unwatched");
    expect(byKey.newest_unwatched_desc).toBe("Newest Unwatched");
  });

  it("WATCH_NEXT_SORT_KEYS mirrors WATCH_NEXT_SORTS", () => {
    expect(WATCH_NEXT_SORT_KEYS).toEqual(WATCH_NEXT_SORTS.map((s) => s.key));
  });
});

describe("compareWatchNextEntries", () => {
  it("last_aired_desc sorts by show.last_aired (NOT episode.airdate)", () => {
    // Cross-wire airdate vs last_aired so we can't accidentally pass by reading
    // the wrong field.
    const entries = [
      makeEntry({ id: 1, name: "Old", airdate: "2026-04-01", last_aired: "2026-01-01" }),
      makeEntry({ id: 2, name: "New", airdate: "2026-01-01", last_aired: "2026-04-01" }),
    ];
    expect(order(entries, "last_aired_desc")).toEqual([2, 1]);
  });

  it("newest_unwatched_desc sorts by episode.airdate (NOT last_aired)", () => {
    const entries = [
      makeEntry({ id: 1, name: "Old", airdate: "2026-01-01", last_aired: "2026-04-01" }),
      makeEntry({ id: 2, name: "New", airdate: "2026-04-01", last_aired: "2026-01-01" }),
    ];
    expect(order(entries, "newest_unwatched_desc")).toEqual([2, 1]);
  });

  it("oldest_unwatched_asc sorts by episode.airdate ascending", () => {
    const entries = [
      makeEntry({ id: 1, name: "Older", airdate: "2026-01-01" }),
      makeEntry({ id: 2, name: "Newer", airdate: "2026-04-01" }),
    ];
    expect(order(entries, "oldest_unwatched_asc")).toEqual([1, 2]);
  });

  it("last_aired_desc puts entries with null last_aired at the bottom", () => {
    const entries = [
      makeEntry({ id: 1, name: "HasDate", last_aired: "2026-04-01" }),
      makeEntry({ id: 2, name: "NoDate", last_aired: null }),
    ];
    expect(order(entries, "last_aired_desc")).toEqual([1, 2]);
  });

  it("newest_unwatched_desc puts entries with null episode.airdate at the bottom", () => {
    const entries = [
      makeEntry({ id: 1, name: "HasDate", airdate: "2026-04-01" }),
      makeEntry({ id: 2, name: "NoDate", airdate: null }),
    ];
    expect(order(entries, "newest_unwatched_desc")).toEqual([1, 2]);
  });

  it("ties break by case-insensitive show name with leading articles stripped", () => {
    const sameDate = "2026-04-01";
    const entries = [
      makeEntry({ id: 1, name: "The Office", last_aired: sameDate }),
      makeEntry({ id: 2, name: "Aliens", last_aired: sameDate }),
    ];
    // Stripped keys: "office", "aliens" → aliens first.
    expect(order(entries, "last_aired_desc")).toEqual([2, 1]);
  });
});
