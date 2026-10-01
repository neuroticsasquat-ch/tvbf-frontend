import { describe, expect, it } from "vitest";
import type { EpisodeRef, ShowRef } from "@/api/types";
import {
  buildShowCards,
  characterLabel,
  collapseByEpisode,
  distinctLabels,
  seasonRows,
} from "./personCredits";

function show(id: number, name: string, premiered: string | null = null): ShowRef {
  return { id, name, image_medium: null, premiered };
}

function episode(id: number, season: number, number: number | null): EpisodeRef {
  return { id, name: `E${id}`, season, number, airdate: null };
}

describe("buildShowCards", () => {
  function episode(id: number, airdate: string | null): EpisodeRef {
    return { id, name: `E${id}`, season: 2, number: id, airdate };
  }
  function regular(
    s: ShowRef,
    name: string,
    episode_count: number | null,
    seasons: number[],
    last_credited: string | null,
  ) {
    return {
      show: s,
      character: { id: 0, name, image_medium: null },
      self: false,
      voice: false,
      episode_count,
      seasons,
      last_credited,
    };
  }
  function guest(s: ShowRef, name: string, ep: EpisodeRef) {
    return {
      show: s,
      episode: ep,
      character: { id: 0, name, image_medium: null },
      self: false,
      voice: false,
    };
  }
  const cast = (
    showLevel: ReturnType<typeof regular>[],
    episodeLevel: ReturnType<typeof guest>[],
  ) =>
    buildShowCards({
      showLevel,
      episodeLevel,
      label: characterLabel,
      seasonsOf: (credit) => credit.seasons,
      lastCreditedOf: (credit) => credit.last_credited,
    });

  it("merges a show's regular and guest credits into one card", () => {
    const a = show(1, "Alpha");
    const cards = cast(
      [regular(a, "Lead", 40, [3, 1], "2020-05-01")],
      [guest(a, "Lead", episode(10, "2018-01-01")), guest(a, "Twin", episode(11, "2017-01-01"))],
    );

    expect(cards).toHaveLength(1);
    expect(cards[0].labels).toEqual(["Lead", "Twin"]);
    expect(cards[0].seasons).toEqual([1, 3]);
    expect(cards[0].episodes.map((e) => e.episode.id)).toEqual([10, 11]);
  });

  it("counts the regular credits' aggregate, not the guest episodes on top", () => {
    // Upstream already counts a regular's guest turns into the aggregate, so
    // adding the guest episodes would count them twice.
    const a = show(1, "Alpha");
    const cards = cast(
      [regular(a, "Lead", 40, [1], null), regular(a, "Twin", 2, [1], null)],
      [guest(a, "Lead", episode(10, null))],
    );
    expect(cards[0].episodeCount).toBe(42);
  });

  it("counts a guest-only show's episodes", () => {
    const g = show(2, "Gamma");
    const cards = cast(
      [],
      [guest(g, "Guest", episode(20, null)), guest(g, "Guest", episode(21, null))],
    );
    expect(cards[0].episodeCount).toBe(2);
  });

  it("counts a crew card's episodes, not its credit rows", () => {
    // Story and Teleplay on one episode are two credits and one episode; the
    // card says "N episodes", so it counts one.
    const g = show(2, "Gamma");
    const ep = episode(20, null);
    const cards = buildShowCards({
      showLevel: [] as { show: ShowRef; role: string; episode_count: number | null }[],
      episodeLevel: [
        { show: g, episode: ep, role: "Story" },
        { show: g, episode: ep, role: "Teleplay" },
      ],
      label: (credit) => credit.role,
    });
    expect(cards[0].episodeCount).toBe(1);
    expect(cards[0].labels).toEqual(["Story", "Teleplay"]);
  });

  it("gives no count when the regular credits carry none", () => {
    const b = show(3, "Beta");
    expect(cast([regular(b, "Lead", null, [1], null)], [])[0].episodeCount).toBeNull();
  });

  it("dates a card by its latest regular season or episode", () => {
    const a = show(1, "Alpha");
    const [card] = cast(
      [regular(a, "Lead", 1, [1], "2020-05-01")],
      [guest(a, "Lead", episode(10, "2021-02-01"))],
    );
    expect(card.latest).toBe("2021-02-01");
  });

  it("orders cards newest first, undated last, ties by show id", () => {
    const cards = cast(
      [
        regular(show(5, "Undated B"), "x", 1, [1], null),
        regular(show(4, "Old"), "x", 1, [1], "2001-01-01"),
        regular(show(3, "Undated A"), "x", 1, [1], null),
      ],
      [guest(show(9, "New"), "x", episode(1, "2024-01-01"))],
    );
    expect(cards.map((c) => c.show.name)).toEqual(["New", "Old", "Undated A", "Undated B"]);
  });

  it("returns no cards for no credits", () => {
    expect(cast([], [])).toEqual([]);
  });
});

describe("seasonRows", () => {
  it("links each season to its cast, with the season's episode count once known", () => {
    const rows = seasonRows(100, [1, 2], [
      { number: 1, name: null, episode_order: 22 },
      { number: 2, name: "The Final Season", episode_order: 1 },
    ]);
    expect(rows).toEqual([
      { number: 1, text: "Season 1 · 22 episodes", to: "/shows/100/episodes?season=1&tab=cast" },
      {
        number: 2,
        text: "The Final Season · 1 episode",
        to: "/shows/100/episodes?season=2&tab=cast",
      },
    ]);
  });

  it("falls back to the number while the show's seasons are loading", () => {
    expect(seasonRows(100, [0], undefined)[0].text).toBe("Season 0");
  });
});

describe("collapseByEpisode", () => {
  it("joins two roles on one episode into a single entry", () => {
    const ep = episode(900, 2, 11);
    const entries = collapseByEpisode(
      [
        { episode: ep, role: "Story" },
        { episode: ep, role: "Teleplay" },
      ],
      (credit) => credit.role,
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].labels).toEqual(["Story", "Teleplay"]);
  });

  it("keeps distinct episodes separate and in order", () => {
    const entries = collapseByEpisode(
      [
        { episode: episode(902, 2, 3), role: "Director" },
        { episode: episode(901, 2, 2), role: "Director" },
      ],
      (credit) => credit.role,
    );

    expect(entries.map((e) => e.episode.id)).toEqual([902, 901]);
  });

  it("drops a credit repeated verbatim", () => {
    // The credit tables carry no unique constraint, so upstream can repeat one.
    const ep = episode(900, 1, 1);
    const entries = collapseByEpisode(
      [
        { episode: ep, role: "Director" },
        { episode: ep, role: "Director" },
      ],
      (credit) => credit.role,
    );

    expect(entries[0].labels).toEqual(["Director"]);
  });
});

describe("characterLabel", () => {
  it("marks voice roles and leaves others alone", () => {
    expect(characterLabel({ character: { name: "Bender" }, voice: true })).toBe("Bender (voice)");
    expect(characterLabel({ character: { name: "Mark S." }, voice: false })).toBe("Mark S.");
  });
});

describe("distinctLabels", () => {
  it("preserves order and drops duplicates", () => {
    const labels = distinctLabels(
      [{ role: "Director" }, { role: "Writer" }, { role: "Director" }],
      (credit) => credit.role,
    );
    expect(labels).toEqual(["Director", "Writer"]);
  });
});
