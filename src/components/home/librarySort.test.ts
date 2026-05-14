import { describe, expect, it } from "vitest";
import type { MyShowEntry, ShowSummary } from "@/api/types";
import { compareLibraryEntries, type LibraryEntry } from "./librarySort";

function makeShow(name: string): ShowSummary {
  return {
    id: name.charCodeAt(0),
    name,
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
    rating_average: null,
    my_rating: null,
  };
}

function makeEntry(name: string, my_rating: number | null = null): MyShowEntry {
  return {
    show: makeShow(name),
    watched_episode_count: 0,
    total_episode_count: 0,
    aired_episode_count: 0,
    upcoming_episode_count: 0,
    last_aired: null,
    last_watched_at: null,
    first_watched_at: null,
    next_episode: null,
    added_at: "2026-01-01T00:00:00Z",
    my_rating,
  };
}

function sortBy(entries: LibraryEntry[], sort: "my_rating_desc" | "my_rating_asc"): string[] {
  return [...entries].sort((a, b) => compareLibraryEntries(a, b, sort)).map((e) => e.show.name);
}

describe("compareLibraryEntries — my_rating sort", () => {
  it("my_rating_desc sorts rated rows first, then by stars descending", () => {
    const entries = [
      makeEntry("Bravo", 3),
      makeEntry("Charlie", null),
      makeEntry("Alpha", 5),
      makeEntry("Delta", 4),
    ];
    expect(sortBy(entries, "my_rating_desc")).toEqual(["Alpha", "Delta", "Bravo", "Charlie"]);
  });

  it("my_rating_asc sorts rated rows first, ascending by stars; unrated last", () => {
    const entries = [
      makeEntry("Bravo", 3),
      makeEntry("Charlie", null),
      makeEntry("Alpha", 5),
      makeEntry("Delta", 1),
    ];
    expect(sortBy(entries, "my_rating_asc")).toEqual(["Delta", "Bravo", "Alpha", "Charlie"]);
  });

  it("tie-breaks equal ratings by name ascending", () => {
    const entries = [makeEntry("Bravo", 4), makeEntry("Alpha", 4), makeEntry("Charlie", 4)];
    expect(sortBy(entries, "my_rating_desc")).toEqual(["Alpha", "Bravo", "Charlie"]);
    expect(sortBy(entries, "my_rating_asc")).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("sinks unrated rows to the bottom in both directions", () => {
    const entries = [makeEntry("Bravo", null), makeEntry("Alpha", 2), makeEntry("Charlie", null)];
    expect(sortBy(entries, "my_rating_desc")).toEqual(["Alpha", "Bravo", "Charlie"]);
    expect(sortBy(entries, "my_rating_asc")).toEqual(["Alpha", "Bravo", "Charlie"]);
  });
});
