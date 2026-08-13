import { describe, expect, it } from "vitest";
import {
  SHOW_STATUSES,
  SHOW_STATUS_API_VALUE,
  isEndedStatus,
  libraryStatusFor,
  matchesStatus,
  watchStateOf,
} from "./filterTypes";
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
    rating_average: null,
    my_rating: null,
  };
}

describe("SHOW_STATUSES", () => {
  it("offers exactly TMDB's five statuses plus All", () => {
    expect(SHOW_STATUSES.map((s) => s.label)).toEqual([
      "All",
      "Returning Series",
      "Ended",
      "Canceled",
      "In Production",
      "Planned",
    ]);
  });

  it("drops TV Maze's vocabulary, so a persisted key from it no longer validates", () => {
    // `usePersistedSort` checks the stored value against SHOW_STATUS_KEYS and
    // falls back to the default when it misses — which is what lands a user
    // holding `running` / `upcoming` / `tbd` on "All" rather than on an empty
    // list (NEU-1031 D3). `ended` deliberately survives: it means the same
    // thing in both vocabularies.
    const keys: string[] = SHOW_STATUSES.map((s) => s.key);
    expect(keys).not.toContain("running");
    expect(keys).not.toContain("upcoming");
    expect(keys).not.toContain("tbd");
    expect(keys).toContain("ended");
  });

  it("every non-'all' key maps to the catalog string TMDB stores", () => {
    for (const { key } of SHOW_STATUSES) {
      if (key === "all") expect(SHOW_STATUS_API_VALUE[key]).toBeUndefined();
      else expect(SHOW_STATUS_API_VALUE[key]).toBeTruthy();
    }
  });
});

describe("matchesStatus", () => {
  it("'all' matches everything including unknown statuses", () => {
    expect(matchesStatus(showWith("Returning Series"), "all")).toBe(true);
    expect(matchesStatus(showWith(null), "all")).toBe(true);
  });

  it("matches each of TMDB's five statuses on its own key", () => {
    expect(matchesStatus(showWith("Returning Series"), "returning_series")).toBe(true);
    expect(matchesStatus(showWith("Ended"), "ended")).toBe(true);
    expect(matchesStatus(showWith("Canceled"), "canceled")).toBe(true);
    expect(matchesStatus(showWith("In Production"), "in_production")).toBe(true);
    expect(matchesStatus(showWith("Planned"), "planned")).toBe(true);
  });

  it("keeps Ended and Canceled distinct — the split TV Maze could not express", () => {
    expect(matchesStatus(showWith("Canceled"), "ended")).toBe(false);
    expect(matchesStatus(showWith("Ended"), "canceled")).toBe(false);
  });

  it("keeps In Production and Planned distinct", () => {
    expect(matchesStatus(showWith("Planned"), "in_production")).toBe(false);
    expect(matchesStatus(showWith("In Production"), "planned")).toBe(false);
  });

  it("does not match a TV Maze status left over from before cutover", () => {
    expect(matchesStatus(showWith("Running"), "returning_series")).toBe(false);
    expect(matchesStatus(showWith("In Development"), "planned")).toBe(false);
  });

  it("matches exactly, not case-insensitively — the API compares verbatim", () => {
    expect(matchesStatus(showWith("returning series"), "returning_series")).toBe(false);
  });

  it("returns false when show.status is null and a specific filter is set", () => {
    expect(matchesStatus(showWith(null), "returning_series")).toBe(false);
    expect(matchesStatus(showWith(null), "planned")).toBe(false);
  });
});

describe("isEndedStatus", () => {
  it("is true for both statuses that mean the show is over", () => {
    expect(isEndedStatus("Ended")).toBe(true);
    expect(isEndedStatus("Canceled")).toBe(true);
  });

  it("is false for the three that mean it is not", () => {
    expect(isEndedStatus("Returning Series")).toBe(false);
    expect(isEndedStatus("In Production")).toBe(false);
    expect(isEndedStatus("Planned")).toBe(false);
  });

  it("is false for null and undefined", () => {
    expect(isEndedStatus(null)).toBe(false);
    expect(isEndedStatus(undefined)).toBe(false);
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

  it("caught_up when all aired watched and show is Returning Series", () => {
    expect(watchStateOf(entry({ watched: 10, aired: 10, status: "Returning Series" }))).toBe(
      "caught_up",
    );
  });

  it("caught_up when show is In Production / Planned", () => {
    expect(watchStateOf(entry({ watched: 10, aired: 10, status: "In Production" }))).toBe(
      "caught_up",
    );
    expect(watchStateOf(entry({ watched: 10, aired: 10, status: "Planned" }))).toBe("caught_up");
  });

  it("finished when all aired watched and show is Ended", () => {
    expect(watchStateOf(entry({ watched: 10, aired: 10, status: "Ended" }))).toBe("finished");
  });

  it("finished when the show was Canceled, not merely caught_up", () => {
    // The regression a straight `status === "Ended"` port would have shipped.
    expect(watchStateOf(entry({ watched: 10, aired: 10, status: "Canceled" }))).toBe("finished");
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

  it("returns 'finished' for Ended or Canceled + caught up", () => {
    expect(libraryStatusFor(entry({ watched: 5, aired: 5, status: "Ended" }))).toBe("finished");
    expect(libraryStatusFor(entry({ watched: 5, aired: 5, status: "Canceled" }))).toBe("finished");
  });

  it("returns 'caught_up' for Returning Series + caught up", () => {
    expect(libraryStatusFor(entry({ watched: 5, aired: 5, status: "Returning Series" }))).toBe(
      "caught_up",
    );
  });

  it("returns null for partial progress", () => {
    expect(libraryStatusFor(entry({ watched: 2, aired: 5 }))).toBeNull();
  });

  it("returns null for not started", () => {
    expect(libraryStatusFor(entry({ watched: 0, aired: 5 }))).toBeNull();
  });
});
