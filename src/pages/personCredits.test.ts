import { describe, expect, it } from "vitest";
import type { EpisodeRef, ShowRef } from "@/api/types";
import { characterLabel, collapseByEpisode, distinctLabels, groupByShow } from "./personCredits";

function show(id: number, name: string, premiered: string | null = null): ShowRef {
  return { id, name, image_medium: null, premiered };
}

function episode(id: number, season: number, number: number | null): EpisodeRef {
  return { id, name: `E${id}`, season, number, airdate: null };
}

describe("groupByShow", () => {
  it("groups credits by show", () => {
    const a = show(1, "Alpha");
    const b = show(2, "Beta");
    const groups = groupByShow([{ show: a }, { show: b }, { show: a }]);

    expect(groups.map((g) => g.show.name)).toEqual(["Alpha", "Beta"]);
    expect(groups[0].credits).toHaveLength(2);
    expect(groups[1].credits).toHaveLength(1);
  });

  it("orders three shows by their newest episode, not by show age", () => {
    // The API serves episode credits newest-first across all shows, so first
    // appearance IS newest episode. A 2024 episode of a 1999 show must outrank
    // a 2022 show — which is the whole reason grouping preserves input order
    // rather than sorting by anything on the show.
    const svu = show(3, "SVU", "1999-09-20");
    const severance = show(1, "Severance", "2022-02-18");
    const wire = show(2, "The Wire", "2002-06-02");
    const groups = groupByShow([
      { show: svu, episode: episode(1, 26, 1), airdate: "2024-05-01" },
      { show: severance, episode: episode(2, 1, 9), airdate: "2022-04-08" },
      { show: wire, episode: episode(3, 3, 12), airdate: "2004-09-19" },
      { show: svu, episode: episode(4, 1, 1), airdate: "1999-09-20" },
    ]);

    expect(groups.map((g) => g.show.name)).toEqual(["SVU", "Severance", "The Wire"]);
    expect(groups[0].credits).toHaveLength(2);
  });

  it("orders groups by where each show first appears, not by name or id", () => {
    // The API hands back episode credits newest-first, so a show's first credit
    // is its newest episode. Preserving first-appearance order is therefore the
    // whole ordering rule: a 2024 episode of a 1999 show outranks a 2022 show.
    const svu = show(3, "SVU", "1999-09-20");
    const severance = show(1, "Severance", "2022-02-18");
    const groups = groupByShow([
      { show: svu }, // 2024 episode
      { show: severance }, // 2022 episode
      { show: svu }, // an older SVU episode
    ]);

    expect(groups.map((g) => g.show.name)).toEqual(["SVU", "Severance"]);
  });

  it("returns an empty list for no credits", () => {
    expect(groupByShow([])).toEqual([]);
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
